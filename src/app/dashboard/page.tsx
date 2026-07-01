'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Plus, Trash2, Check, Package, CheckCircle, Clock } from 'lucide-react';

type VariantType = 'Clothing Size' | 'Shoe Size' | 'Color' | 'Material' | 'Custom';
type TabType = 'Products' | 'Orders' | 'History' | 'Settings';

interface StructuredVariant {
  type: VariantType;
  customName?: string; // Used only if type is 'Custom'
  selectedOptions: { name: string, price_adjustment: number }[];
}

const PRESET_OPTIONS: Record<string, string[]> = {
  'Clothing Size': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'Shoe Size': ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
  'Color': ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Grey', 'Brown'],
  'Material': ['Cotton', 'Leather', 'Silk', 'Polyester', 'Denim', 'Wool', 'Linen']
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('Products');
  
  // Setup Form
  const [handle, setHandle] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Product Form
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newMinQuantity, setNewMinQuantity] = useState('1');
  const [uploading, setUploading] = useState(false);

  // Structured Variants
  const [variants, setVariants] = useState<StructuredVariant[]>([]);
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});

  // Settings Form State
  const [editStoreName, setEditStoreName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  
  // Danger Zone Deletion State
  const [deleteConfirmHandle, setDeleteConfirmHandle] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      
      const { data: profile } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setVendorProfile(profile);
        setEditStoreName(profile.store_name || '');
        setEditPhone(profile.phone_number || '');
        setEditHandle(profile.handle || '');
        
        const { data: prods } = await supabase
          .from('products')
          .select('*')
          .eq('vendor_id', session.user.id)
          .order('created_at', { ascending: false });
          
        if (prods) setProducts(prods);
        
        const { data: ords } = await supabase
          .from('orders')
          .select('*')
          .eq('vendor_id', session.user.id)
          .order('created_at', { ascending: false });
          
        if (ords) setOrders(ords);
      }
    }
    setLoading(false);
  };

  const handleSetupStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const { data, error } = await supabase
      .from('vendors')
      .insert([
        { id: user.id, handle: handle.trim().toLowerCase(), store_name: storeName, phone_number: phone }
      ])
      .select()
      .single();
      
    if (error) {
      alert(error.message);
    } else if (data) {
      setVendorProfile(data);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUpdatingProfile(true);

    try {
      const res = await fetch('/api/vendor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: user.id,
          store_name: editStoreName,
          phone_number: editPhone,
          handle: editHandle
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Store profile updated successfully!');
        fetchData();
      } else {
        alert(JSON.stringify(data.error || 'Failed to update profile'));
      }
    } catch (err: any) {
      alert(err.message);
    }
    setUpdatingProfile(false);
  };

  const handleDeleteAccount = async () => {
    if (!user || !vendorProfile) return;
    if (deleteConfirmHandle !== vendorProfile.handle) {
      alert(`Please type "${vendorProfile.handle}" exactly to confirm deletion.`);
      return;
    }

    if (!confirm('Are you absolutely sure you want to delete your store and account? This action cannot be undone.')) {
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await fetch('/api/vendor/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: user.id })
      });
      const data = await res.json();
      if (data.success) {
        await supabase.auth.signOut();
        window.location.href = '/';
      } else {
        alert('Failed to delete account: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert(err.message);
    }
    setDeletingAccount(false);
  };

  const handleAddVariant = () => {
    setVariants([...variants, { type: 'Clothing Size', selectedOptions: [] }]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
    const newInputs = { ...customInputs };
    delete newInputs[index];
    setCustomInputs(newInputs);
  };

  const handleUpdateVariantType = (index: number, newType: VariantType) => {
    const updated = [...variants];
    updated[index].type = newType;
    updated[index].selectedOptions = []; // reset options when changing type
    if (newType !== 'Custom') {
      updated[index].customName = undefined;
    }
    setVariants(updated);
  };

  const toggleOption = (index: number, optionName: string) => {
    const updated = [...variants];
    const currentOptions = updated[index].selectedOptions;
    const existingIndex = currentOptions.findIndex(o => o.name === optionName);
    if (existingIndex >= 0) {
      updated[index].selectedOptions = currentOptions.filter((_, i) => i !== existingIndex);
    } else {
      updated[index].selectedOptions = [...currentOptions, { name: optionName, price_adjustment: 0 }];
    }
    setVariants(updated);
  };

  const updateOptionPrice = (index: number, optionName: string, priceText: string) => {
    const updated = [...variants];
    const option = updated[index].selectedOptions.find(o => o.name === optionName);
    if (option) {
      option.price_adjustment = priceText === '' ? 0 : parseFloat(priceText);
      setVariants(updated);
    }
  };

  const addCustomOption = (index: number) => {
    const val = customInputs[index]?.trim();
    if (val) {
      const updated = [...variants];
      if (!updated[index].selectedOptions.find(o => o.name === val)) {
        updated[index].selectedOptions = [...updated[index].selectedOptions, { name: val, price_adjustment: 0 }];
      }
      setVariants(updated);
      setCustomInputs({ ...customInputs, [index]: '' });
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !vendorProfile) return;
    setUploading(true);
    
    let imageUrls: string[] = [];
    
    if (newImages.length > 0) {
      for (const file of newImages) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, file);
          
        if (uploadError) {
          alert('Error uploading image: ' + uploadError.message);
          setUploading(false);
          return;
        }
        
        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath);
          
        imageUrls.push(publicUrlData.publicUrl);
      }
    }
    
    const formattedVariants = variants
      .map(v => {
        const name = v.type === 'Custom' ? (v.customName || '') : v.type;
        return {
          name: name.trim(),
          options: v.selectedOptions
        };
      })
      .filter(v => v.name !== '' && v.options.length > 0);
    
    const { error } = await supabase
      .from('products')
      .insert([
        { 
          vendor_id: user.id, 
          title: newTitle, 
          price: parseFloat(newPrice), 
          description: newDescription,
          image_urls: imageUrls,
          variants: formattedVariants,
          category: newCategory,
          min_order_quantity: parseInt(newMinQuantity) || 1
        }
      ]);
      
    if (error) {
      alert(error.message);
    } else {
      setNewTitle('');
      setNewPrice('');
      setNewCategory('');
      setNewDescription('');
      setNewImages([]);
      setNewMinQuantity('1');
      setVariants([]);
      setCustomInputs({});
      const fileInput = document.getElementById('product-image-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      fetchData();
    }
    setUploading(false);
  };
  
  const handleDeleteProduct = async (id: string, urls: string[]) => {
    if (urls && urls.length > 0) {
      for (const url of urls) {
        const filePath = url.split('/products/')[1];
        if (filePath) {
          await supabase.storage.from('products').remove([filePath]);
        }
      }
    }
    await supabase.from('products').delete().eq('id', id);
    fetchData();
  };

  const handleUpdateOrderStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    if (error) {
      console.error(error);
      alert(`Error updating order: ${error.message}`);
    } else {
      fetchData();
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) {
        console.error(error);
        alert(`Error deleting order: ${error.message}`);
      } else {
        fetchData();
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!vendorProfile) {
    return (
      <div className="card glass" style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '1.5rem', fontWeight: 'bold' }}>Set Up Your Store</h2>
        <form onSubmit={handleSetupStore} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Store Handle (e.g. my-store)</label>
            <input className="input" required value={handle} onChange={(e) => setHandle(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Display Name</label>
            <input className="input" required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>WhatsApp Number (incl. country code)</label>
            <input className="input" placeholder="254700000000" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">Complete Setup</button>
        </form>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => !o.status || o.status.toLowerCase() === 'pending');
  const completedOrders = orders.filter(o => o.status && o.status.toLowerCase() === 'completed');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const todayTotal = completedOrders
    .filter(o => new Date(o.created_at).getTime() >= startOfDay)
    .reduce((sum, o) => sum + o.total_price, 0);
    
  const weekTotal = completedOrders
    .filter(o => new Date(o.created_at).getTime() >= startOfWeek)
    .reduce((sum, o) => sum + o.total_price, 0);
    
  const monthTotal = completedOrders
    .filter(o => new Date(o.created_at).getTime() >= startOfMonth)
    .reduce((sum, o) => sum + o.total_price, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{vendorProfile.store_name}</h1>
          <a href={`/${vendorProfile.handle}`} target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
            shop.li/{vendorProfile.handle}
          </a>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('Products')} 
          style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: activeTab === 'Products' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'Products' ? '2px solid var(--primary)' : '2px solid transparent' }}
        >
          Products
        </button>
        <button 
          onClick={() => { setActiveTab('Orders'); fetchData(); }} 
          style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: activeTab === 'Orders' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'Orders' ? '2px solid var(--primary)' : '2px solid transparent' }}
        >
          Orders ({pendingOrders.length} Pending)
        </button>
        <button 
          onClick={() => setActiveTab('History')} 
          style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: activeTab === 'History' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'History' ? '2px solid var(--primary)' : '2px solid transparent' }}
        >
          History
        </button>
        <button 
          onClick={() => setActiveTab('Settings')} 
          style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: activeTab === 'Settings' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'Settings' ? '2px solid var(--primary)' : '2px solid transparent' }}
        >
          Settings
        </button>
      </div>

      {activeTab === 'Products' && (
        <>
          <div className="card glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Add New Product</h3>
        <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 'bold' }}>Product Title *</label>
              <input className="input" style={{ width: '100%' }} placeholder="e.g. Beef Samosas, Birthday Cake" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            <div style={{ flex: '0 1 130px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 'bold' }}>Price (KES) *</label>
              <input type="number" className="input" style={{ width: '100%' }} placeholder="50" required value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
            <div style={{ flex: '0 1 160px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#eab308', marginBottom: '0.3rem', fontWeight: 'bold' }}>Min. Order (MOQ) *</label>
              <input type="number" min="1" className="input" style={{ width: '100%', borderColor: 'rgba(234, 179, 8, 0.4)' }} placeholder="1" value={newMinQuantity} onChange={(e) => setNewMinQuantity(e.target.value)} title="Minimum order quantity (e.g. 10 for samosas, defaults to 1)" />
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 'bold' }}>Category *</label>
            <input className="input" style={{ width: '100%' }} placeholder="e.g. Sneakers, Cakes, Pastries" required value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            {Array.from(new Set(products.map(p => p.category).filter(Boolean))).length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Previous:</span>
                {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map((cat: any) => (
                  <button type="button" key={cat} onClick={() => setNewCategory(cat)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '50px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-color)' }}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 'bold' }}>Product Description</label>
            <textarea className="input" placeholder="Describe your product..." style={{ minHeight: '80px', resize: 'vertical', width: '100%' }} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Product Images (can select multiple)</label>
            <input id="product-image-upload" type="file" accept="image/*" multiple className="input" style={{ padding: '0.5rem', width: '100%' }} onChange={(e) => {
              if (e.target.files) setNewImages(Array.from(e.target.files));
            }} />
          </div>
          
          {/* Smart Variant Builder */}
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Product Variants (Optional)</span>
              <button type="button" onClick={handleAddVariant} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                <Plus size={16} style={{ marginRight: '0.25rem' }} /> Add Variant
              </button>
            </div>
            
            {variants.map((variant, index) => (
              <div key={index} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  
                  {/* Variant Type Selection */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select 
                      className="input" 
                      value={variant.type} 
                      onChange={(e) => handleUpdateVariantType(index, e.target.value as VariantType)}
                      style={{ width: 'auto', minWidth: '150px' }}
                    >
                      <option value="Clothing Size">Clothing Size</option>
                      <option value="Shoe Size">Shoe Size</option>
                      <option value="Color">Color</option>
                      <option value="Material">Material</option>
                      <option value="Custom">Custom Type</option>
                    </select>

                    {variant.type === 'Custom' && (
                      <input 
                        className="input" 
                        placeholder="e.g. Scent, Style" 
                        value={variant.customName || ''} 
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[index].customName = e.target.value;
                          setVariants(updated);
                        }}
                      />
                    )}
                  </div>
                  
                  <button type="button" onClick={() => handleRemoveVariant(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Variant Options Checkboxes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Select available options:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    
                    {/* Render Presets if not Custom */}
                    {variant.type !== 'Custom' && PRESET_OPTIONS[variant.type].map((opt) => {
                      const isSelected = variant.selectedOptions.some(o => o.name === opt);
                      const optionData = variant.selectedOptions.find(o => o.name === opt);
                      return (
                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: isSelected ? 'rgba(100, 108, 255, 0.05)' : 'transparent', padding: isSelected ? '0.25rem' : 0, borderRadius: '50px' }}>
                          <button
                            type="button"
                            onClick={() => toggleOption(index, opt)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: '50px',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                              backgroundColor: isSelected ? 'rgba(100, 108, 255, 0.1)' : 'transparent',
                              color: isSelected ? 'var(--primary)' : 'var(--text-color)',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            {isSelected && <Check size={14} />} {opt}
                          </button>
                          {isSelected && (
                            <input 
                              type="number" 
                              placeholder="+0" 
                              className="input" 
                              style={{ width: '60px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '50px', minHeight: 'auto' }}
                              value={optionData?.price_adjustment || ''}
                              onChange={(e) => updateOptionPrice(index, opt, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Render already added custom options (if any) */}
                    {variant.selectedOptions.filter(opt => variant.type === 'Custom' || !PRESET_OPTIONS[variant.type].includes(opt.name)).map((opt) => (
                       <div key={opt.name} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'rgba(100, 108, 255, 0.05)', padding: '0.25rem', borderRadius: '50px' }}>
                         <button
                            type="button"
                            onClick={() => toggleOption(index, opt.name)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: '50px',
                              border: '1px solid var(--primary)',
                              backgroundColor: 'rgba(100, 108, 255, 0.1)',
                              color: 'var(--primary)',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <Check size={14} /> {opt.name}
                          </button>
                          <input 
                            type="number" 
                            placeholder="+0" 
                            className="input" 
                            style={{ width: '60px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '50px', minHeight: 'auto' }}
                            value={opt.price_adjustment || ''}
                            onChange={(e) => updateOptionPrice(index, opt.name, e.target.value)}
                          />
                        </div>
                    ))}
                  </div>

                  {/* Add Custom Option Input */}
                  <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '300px' }}>
                    <input 
                      className="input" 
                      placeholder={
                        variant.type === 'Clothing Size' ? "Add other (e.g. XXXL)" :
                        variant.type === 'Shoe Size' ? "Add other (e.g. 46)" :
                        variant.type === 'Color' ? "Add other (e.g. Navy Blue)" :
                        variant.type === 'Material' ? "Add other (e.g. Velvet)" :
                        "Add option (e.g. Lavender)"
                      }
                      value={customInputs[index] || ''}
                      onChange={(e) => setCustomInputs({ ...customInputs, [index]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomOption(index); } }}
                    />
                    <button type="button" onClick={() => addCustomOption(index)} className="btn glass" style={{ padding: '0.5rem 1rem' }}>
                      Add
                    </button>
                  </div>
                </div>

              </div>
            ))}
            {variants.length === 0 && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>No variants added. Your product will have no size/color options.</p>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={uploading} style={{ alignSelf: 'flex-start', marginTop: '1rem' }}>
            {uploading ? 'Adding Product...' : <><Plus size={18} style={{ marginRight: '0.5rem' }} /> Publish Product</>}
          </button>
        </form>
      </div>
      
      <h3 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Your Products</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {products.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No products yet.</p>
        ) : (
          products.map(p => (
            <div key={p.id} className="card" style={{ padding: '1rem', position: 'relative' }}>
              <button 
                onClick={() => handleDeleteProduct(p.id, p.image_urls)}
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'var(--bg-color)', border: '1px solid var(--border)', padding: '0.25rem', borderRadius: '50%', color: '#ef4444', cursor: 'pointer', zIndex: 10 }}
              >
                <Trash2 size={16} />
              </button>
              <div style={{ height: '120px', backgroundColor: 'var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', overflow: 'hidden' }}>
                 {p.image_urls && p.image_urls.length > 0 ? (
                   <img src={p.image_urls[0]} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                   <span style={{ fontSize: '0.8rem' }}>No Image</span>
                 )}
              </div>
              <div style={{ fontWeight: '600' }}>{p.title}</div>
              {p.category && (
                <div style={{ display: 'inline-block', fontSize: '0.7rem', backgroundColor: 'rgba(100, 108, 255, 0.1)', color: 'var(--primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginBottom: '0.25rem', marginTop: '0.25rem' }}>{p.category}</div>
              )}
              <div style={{ color: 'var(--text-muted)' }}>{p.price.toLocaleString()} KES</div>
              {p.min_order_quantity && p.min_order_quantity > 1 && (
                <div style={{ display: 'inline-block', fontSize: '0.75rem', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '0.1rem 0.5rem', borderRadius: '50px', marginTop: '0.4rem', fontWeight: 'bold' }}>
                  Min. Order: {p.min_order_quantity} pcs
                </div>
              )}
              {p.variants && p.variants.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem' }}>
                  {p.variants.length} variant option(s)
                </div>
              )}
            </div>
          ))
        )}
      </div>
        </>
      )}

      {activeTab === 'Orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pendingOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No pending orders.</p>
          ) : (
            pendingOrders.map(order => (
              <div key={order.id} className="card glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {order.customer_name} 
                        {order.status === 'completed' ? 
                          <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '0.2rem 0.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={12} /> Completed</span> :
                          <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308', padding: '0.2rem 0.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> Pending</span>
                        }
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{new Date(order.created_at).toLocaleString()}</div>
                      <div style={{ color: 'var(--text-color)', marginTop: '0.5rem', fontSize: '0.9rem' }}><span style={{ color: 'var(--text-muted)' }}>Delivery:</span> {order.delivery_location}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>{order.total_price.toLocaleString()} KES</div>
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {order.items_json && order.items_json.map((item: any, i: number) => (
                      <div key={i} style={{ fontSize: '0.9rem', marginBottom: i === order.items_json.length - 1 ? 0 : '0.5rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{item.quantity}x</span> {item.product.title}
                        {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                          <span style={{ color: 'var(--text-muted)' }}> ({Object.entries(item.selectedVariants).map(([k,v]) => `${k}: ${v}`).join(', ')})</span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    {order.status !== 'completed' && (
                      <button onClick={() => handleUpdateOrderStatus(order.id, 'completed')} className="btn btn-primary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={16} /> Mark Completed
                      </button>
                    )}
                    <button onClick={() => handleDeleteOrder(order.id)} className="btn glass" style={{ color: '#ef4444', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Trash2 size={16} /> Delete Order
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
      )}

      {activeTab === 'History' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Analytics Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Today's Sales</div>
              <div style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold' }}>{todayTotal.toLocaleString()} KES</div>
            </div>
            <div className="card glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>This Week</div>
              <div style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold' }}>{weekTotal.toLocaleString()} KES</div>
            </div>
            <div className="card glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>This Month</div>
              <div style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold' }}>{monthTotal.toLocaleString()} KES</div>
            </div>
          </div>

          {/* Completed Orders List */}
          <div>
            <h3 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Completed Orders</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {completedOrders.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No completed orders yet.</p>
              ) : (
                completedOrders.map(order => (
                  <div key={order.id} className="card glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {order.customer_name} 
                          <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '0.2rem 0.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={12} /> Completed</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{new Date(order.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>{order.total_price.toLocaleString()} KES</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <button onClick={() => handleDeleteOrder(order.id)} className="btn glass" style={{ color: '#ef4444', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trash2 size={16} /> Delete Record
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
          <div className="card glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '1rem' }}>Edit Store Profile</h3>
            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 'bold' }}>Store Name *</label>
                <input className="input" style={{ width: '100%' }} required value={editStoreName} onChange={(e) => setEditStoreName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 'bold' }}>Store Handle (URL) *</label>
                <input className="input" style={{ width: '100%' }} required value={editHandle} onChange={(e) => setEditHandle(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 'bold' }}>Phone Number *</label>
                <input className="input" style={{ width: '100%' }} required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <button type="submit" disabled={updatingProfile} className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '0.6rem 1.5rem', marginTop: '0.5rem' }}>
                {updatingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <h3 style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#ef4444', marginBottom: '0.5rem' }}>Danger Zone: Delete Account</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: '1.5' }}>
              Once you delete your store, all your uploaded products, pending orders, and store profile will be permanently wiped from the system. You can register again with the same email in the future if you decide to pivot businesses.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.3rem', fontWeight: 'bold' }}>
                Type <span style={{ textDecoration: 'underline' }}>{vendorProfile?.handle}</span> to confirm deletion:
              </label>
              <input 
                className="input" 
                style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.4)' }} 
                placeholder={vendorProfile?.handle || 'store handle'}
                value={deleteConfirmHandle} 
                onChange={(e) => setDeleteConfirmHandle(e.target.value)} 
              />
            </div>
            <button 
              type="button" 
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmHandle !== vendorProfile?.handle} 
              style={{ 
                padding: '0.6rem 1.5rem', 
                borderRadius: '50px', 
                border: 'none', 
                backgroundColor: deleteConfirmHandle === vendorProfile?.handle ? '#ef4444' : 'rgba(239, 68, 68, 0.2)', 
                color: 'white', 
                fontWeight: 'bold', 
                cursor: deleteConfirmHandle === vendorProfile?.handle ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              {deletingAccount ? 'Deleting...' : 'Delete Store & Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
