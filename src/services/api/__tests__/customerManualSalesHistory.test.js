jest.mock('../../cloud/supabaseClient', () => ({
  dbRequest: jest.fn(),
  getStoredSession: jest.fn(() => ({ user: { id: 'customer-auth-1' } })),
  isSupabaseConfigured: jest.fn(() => true),
}));

const { dbRequest } = require('../../cloud/supabaseClient');
const { getCustomerManualSalesHistory } = require('../customerPortalApi');

describe('customer manual sales history', () => {
  beforeEach(() => dbRequest.mockReset());

  it('uses only the customer-scoped RPC and maps sanitized delivery rows', async () => {
    dbRequest.mockResolvedValueOnce([{
      id: 'manual-sale-1',
      bottle_type: 'Gallon',
      quantity: 3,
      price_per_bottle: 300,
      total_amount: 900,
      amount_paid: 500,
      balance_due: 400,
      payment_schedule: 'monthly',
      notes: 'Reception delivery',
      created_at: '2026-07-01T10:00:00Z',
    }]);

    const rows = await getCustomerManualSalesHistory();

    expect(dbRequest).toHaveBeenCalledTimes(1);
    expect(dbRequest).toHaveBeenCalledWith('/rpc/get_customer_manual_sales_history', {
      method: 'POST',
      body: '{}',
    });
    expect(dbRequest.mock.calls[0][0]).not.toBe('/sales');
    expect(rows).toEqual([expect.objectContaining({
      id: 'manual-sale-1',
      recordType: 'manual_sale',
      bottleType: 'Gallon',
      quantity: 3,
      totalAmount: 900,
      amountPaid: 500,
      balanceDue: 400,
      paymentSchedule: 'monthly',
      createdAt: '2026-07-01T10:00:00Z',
    })]);
    expect(rows[0]).not.toHaveProperty('ownerId');
    expect(rows[0]).not.toHaveProperty('customerId');
    expect(rows[0]).not.toHaveProperty('notes');
  });

  it('fails closed instead of falling back to broad sales reads', async () => {
    dbRequest.mockRejectedValueOnce(Object.assign(
      new Error('function missing from schema cache'),
      { code: 'PGRST202' },
    ));

    await expect(getCustomerManualSalesHistory()).rejects.toThrow(
      /customer delivery history is not installed/i,
    );
    expect(dbRequest).toHaveBeenCalledTimes(1);
    expect(dbRequest.mock.calls.some(([path]) => String(path).startsWith('/sales'))).toBe(false);
  });
});
