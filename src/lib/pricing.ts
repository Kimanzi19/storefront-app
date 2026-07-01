export interface VariantOption {
  name: string;
  price_adjustment?: number;
}

export interface Variant {
  name: string;
  options: (VariantOption | string)[];
}

export interface DBProduct {
  id: string;
  price: number;
  min_order_quantity?: number;
  variants?: Variant[];
}

export interface CartItem {
  product: { id: string; [key: string]: any };
  quantity: number;
  selectedVariants: Record<string, string>;
}

export function calculateCartTotal(cartItems: CartItem[], dbProducts: DBProduct[]): number {
  return cartItems.reduce((total, item) => {
    const dbProduct = dbProducts.find(p => p.id === item.product.id);
    if (!dbProduct) return total;

    let itemPrice = dbProduct.price;

    if (dbProduct.variants && item.selectedVariants) {
      for (const [variantName, selectedOptionName] of Object.entries(item.selectedVariants)) {
        const variantGroup = dbProduct.variants.find(v => v.name === variantName);
        if (variantGroup) {
          const option = variantGroup.options.find(o => {
            const optName = typeof o === 'string' ? o : o.name;
            return optName === selectedOptionName;
          });
          
          if (option && typeof option !== 'string' && option.price_adjustment) {
            itemPrice += option.price_adjustment;
          }
        }
      }
    }

    return total + (itemPrice * item.quantity);
  }, 0);
}
