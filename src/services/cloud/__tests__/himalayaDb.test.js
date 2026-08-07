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
          status: 'delivered',
          bottle_type: '19L Gallon',
          quantity: 2,
          unit_price: 8,
          total_amount: 16,
          created_at: '2026-07-27T10:00:00.000Z',
          delivered_at: '2026-07-28T10:00:00.000Z',
        }]);
      }
      if (path.startsWith('/customer_billing_profiles?')) {
        return Promise.resolve([{
          customer_id: 'customer-1',
          payment_schedule: 'on_delivery',
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
        paymentSchedule: 'on_delivery',
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

  it('maps collected and outstanding amounts from manual sales', async () => {
    const dbRequest = jest.fn((path) => {
      if (path.startsWith('/customers?')) {
        return Promise.resolve([{
          id: 'customer-1',
          name: 'Customer',
          phone: '+923001234567',
          created_at: '2026-07-27T09:00:00.000Z',
        }]);
      }
      if (path.startsWith('/sales?')) {
        return Promise.resolve([{
          id: 'sale-1',
          customer_id: 'customer-1',
          bottle_type: 'Gallon',
          quantity: 2,
          price_per_bottle: 300,
          total_amount: 600,
          amount_paid: 250,
          created_at: '2026-07-27T10:00:00.000Z',
        }]);
      }
      if (path.startsWith('/customer_billing_profiles?')) {
        return Promise.resolve([{
          customer_id: 'customer-1',
          payment_schedule: 'monthly',
        }]);
      }
      return Promise.resolve([]);
    });
    jest.doMock('../supabaseClient', () => ({
      dbRequest,
      isSupabaseConfigured: () => true,
    }));

    const { getCloudCustomers } = require('../himalayaDb');
    const result = await getCloudCustomers();

    expect(result[0]).toMatchObject({
      paymentSchedule: 'monthly',
      purchaseHistory: [
        expect.objectContaining({
          id: 'sale-1',
          totalAmount: 600,
          amountPaid: 250,
          amountDue: 350,
        }),
      ],
    });
  });

  it('exposes only applied payment events with their receipt timestamps', async () => {
    const dbRequest = jest.fn((path) => {
      if (path.startsWith('/customers?')) {
        return Promise.resolve([{
          id: 'customer-1',
          name: 'Customer',
          phone: '+923001234567',
          created_at: '2026-07-27T09:00:00.000Z',
        }]);
      }
      if (path.startsWith('/customer_payments?')) {
        return Promise.resolve([{
          id: 'payment-1',
          customer_id: 'customer-1',
          payment_type: 'monthly',
          amount: 350,
          received_at: '2026-08-03T11:30:00.000Z',
        }]);
      }
      return Promise.resolve([]);
    });
    jest.doMock('../supabaseClient', () => ({
      dbRequest,
      isSupabaseConfigured: () => true,
    }));

    const { getCloudCustomers } = require('../himalayaDb');
    const result = await getCloudCustomers();

    expect(result[0].collectionEvents).toEqual([{
      id: 'payment-1',
      amount: 350,
      receivedAt: '2026-08-03T11:30:00.000Z',
      paymentType: 'monthly',
    }]);
    expect(dbRequest).toHaveBeenCalledWith(
      expect.stringContaining('/customer_payments?status=eq.applied'),
    );
  });

  it('keeps customers visible while the billing-profile migration is unavailable', async () => {
    const dbRequest = jest.fn((path) => {
      if (path.startsWith('/customers?')) {
        return Promise.resolve([{
          id: 'customer-1',
          name: 'Visible Customer',
          phone: '+923001234567',
          created_at: '2026-07-27T09:00:00.000Z',
        }]);
      }
      if (path.startsWith('/customer_billing_profiles?')) {
        return Promise.reject(Object.assign(
          new Error("Could not find the table 'public.customer_billing_profiles' in the schema cache"),
          { code: 'PGRST205' },
        ));
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
        name: 'Visible Customer',
        paymentSchedule: 'monthly',
      }),
    ]);
  });

  it('persists billing schedules and paid amounts with customer data', async () => {
    const dbRequest = jest.fn(() => Promise.resolve([]));
    jest.doMock('../supabaseClient', () => ({
      dbRequest,
      isSupabaseConfigured: () => true,
    }));

    const { saveCloudCustomers } = require('../himalayaDb');
    await saveCloudCustomers([{
      id: 'customer-1',
      name: 'Customer',
      phone: '+923001234567',
      address: 'Sialkot',
      paymentSchedule: 'on_delivery',
      createdAt: '2026-07-27T09:00:00.000Z',
      purchaseHistory: [{
        id: 'sale-1',
        date: '2026-07-27T10:00:00.000Z',
        bottleType: 'Gallon',
        quantity: 2,
        pricePerBottle: 300,
        totalAmount: 600,
        amountPaid: 400,
      }],
    }]);

    const billingCall = dbRequest.mock.calls.find(([path]) => (
      path.startsWith('/customer_billing_profiles?')
    ));
    const salesCall = dbRequest.mock.calls.find(([path]) => path.startsWith('/sales?'));

    expect(JSON.parse(billingCall[1].body)[0]).toMatchObject({
      customer_id: 'customer-1',
      payment_schedule: 'on_delivery',
    });
    expect(JSON.parse(salesCall[1].body)[0]).toMatchObject({
      id: 'sale-1',
      total_amount: 600,
      amount_paid: 400,
    });
  });
});

describe('portal order customer history', () => {
  const baseOrder = {
    id: 'order-1',
    status: 'delivered',
    created_at: '2026-07-27T10:00:00.000Z',
    delivered_at: '2026-07-28T10:00:00.000Z',
    notes: 'Front desk',
  };

  it('turns every delivered portal order item into an invoice-ready ledger line', () => {
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
      date: '2026-07-28T10:00:00.000Z',
      bottleType: '19L Gallon',
      quantity: 2,
      pricePerBottle: 8,
      totalAmount: 16,
    });
    expect(history[1].totalAmount).toBe(4.5);
  });

  it('applies persisted allocations to delivered order lines without changing their totals', () => {
    const { toCustomerOrderHistory } = require('../himalayaDb');
    const allocations = new Map([
      ['customer-order:order-1:0', 10],
    ]);
    const history = toCustomerOrderHistory({
      ...baseOrder,
      items: [{ bottleType: '19L Gallon', quantity: 2, unitPrice: 8 }],
    }, allocations, 'monthly');

    expect(history[0]).toMatchObject({
      totalAmount: 16,
      amountPaid: 10,
      amountDue: 6,
      paymentSchedule: 'monthly',
    });
  });

  it('keeps pay-on-delivery customer orders out of monthly payment planning', () => {
    const { toCustomerOrderHistory } = require('../himalayaDb');
    const history = toCustomerOrderHistory({
      ...baseOrder,
      items: [{ bottleType: '19L Gallon', quantity: 2, unitPrice: 8 }],
    }, new Map(), 'on_delivery');

    expect(history[0].paymentSchedule).toBe('on_delivery');
  });

  it('uses the order terms snapshot instead of retroactively applying current customer terms', () => {
    const { toCustomerOrderHistory } = require('../himalayaDb');
    const history = toCustomerOrderHistory({
      ...baseOrder,
      payment_schedule: 'monthly',
      items: [{ bottleType: '19L Gallon', quantity: 1, unitPrice: 8 }],
    }, new Map(), 'on_delivery');

    expect(history[0].paymentSchedule).toBe('monthly');
  });

  it('keeps a new pending order out of the billable sales ledger', () => {
    const { toCustomerOrderHistory } = require('../himalayaDb');
    const history = toCustomerOrderHistory({
      ...baseOrder,
      status: 'pending',
      bottle_type: '19L Gallon',
      quantity: 4,
      unit_price: 7,
      total_amount: 28,
    });

    expect(history).toEqual([]);
  });

  it('uses confirmed delivered quantities instead of the original order quantity', () => {
    const { toCustomerOrderHistory } = require('../himalayaDb');
    const history = toCustomerOrderHistory({
      ...baseOrder,
      items: [{ bottleType: '19L Gallon', quantity: 4, unitPrice: 8 }],
      delivered_items: [{ bottleType: '19L Gallon', quantity: 2 }],
    });

    expect(history).toEqual([
      expect.objectContaining({
        quantity: 2,
        pricePerBottle: 8,
        totalAmount: 16,
      }),
    ]);
  });

  it.each(['pending', 'accepted', 'canceled', 'rejected'])('does not invoice a %s order', (status) => {
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
