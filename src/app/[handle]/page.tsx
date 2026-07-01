import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import StorefrontClient from './StorefrontClient';

export default async function PublicStorefront({ params }: { params: Promise<{ handle: string }> }) {
  const resolvedParams = await params;
  const decodedHandle = decodeURIComponent(resolvedParams.handle);
  const cleanHandle = decodedHandle.trim();

  // 1. Fetch vendor by exact handle or case-insensitive clean handle
  let { data: vendor, error } = await supabase
    .from('vendors')
    .select('*')
    .ilike('handle', cleanHandle)
    .maybeSingle();

  // 2. If not found, try matching with hyphens (e.g. crave-corner) or removed spaces (e.g. cravecorner)
  if (!vendor) {
    const hyphenHandle = cleanHandle.replace(/\s+/g, '-');
    const noSpaceHandle = cleanHandle.replace(/\s+/g, '');
    const { data: vendorRetry } = await supabase
      .from('vendors')
      .select('*')
      .or(`handle.ilike.${hyphenHandle},handle.ilike.${noSpaceHandle},handle.ilike.${cleanHandle}%`)
      .maybeSingle();
    vendor = vendorRetry || null;
  }

  console.log('--- STOREFRONT DEBUG ---');
  console.log('Raw Param:', resolvedParams.handle);
  console.log('Decoded Handle:', decodedHandle);
  console.log('Supabase Data:', vendor);
  console.log('Supabase Error:', error);

  if (!vendor) {
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
