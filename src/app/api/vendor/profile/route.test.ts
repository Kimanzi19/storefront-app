import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT, DELETE } from './route';

const { mockEq, mockDelete, mockUpdate, mockDeleteUser } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null });
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  const mockDeleteUser = vi.fn().mockResolvedValue({ error: null });
  return { mockEq, mockDelete, mockUpdate, mockDeleteUser };
});

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      update: mockUpdate,
      delete: mockDelete
    })),
    auth: {
      admin: {
        deleteUser: mockDeleteUser
      }
    }
  }
}));

describe('PUT /api/vendor/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid profile update schema (HTTP 400)', async () => {
    const request = new NextRequest('http://localhost/api/vendor/profile', {
      method: 'PUT',
      body: JSON.stringify({ invalid: 'data' })
    });
    
    const response = await PUT(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it('updates store profile successfully (HTTP 200)', async () => {
    const request = new NextRequest('http://localhost/api/vendor/profile', {
      method: 'PUT',
      body: JSON.stringify({
        vendor_id: '550e8400-e29b-41d4-a716-446655440000',
        store_name: 'New Sweet Bakery',
        phone_number: '0712345678',
        handle: 'sweetbakery'
      })
    });
    
    const response = await PUT(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/vendor/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects deletion if vendor_id is missing (HTTP 400)', async () => {
    const request = new NextRequest('http://localhost/api/vendor/profile', {
      method: 'DELETE',
      body: JSON.stringify({})
    });
    
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it('deletes vendor products, orders, profile, and auth user cleanly (HTTP 200)', async () => {
    const vendorId = '550e8400-e29b-41d4-a716-446655440000';
    const request = new NextRequest('http://localhost/api/vendor/profile', {
      method: 'DELETE',
      body: JSON.stringify({ vendor_id: vendorId })
    });
    
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    
    // Check that delete was called for products, orders, and vendors
    expect(mockDelete).toHaveBeenCalledTimes(3);
    // Check that admin deleteUser was called with vendorId
    expect(mockDeleteUser).toHaveBeenCalledWith(vendorId);
  });
});
