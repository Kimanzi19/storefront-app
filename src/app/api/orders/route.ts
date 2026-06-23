import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateCartTotal, CartItem } from '@/lib/pricing';
import { z } from 'zod';

const CartItemSchema = z.object({
  product: z.object({ id: z.string().uuid() }).passthrough(),
  quantity: z.number().int().positive(),
  selectedVariants: z.record(z.string()).optional().default({})
});

const OrderPayloadSchema = z.object({
  vendor_id: z.string().uuid(),
  customer_name: z.string().min(1),
  delivery_location: z.string().min(1),
  total_price: z.number().nonnegative(),
  items_json: z.array(CartItemSchema).min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. Zod Validation
    const parsed = OrderPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { vendor_id, customer_name, delivery_location, items_json } = parsed.data;

    // 2. Fetch products securely to verify pricing
    const productIds = items_json.map(item => item.product.id);
    
    const { data: dbProducts, error: productsError } = await supabase
      .from('products')
      .select('id, price, variants')
      .in('id', productIds);

    if (productsError || !dbProducts) {
      throw new Error('Failed to fetch products for price verification');
    }

    // 3. Recalculate true price
    const trueTotalPrice = calculateCartTotal(items_json as CartItem[], dbProducts);

    // 4. Secure Insert using Admin client
    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert([
        { 
          vendor_id, 
          customer_name, 
          delivery_location, 
          total_price: trueTotalPrice, 
          items_json, 
          status: 'pending' 
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Order processing error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
