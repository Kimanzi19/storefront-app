import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import StorefrontClient from './StorefrontClient';

export default async function PublicStorefront({ params }: { params: Promise<{ handle: string }> }) {
  const resolvedParams = await params;
  const decodedHandle = decodeURIComponent(resolvedParams.handle);

  // Fetch vendor by handle
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('handle', decodedHandle)
    .single();

  console.log('--- STOREFRONT DEBUG ---');
  console.log('Raw Param:', resolvedParams.handle);
  console.log('Decoded Handle:', decodedHandle);
  console.log('Supabase Data:', vendor);
  console.log('Supabase Error:', error);

  if (!vendor || error) {
    notFound();
  }

  // Fetch products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendor.id)
    .order('created_at', { ascending: false });

  return (
    <StorefrontClient vendor={vendor} initialProducts={products || []} />
  );
}
