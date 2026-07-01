import { describe, it, expect } from 'vitest';
import { calculateCartTotal } from './pricing';

// Mock types similar to what we expect from the DB and Frontend
interface DBProduct {
  id: string;
  price: number;
  variants: {
    name: string;
    options: {
      name: string;
      price_adjustment?: number;
    }[];
  }[];
}

interface CartItem {
  product: { id: string };
  quantity: number;
  selectedVariants: Record<string, string>;
}

describe('calculateCartTotal', () => {
  const mockProducts: DBProduct[] = [
    {
      id: 'prod-1',
      price: 200,
      variants: []
    },
    {
      id: 'prod-2',
      price: 500,
      variants: [
        {
          name: 'Size',
          options: [
            { name: 'Small', price_adjustment: 0 },
            { name: 'Large', price_adjustment: 100 }
          ]
        },
        {
          name: 'Color',
          options: [
            { name: 'Red', price_adjustment: 0 },
            { name: 'Gold', price_adjustment: 50 }
          ]
        }
      ]
    }
  ];

  it('calculates correct price for items without variants', () => {
    const cart: CartItem[] = [
      { product: { id: 'prod-1' }, quantity: 2, selectedVariants: {} }
    ];
    
    const total = calculateCartTotal(cart, mockProducts);
    expect(total).toBe(400); // 2 * 200
  });

  it('calculates correct price incorporating additive variant adjustments', () => {
    const cart: CartItem[] = [
      { 
        product: { id: 'prod-2' }, 
        quantity: 1, 
        selectedVariants: { 'Size': 'Large', 'Color': 'Red' } 
      },
      { 
        product: { id: 'prod-2' }, 
        quantity: 2, 
        selectedVariants: { 'Size': 'Large', 'Color': 'Gold' } 
      }
    ];
    
    const total = calculateCartTotal(cart, mockProducts);
    // Item 1: 500 + 100 + 0 = 600
    // Item 2: (500 + 100 + 50) * 2 = 650 * 2 = 1300
    // Total: 600 + 1300 = 1900
    expect(total).toBe(1900);
  });

  it('ignores invalid or non-existent variants gracefully', () => {
    const cart: CartItem[] = [
      { 
        product: { id: 'prod-2' }, 
        quantity: 1, 
        selectedVariants: { 'Size': 'Extra Large', 'Material': 'Cotton' } // Non-existent options/variants
      }
    ];
    
    const total = calculateCartTotal(cart, mockProducts);
    // Should fallback to base price since variants are invalid
    expect(total).toBe(500); 
  });

  it('handles missing product data gracefully by skipping item', () => {
    const cart: CartItem[] = [
      { product: { id: 'prod-1' }, quantity: 1, selectedVariants: {} },
      { product: { id: 'prod-unknown' }, quantity: 2, selectedVariants: {} }
    ];
    
    const total = calculateCartTotal(cart, mockProducts);
    // Only prod-1 is calculated
    expect(total).toBe(200);
  });

  it('calculates total correctly for item with min_order_quantity', () => {
    const productsWithMOQ: any[] = [
      { id: 'prod-samosa', price: 50, min_order_quantity: 10, variants: [] }
    ];
    const cart: CartItem[] = [
      { product: { id: 'prod-samosa' }, quantity: 15, selectedVariants: {} }
    ];
    const total = calculateCartTotal(cart, productsWithMOQ);
    expect(total).toBe(750); // 15 * 50
  });
});
