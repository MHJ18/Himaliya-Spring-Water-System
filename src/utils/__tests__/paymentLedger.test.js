import { computePurchaseStats, getAllTransactions } from '../analytics';
import {
  buildCustomersCsv,
  buildEntryHistoryCsv,
  buildSalesCsv,
} from '../exportCsv';

const customers = [{
  id: 'customer-1',
  name: 'Test Customer',
  phone: '+923001234567',
  email: '',
  address: 'Sialkot',
  paymentSchedule: 'on_delivery',
  createdAt: '2026-07-29T09:00:00.000Z',
  purchaseHistory: [{
    id: 'sale-1',
    date: '2026-07-29T10:00:00.000Z',
    bottleType: 'Gallon',
    quantity: 2,
    pricePerBottle: 300,
    totalAmount: 600,
    amountPaid: 250,
    notes: 'Partial cash payment',
  }],
}];

describe('payment ledger analytics and exports', () => {
  it('separates gross sales, collected cash, and outstanding balance', () => {
    const transactions = getAllTransactions(customers);

    expect(transactions[0]).toMatchObject({
      totalAmount: 600,
      amountPaid: 250,
      amountDue: 350,
    });
    expect(computePurchaseStats(transactions)).toMatchObject({
      totalRevenue: 600,
      totalPaid: 250,
      totalDue: 350,
    });
  });

  it('includes payment schedule, paid amount, and balance in CSV exports', () => {
    const transactions = getAllTransactions(customers);
    const customerCsv = buildCustomersCsv(customers);
    const salesCsv = buildSalesCsv(customers);
    const historyCsv = buildEntryHistoryCsv(transactions);

    expect(customerCsv).toContain('"Payment Schedule"');
    expect(customerCsv).toContain('"On delivery"');
    expect(customerCsv).toContain('"600","250","350"');
    expect(salesCsv).toContain('"Amount Paid","Balance Due"');
    expect(salesCsv).toContain('"600","250","350"');
    expect(historyCsv).toContain('"Amount Paid","Balance Due"');
    expect(historyCsv).toContain('"600","250","350"');
  });
});
