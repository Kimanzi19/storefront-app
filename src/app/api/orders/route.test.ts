import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the DB clients
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({
      data: [
        { id: '770e8400-e29b-41d4-a716-446655440000', price: 100, variants: [] }
      ],
      error: null
    })
  }
}));

const mockSingle = vi.fn().mockResolvedValue({
  data: { id: 'order-1' },
  error: null
});

const mockSelect = vi.fn().mockReturnValue({
  single: mockSingle
});

const mockInsert = vi.fn().mockReturnValue({
  select: mockSelect
});

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: mockInsert
    }))
  }
}));

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects payload with invalid schema (HTTP 400)', async () => {
    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' })
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    console.log('400 DATA:', data);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('recalculates true total_price regardless of client payload', async () => {
    // Client tries to spoof price as 50 KES
    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        vendor_id: '550e8400-e29b-41d4-a716-446655440000',
        customer_name: 'John Doe',
        delivery_location: 'Nairobi',
        total_price: 50, 
        items_json: [
          { product: { id: '770e8400-e29b-41d4-a716-446655440000' }, quantity: 1, selectedVariants: {} }
        ]
      })
    });
    
    const response = await POST(request);
    expect(response.status).toBe(200);
    
    // The insert function should have been called with total_price = 100 (from DB mock)
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertArgs = mockInsert.mock.calls[0][0];
    expect(insertArgs[0].total_price).toBe(100);
    expect(insertArgs[0].total_price).not.toBe(50);
  });
});
