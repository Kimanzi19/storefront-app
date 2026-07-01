'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Plus, Minus, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

type VariantOption = string | { name: string, price_adjustment?: number };

interface Variant {
  name: string;
  options: VariantOption[];
}

interface Product {
  id: string;
  title: string;
  price: number;
  description: string;
  image_urls: string[];
  variants: Variant[];
  category?: string;
  min_order_quantity?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  selectedVariants: Record<string, string>;
}

export default function StorefrontClient({ vendor, initialProducts }: { vendor: any, initialProducts: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // Checkout Form
  const [customerName, setCustomerName] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // Location Autocomplete
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeVariants, setActiveVariants] = useState<Record<string, string>>({});

  const getOptionData = (opt: VariantOption) => {
    if (typeof opt === 'string') return { name: opt, price_adjustment: 0 };
    return { name: opt.name, price_adjustment: opt.price_adjustment || 0 };
  };

  const getCartItemPrice = (item: CartItem) => {
    let total = item.product.price;
    item.product.variants?.forEach(v => {
      const selectedName = item.selectedVariants[v.name];
      if (selectedName) {
        const opt = v.options.find(o => getOptionData(o).name === selectedName);
        if (opt) total += getOptionData(opt).price_adjustment;
      }
    });
    return total;
  };

  const getCurrentDisplayPrice = () => {
    if (!selectedProduct) return 0;
    let total = selectedProduct.price;
    selectedProduct.variants?.forEach(v => {
      const selectedName = activeVariants[v.name];
      if (selectedName) {
        const opt = v.options.find(o => getOptionData(o).name === selectedName);
        if (opt) total += getOptionData(opt).price_adjustment;
      }
    });
    return total;
  };

  const cartTotal = cart.reduce((sum, item) => sum + (getCartItemPrice(item) * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const uniqueCategories = Array.from(new Set(initialProducts.map(p => p.category).filter(Boolean))) as string[];

  const filteredProducts = initialProducts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === null || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    if (!locationQuery || locationQuery.length < 3) {
      setLocationResults([]);
      return;
    }
    
    if (locationQuery === deliveryLocation && !showLocationDropdown) return;

    const timeoutId = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&countrycodes=ke&limit=5`);
        const data = await res.json();
        setLocationResults(data);
        setShowLocationDropdown(true);
      } catch (e) {
        console.error("Location search failed", e);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [locationQuery]);

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setCurrentImageIndex(0);
    
    // Auto-select first variant option for convenience
    const initialVariants: Record<string, string> = {};
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(v => {
        initialVariants[v.name] = getOptionData(v.options[0]).name;
      });
    }
    setActiveVariants(initialVariants);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
  };

  const nextImage = () => {
    if (selectedProduct && selectedProduct.image_urls) {
      setCurrentImageIndex((prev) => (prev + 1) % selectedProduct.image_urls.length);
    }
  };

  const prevImage = () => {
    if (selectedProduct && selectedProduct.image_urls) {
      setCurrentImageIndex((prev) => (prev - 1 + selectedProduct.image_urls.length) % selectedProduct.image_urls.length);
    }
  };

  const addToCartFromModal = () => {
    if (!selectedProduct) return;
    
    setCart(prev => {
      // Check if exact same product + variant combo exists
      const existingItemIndex = prev.findIndex(item => 
        item.product.id === selectedProduct.id && 
        JSON.stringify(item.selectedVariants) === JSON.stringify(activeVariants)
      );
      
      if (existingItemIndex >= 0) {
        const newCart = [...prev];
        newCart[existingItemIndex].quantity += 1;
        return newCart;
      } else {
        const initialQty = selectedProduct.min_order_quantity || 1;
        return [...prev, { product: selectedProduct, quantity: initialQty, selectedVariants: activeVariants }];
      }
    });
    
    closeProductModal();
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const newCart = [...prev];
      const minQty = newCart[index].product.min_order_quantity || 1;
      newCart[index].quantity += delta;
      if (newCart[index].quantity < minQty) {
        newCart.splice(index, 1);
      }
      return newCart;
    });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingOut(true);

    try {
      // 1. Save to database via API route
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendor.id,
          customer_name: customerName,
          delivery_location: deliveryLocation,
          total_price: cartTotal,
          items_json: cart
        })
      });

      // 2. Generate WhatsApp URL
      let message = `Hello ${vendor.store_name}, I would like to place an order!%0A%0A`;
      message += `*Customer:* ${customerName}%0A`;
      message += `*Delivery Location:* ${deliveryLocation}%0A`;
      if (deliveryInstructions) {
        message += `*Instructions:* ${deliveryInstructions}%0A`;
      }
      message += `%0A*Order Details:*%0A`;
      
      cart.forEach(item => {
        let variantString = '';
        if (item.selectedVariants && Object.keys(item.selectedVariants).length > 0) {
           variantString = ` (${Object.entries(item.selectedVariants).map(([k,v]) => `${k}: ${v}`).join(', ')})`;
        }
        const itemPrice = getCartItemPrice(item);
        message += `- ${item.quantity}x ${item.product.title}${variantString} - KES ${(itemPrice * item.quantity).toLocaleString()}%0A`;
      });
      
      message += `%0A*Total: KES ${cartTotal.toLocaleString()}*%0A%0A`;
      message += `Please confirm availability and share payment details!`;
      
      const cleanPhone = vendor.phone_number.replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;
      
      // Redirect to WhatsApp
      window.location.href = waUrl;
    } catch (err) {
      console.error(err);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{vendor.store_name}</h1>
      </div>

      {/* Search & Filter */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <input 
            type="text" 
            className="input" 
            placeholder="Search products..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.5rem', borderRadius: '50px' }}
          />
          <svg style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>

        {uniqueCategories.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                whiteSpace: 'nowrap',
                padding: '0.4rem 1rem',
                borderRadius: '50px',
                border: activeCategory === null ? '2px solid var(--primary)' : '1px solid var(--border)',
                backgroundColor: activeCategory === null ? 'rgba(100, 108, 255, 0.1)' : 'var(--bg-color)',
                color: activeCategory === null ? 'var(--primary)' : 'var(--text-color)',
                fontWeight: activeCategory === null ? 'bold' : 'normal',
                cursor: 'pointer'
              }}
            >
              All
            </button>
            {uniqueCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '0.4rem 1rem',
                  borderRadius: '50px',
                  border: activeCategory === cat ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: activeCategory === cat ? 'rgba(100, 108, 255, 0.1)' : 'var(--bg-color)',
                  color: activeCategory === cat ? 'var(--primary)' : 'var(--text-color)',
                  fontWeight: activeCategory === cat ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
        {filteredProducts.map(p => (
          <motion.div 
            key={p.id} 
            className="card" 
            style={{ padding: '0.75rem', cursor: 'pointer', position: 'relative' }}
            whileHover={{ y: -5 }}
            transition={{ type: "spring", stiffness: 300 }}
            onClick={() => openProductModal(p)}
          >
            <div style={{ height: '150px', backgroundColor: 'var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {p.image_urls && p.image_urls.length > 0 ? (
                <img src={p.image_urls[0]} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No Image</span>
              )}
            </div>
            <h3 style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</h3>
            {p.category && (
              <div style={{ display: 'inline-block', fontSize: '0.65rem', backgroundColor: 'rgba(100, 108, 255, 0.1)', color: 'var(--primary)', padding: '0.1rem 0.3rem', borderRadius: '4px', marginBottom: '0.25rem', marginRight: '0.25rem' }}>{p.category}</div>
            )}
            {p.min_order_quantity && p.min_order_quantity > 1 && (
              <div style={{ display: 'inline-block', fontSize: '0.65rem', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '0.1rem 0.3rem', borderRadius: '4px', marginBottom: '0.25rem', fontWeight: 'bold' }}>Min. {p.min_order_quantity} pcs</div>
            )}
            <p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{p.price.toLocaleString()} KES</p>
          </motion.div>
        ))}
      </div>
      {filteredProducts.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '3rem' }}>No products found.</p>
      )}

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsCartOpen(true)}
          className="btn btn-primary"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '1.5rem',
            right: '1.5rem',
            maxWidth: '400px',
            margin: '0 auto',
            padding: '1rem',
            borderRadius: '50px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 10px 25px rgba(100, 108, 255, 0.4)',
            zIndex: 40
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag />
            <span>View Order ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
          </div>
          <span style={{ fontWeight: 'bold' }}>{cartTotal.toLocaleString()} KES</span>
        </motion.button>
      )}

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeProductModal}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 50, backdropFilter: 'blur(5px)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 150 || velocity.y > 500) {
                  closeProductModal();
                }
              }}
              className="card glass"
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: '90vh',
                overflowY: 'auto',
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                padding: '1.5rem',
                zIndex: 51,
                touchAction: 'pan-y'
              }}
            >
              <div style={{ width: '40px', height: '5px', backgroundColor: 'var(--border)', borderRadius: '10px', margin: '0 auto 1.5rem' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Product Details</h2>
                <button onClick={closeProductModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}>
                  <X />
                </button>
              </div>

              {/* Image Carousel */}
              <div style={{ position: 'relative', height: '250px', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? (
                  <>
                    <motion.img 
                      key={currentImageIndex}
                      src={selectedProduct.image_urls[currentImageIndex]} 
                      alt={selectedProduct.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      initial={{ opacity: 0.5, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.8}
                      onDragEnd={(e, { offset, velocity }) => {
                        if (offset.x < -50 || velocity.x < -300) nextImage();
                        else if (offset.x > 50 || velocity.x > 300) prevImage();
                      }}
                    />
                    {selectedProduct.image_urls.length > 1 && (
                      <>
                        <button onClick={prevImage} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
                          <ChevronLeft size={18} />
                        </button>
                        <button onClick={nextImage} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
                          <ChevronRight size={18} />
                        </button>
                        <div style={{ position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.25rem' }}>
                          {selectedProduct.image_urls.map((_, i) => (
                            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: i === currentImageIndex ? 'white' : 'rgba(255,255,255,0.5)' }} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No Image</div>
                )}
              </div>

              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{selectedProduct.title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <p style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>{getCurrentDisplayPrice().toLocaleString()} KES</p>
                {selectedProduct.min_order_quantity && selectedProduct.min_order_quantity > 1 && (
                  <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '0.2rem 0.6rem', borderRadius: '50px', fontWeight: 'bold' }}>
                    Min. Order: {selectedProduct.min_order_quantity} pcs
                  </span>
                )}
              </div>
              
              {selectedProduct.description && (
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>
                  {selectedProduct.description}
                </p>
              )}

              {/* Variants */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  {selectedProduct.variants.map((v, idx) => (
                    <div key={idx} style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select {v.name}</label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {v.options.map((optRaw, optIdx) => {
                          const opt = getOptionData(optRaw);
                          const isSelected = activeVariants[v.name] === opt.name;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => setActiveVariants({ ...activeVariants, [v.name]: opt.name })}
                              style={{
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--radius-sm)',
                                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                                background: isSelected ? 'rgba(100, 108, 255, 0.1)' : 'transparent',
                                color: 'var(--text-color)',
                                cursor: 'pointer',
                                fontWeight: isSelected ? 'bold' : 'normal',
                              }}
                            >
                              {opt.name} {opt.price_adjustment > 0 ? `(+${opt.price_adjustment})` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                onClick={addToCartFromModal}
              >
                Add to Cart - {getCurrentDisplayPrice().toLocaleString()} KES
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 50 }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="card glass"
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                right: 0,
                width: '100%',
                maxWidth: '400px',
                borderRadius: 0,
                padding: '1.5rem',
                zIndex: 51,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Your Cart</h2>
                <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}>
                  <X />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {cart.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Your cart is empty.</p>
                ) : (
                  cart.map((item, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{item.product.title}</div>
                        {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                            {Object.entries(item.selectedVariants).map(([k,v]) => `${k}: ${v}`).join(', ')}
                          </div>
                        )}
                        <div style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{getCartItemPrice(item).toLocaleString()} KES</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--bg-color)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
                        <button onClick={() => updateQuantity(index, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}><Minus size={16} /></button>
                        <span style={{ fontWeight: 'bold' }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(index, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}><Plus size={16} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--primary)' }}>{cartTotal.toLocaleString()} KES</span>
                  </div>
                  
                  <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input className="input" placeholder="Your Name" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                    
                    <div style={{ position: 'relative' }}>
                      <input 
                        className="input" 
                        placeholder="Search Delivery Location (e.g. Kilimani)" 
                        required 
                        value={locationQuery} 
                        onChange={(e) => {
                          setLocationQuery(e.target.value);
                          setDeliveryLocation(e.target.value);
                          setShowLocationDropdown(true);
                        }} 
                        onFocus={() => { if (locationResults.length > 0) setShowLocationDropdown(true); }}
                      />
                      {isSearchingLocation && (
                        <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Searching...</div>
                      )}
                      <AnimatePresence>
                      {showLocationDropdown && locationResults.length > 0 && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{ height: 'auto', opacity: 1, marginTop: '4px' }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          style={{ 
                            backgroundColor: 'var(--bg-color)', 
                            border: '1px solid var(--border)', 
                            borderRadius: 'var(--radius-sm)', 
                            maxHeight: '200px',
                            overflowY: 'auto',
                            overflowX: 'hidden'
                          }}
                        >
                          {locationResults.map((result, idx) => {
                            const parts = result.display_name.split(', ');
                            const title = parts[0];
                            const subtitle = parts.length > 1 ? `${parts[1]}${parts.length > 3 ? `, ${parts[parts.length - 3]}` : ''}` : '';
                            
                            return (
                              <div 
                                key={idx}
                                style={{ 
                                  padding: '1rem', 
                                  borderBottom: '1px solid var(--border)', 
                                  cursor: 'pointer', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '1rem' 
                                }}
                                onClick={() => {
                                  const cleanLocation = subtitle ? `${title}, ${subtitle}` : title;
                                  setDeliveryLocation(cleanLocation);
                                  setLocationQuery(cleanLocation);
                                  setShowLocationDropdown(false);
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.6rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <MapPin size={20} color="var(--text-color)" />
                                </div>
                                <div>
                                  <div style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-color)' }}>{title}</div>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{subtitle}</div>
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </div>

                    <input 
                      className="input" 
                      placeholder="Specific Instructions e.g. Gate B (Optional)" 
                      value={deliveryInstructions} 
                      onChange={(e) => setDeliveryInstructions(e.target.value)} 
                    />

                    <button type="submit" className="btn btn-primary" disabled={isCheckingOut}>
                      {isCheckingOut ? 'Processing...' : 'Checkout via WhatsApp'}
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
