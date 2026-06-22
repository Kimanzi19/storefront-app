import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vendor_id, customer_name, delivery_location, total_price, items_json } = body;

    const { data, error } = await supabase
      .from('orders')
      .insert([
        { vendor_id, customer_name, delivery_location, total_price, items_json, status: 'pending' }
      ]);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
