import {
  buildMonthlyPaymentPlan,
  normalizeCustomerEmail,
} from '../CustomerContext';

describe('customer payment planning', () => {
  it('allocates oldest monthly sales and delivered orders while excluding pay-on-delivery entries', () => {
    const plan = buildMonthlyPaymentPlan([
      {
        id: 'sale-monthly',
        recordType: 'sale',
        paymentSchedule: 'monthly',
        date: '2026-08-01T00:00:00Z',
        totalAmount: 150,
        amountPaid: 50,
      },
      {
        id: 'sale-door',
        recordType: 'sale',
        paymentSchedule: 'on_delivery',
        date: '2026-08-02T00:00:00Z',
        totalAmount: 500,
        amountPaid: 0,
      },
      {
        id: 'customer-order:03bf79a1-72a8-4f89-9cdf-d1c165454344:0',
        recordType: 'customer_order',
        paymentSchedule: 'monthly',
        date: '2026-08-03T00:00:00Z',
        totalAmount: 80,
        amountPaid: 0,
      },
      {
        id: 'customer-order:13bf79a1-72a8-4f89-9cdf-d1c165454344:0',
        recordType: 'customer_order',
        paymentSchedule: 'on_delivery',
        date: '2026-08-04T00:00:00Z',
        totalAmount: 90,
        amountPaid: 0,
      },
    ], 150);

    expect(plan.balance).toBe(180);
    expect(plan.allocations).toEqual([
      { sourceKey: 'sale-monthly', sourceType: 'sale', amount: 100 },
      {
        sourceKey: 'customer-order:03bf79a1-72a8-4f89-9cdf-d1c165454344:0',
        sourceType: 'customer_order',
        amount: 50,
      },
    ]);
  });

  it('normalizes nonblank emails for duplicate checks', () => {
    expect(normalizeCustomerEmail('  AYESHA@Example.COM ')).toBe('ayesha@example.com');
    expect(normalizeCustomerEmail('   ')).toBe('');
  });
});
