import {
  getAllCollectionEvents,
  getDailySalesData,
  getMonthToDateRevenueComparison,
  getMonthlyRevenueData,
  getPaymentScheduleStats,
} from '../analytics';

describe('month-to-date revenue comparison', () => {
  it('compares equal windows instead of a partial month with a complete month', () => {
    const result = getMonthToDateRevenueComparison([
      { date: '2026-08-02T10:00:00.000Z', totalAmount: 500 },
      { date: '2026-07-02T10:00:00.000Z', totalAmount: 250 },
      { date: '2026-07-20T10:00:00.000Z', totalAmount: 5000 },
    ], new Date('2026-08-07T12:00:00.000Z'));

    expect(result).toEqual({ current: 500, previous: 250, percentage: 100 });
  });

  it('uses the final day of a shorter previous month', () => {
    const result = getMonthToDateRevenueComparison([
      { date: '2026-03-31T10:00:00.000Z', totalAmount: 300 },
      { date: '2026-02-28T10:00:00.000Z', totalAmount: 200 },
    ], new Date('2026-03-31T12:00:00.000Z'));

    expect(result.previous).toBe(200);
  });

  it('ignores invalid dates and amounts', () => {
    expect(getMonthToDateRevenueComparison([
      { date: 'not-a-date', totalAmount: 900 },
      { date: '2026-08-01T10:00:00.000Z', totalAmount: 'bad' },
    ], new Date('2026-08-07T12:00:00.000Z'))).toEqual({
      current: 0,
      previous: 0,
      percentage: 0,
    });
  });
});

describe('collection event dates', () => {
  const customers = [{
    id: 'customer-1',
    name: 'Ayesha',
    paymentSchedule: 'monthly',
    collectionEvents: [{
      id: 'payment-1',
      amount: 250,
      receivedAt: '2026-08-03T09:00:00.000Z',
      paymentType: 'monthly',
    }],
    purchaseHistory: [{
      id: 'sale-1',
      date: '2026-07-20T10:00:00.000Z',
      bottleType: 'Gallon',
      quantity: 2,
      totalAmount: 600,
      amountPaid: 250,
      directAmountPaid: 0,
      paymentSchedule: 'monthly',
    }],
  }];

  it('groups ledger collections by received_at without moving revenue or outstanding', () => {
    const collections = getAllCollectionEvents(customers);
    const chart = getMonthlyRevenueData(
      customers,
      2,
      collections,
      new Date('2026-08-07T12:00:00.000Z'),
    );

    expect(chart[0]).toMatchObject({ revenue: 600, paid: 0, due: 350 });
    expect(chart[1]).toMatchObject({ revenue: 0, paid: 250, due: 0 });
  });

  it('shows a payment on its receipt day rather than the original sale day', () => {
    const collections = getAllCollectionEvents(customers);
    const chart = getDailySalesData(
      customers,
      2,
      collections,
      new Date('2026-08-03T12:00:00.000Z'),
    );

    expect(chart[0]).toMatchObject({ sales: 0, paid: 0, due: 0 });
    expect(chart[1]).toMatchObject({ sales: 0, paid: 250, due: 0 });
  });

  it('keeps monthly direct cash on the sale date and adds a later invoice receipt separately', () => {
    const monthlyCustomers = [{
      id: 'customer-legacy-monthly',
      name: 'Noor',
      paymentSchedule: 'monthly',
      collectionEvents: [{
        id: 'invoice-payment-1',
        amount: 300,
        receivedAt: '2026-08-03T09:00:00.000Z',
        paymentType: 'invoice',
      }],
      purchaseHistory: [{
        id: 'monthly-sale-1',
        date: '2026-07-20T10:00:00.000Z',
        totalAmount: 600,
        amountPaid: 400,
        directAmountPaid: 100,
        paymentSchedule: 'monthly',
      }],
    }];
    const collections = getAllCollectionEvents(monthlyCustomers);
    const chart = getMonthlyRevenueData(
      monthlyCustomers,
      2,
      collections,
      new Date('2026-08-07T12:00:00.000Z'),
    );

    expect(collections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'direct:monthly-sale-1',
        date: '2026-07-20T10:00:00.000Z',
        amount: 100,
        paymentSchedule: 'monthly',
        source: 'sale',
      }),
      expect.objectContaining({
        id: 'invoice-payment-1',
        date: '2026-08-03T09:00:00.000Z',
        amount: 300,
        paymentSchedule: 'monthly',
        source: 'ledger',
      }),
    ]));
    expect(collections).toHaveLength(2);
    expect(chart[0]).toMatchObject({ revenue: 600, paid: 100, due: 200 });
    expect(chart[1]).toMatchObject({ revenue: 0, paid: 300, due: 0 });
  });

  it('keeps on-delivery cash as a direct collection on the sale date', () => {
    const directCustomers = [{
      id: 'customer-2',
      name: 'Bilal',
      collectionEvents: [],
      purchaseHistory: [{
        id: 'sale-2',
        date: '2026-08-04T10:00:00.000Z',
        totalAmount: 400,
        amountPaid: 400,
        directAmountPaid: 400,
        paymentSchedule: 'on_delivery',
      }],
    }];
    const collections = getAllCollectionEvents(directCustomers);
    const stats = getPaymentScheduleStats([], collections);

    expect(collections).toEqual([
      expect.objectContaining({
        id: 'direct:sale-2',
        date: '2026-08-04T10:00:00.000Z',
        amount: 400,
        paymentSchedule: 'on_delivery',
      }),
    ]);
    expect(stats).toMatchObject({ monthlyCollected: 0, dailyCashCollected: 400 });
  });
});
