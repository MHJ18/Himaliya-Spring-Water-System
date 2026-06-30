jest.mock('../../cloud/supabaseClient', () => ({
  dbRequest: jest.fn(),
  isSupabaseConfigured: jest.fn(() => true),
}));

const { dbRequest } = require('../../cloud/supabaseClient');
const { invoiceApi } = require('../invoiceApi');

describe('invoiceApi.lookupByNumber', () => {
  beforeEach(() => dbRequest.mockReset());

  it('falls back to the protected invoice table when the RPC is missing', async () => {
    dbRequest
      .mockRejectedValueOnce(Object.assign(new Error('function missing from schema cache'), { code: 'PGRST202' }))
      .mockResolvedValueOnce([{
        payload: { customer: { name: 'Test Customer' } },
        invoice_number: 'HSW-ABC123',
        invoice_date: '2026-06-28T00:00:00Z',
        total_amount: 1200,
        total_qty: 4,
      }]);

    const result = await invoiceApi.lookupByNumber('HSW-ABC123', { authenticatedFallback: true });

    expect(result.customer.name).toBe('Test Customer');
    expect(result.invoice_number).toBe('HSW-ABC123');
    expect(dbRequest).toHaveBeenCalledTimes(2);
  });

  it('does not expose the protected fallback to public invoice requests', async () => {
    const missingRpc = Object.assign(new Error('function missing from schema cache'), { code: 'PGRST202' });
    dbRequest.mockRejectedValueOnce(missingRpc);

    await expect(invoiceApi.lookupByNumber('HSW-ABC123')).rejects.toBe(missingRpc);
    expect(dbRequest).toHaveBeenCalledTimes(1);
  });
});
