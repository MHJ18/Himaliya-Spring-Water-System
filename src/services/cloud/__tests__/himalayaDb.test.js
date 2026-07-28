describe('cloud customer records', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('does not return administrator identities as customer records', async () => {
    const dbRequest = jest.fn((path) => {
      if (path.startsWith('/customers?')) {
        return Promise.resolve([
          { id: 'customer-1', name: 'Customer', email: 'customer@example.com', auth_user_id: 'customer-auth', source: 'portal' },
          { id: 'admin-1', name: 'Admin', email: 'admin@example.com', auth_user_id: 'admin-auth', source: 'admin' },
        ]);
      }
      if (path.startsWith('/admin_profiles?')) {
        return Promise.resolve([{ auth_user_id: 'admin-auth', email: 'admin@example.com' }]);
      }
      if (path.startsWith('/customer_orders?')) {
        return Promise.resolve([{
          id: 'order-1',
          customer_id: 'customer-1',
          status: 'pending',
          bottle_type: '19L Gallon',
          quantity: 2,
          unit_price: 8,
          total_amount: 16,
          created_at: '2026-07-27T10:00:00.000Z',
        }]);
      }
      return Promise.resolve([]);
    });
    jest.doMock('../supabaseClient', () => ({
      dbRequest,
      isSupabaseConfigured: () => true,
    }));

    const { getCloudCustomers } = require('../himalayaDb');
    await expect(getCloudCustomers()).resolves.toEqual([
      expect.objectContaining({
        id: 'customer-1',
        name: 'Customer',
        orderCount: 1,
        purchaseHistory: [
          expect.objectContaining({
            orderId: 'order-1',
            recordType: 'customer_order',
            totalAmount: 16,
          }),
        ],
      }),
    ]);
  });
});

describe('portal order customer history', () => {
  const baseOrder = {
    id: 'order-1',
    status: 'accepted',
    created_at: '2026-07-27T10:00:00.000Z',
    notes: 'Front desk',
  };

  it('turns every portal order item into an invoice-ready ledger line', () => {
    const { toCustomerOrderHistory } = require('../himalayaDb');
    const history = toCustomerOrderHistory({
      ...baseOrder,
      items: [
        { bottleType: '19L Gallon', quantity: 2, unitPrice: 8 },
        { bottleType: '1.5L Bottle', quantity: 3, unitPrice: 1.5 },
      ],
    });

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      id: 'customer-order:order-1:0',
      orderId: 'order-1',
      recordType: 'customer_order',
      readOnly: true,
      bottleType: '19L Gallon',
      quantity: 2,
      pricePerBottle: 8,
      totalAmount: 16,
    });
    expect(history[1].totalAmount).toBe(4.5);
  });

  it('keeps a new pending order visible in the admin ledger', () => {
    const { toCustomerOrderHistory } = require('../himalayaDb');
    const history = toCustomerOrderHistory({
      ...baseOrder,
      status: 'pending',
      bottle_type: '19L Gallon',
      quantity: 4,
      unit_price: 7,
      total_amount: 28,
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      status: 'pending',
      quantity: 4,
      pricePerBottle: 7,
      totalAmount: 28,
    });
  });

  it.each(['canceled', 'rejected'])('does not invoice a %s order', (status) => {
    const { toCustomerOrderHistory } = require('../himalayaDb');
    expect(toCustomerOrderHistory({
      ...baseOrder,
      status,
      bottle_type: '19L Gallon',
      quantity: 1,
      unit_price: 8,
    })).toEqual([]);
  });
});
