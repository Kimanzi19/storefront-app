import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

const ProfileUpdateSchema = z.object({
  vendor_id: z.string().min(1),
  store_name: z.string().min(1),
  phone_number: z.string().min(1),
  handle: z.string().min(1)
});

const ProfileDeleteSchema = z.object({
  vendor_id: z.string().min(1)
});

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = ProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { vendor_id, store_name, phone_number, handle } = parsed.data;

    const { error } = await supabaseAdmin
      .from('vendors')
      .update({ store_name, phone_number, handle: handle.trim().toLowerCase() })
      .eq('id', vendor_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const parsed = ProfileDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { vendor_id } = parsed.data;

    // 1. Delete all products belonging to the vendor
    await supabaseAdmin.from('products').delete().eq('vendor_id', vendor_id);

    // 2. Delete all orders belonging to the vendor
    await supabaseAdmin.from('orders').delete().eq('vendor_id', vendor_id);

    // 3. Delete the vendor profile
    const { error: vendorError } = await supabaseAdmin.from('vendors').delete().eq('id', vendor_id);
    if (vendorError) throw vendorError;

    // 4. Delete the authentication user so they can register again with the same email
    if (supabaseAdmin.auth && supabaseAdmin.auth.admin) {
      await supabaseAdmin.auth.admin.deleteUser(vendor_id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
