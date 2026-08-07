jest.mock('../../cloud/himalayaDb', () => ({
  deleteCloudSale: jest.fn(),
  getCloudCustomers: jest.fn(),
  saveCloudCustomers: jest.fn(),
}));

jest.mock('../../cloud/supabaseClient', () => ({
  adminDeleteCustomerAccount: jest.fn(),
  dbRequest: jest.fn(),
}));

const { dbRequest } = require('../../cloud/supabaseClient');
const { customerApi } = require('../customerApi');

describe('customerApi.recordMonthlyPayment', () => {
  beforeEach(() => dbRequest.mockReset());

  it('persists the payment and its source allocations in one RPC', async () => {
    dbRequest.mockResolvedValueOnce([{ id: 'payment-1', amount: 150 }]);
    const allocations = [
      { sourceKey: 'sale-1', sourceType: 'sale', amount: 100 },
      { sourceKey: 'customer-order:order-1:0', sourceType: 'customer_order', amount: 50 },
    ];

    await expect(customerApi.recordMonthlyPayment('customer-1', 150, allocations))
      .resolves.toEqual({ id: 'payment-1', amount: 150 });
    expect(dbRequest).toHaveBeenCalledWith('/rpc/record_customer_monthly_payment', {
      method: 'POST',
      body: JSON.stringify({
        p_customer_id: 'customer-1',
        p_amount: 150,
        p_allocations: allocations,
      }),
    });
  });

  it('does not fall back to source rewrites when the migration is missing', async () => {
    dbRequest.mockRejectedValueOnce(Object.assign(new Error('schema cache'), { code: 'PGRST202' }));

    await expect(customerApi.recordMonthlyPayment('customer-1', 50, []))
      .rejects.toThrow(/transactional payment allocation is not installed/i);
    expect(dbRequest).toHaveBeenCalledTimes(1);
  });
});
