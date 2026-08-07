import { buildSaleTransaction } from '../SalesContext';

const baseSale = {
  id: 'sale-1',
  date: '2026-08-07T10:00:00.000Z',
  bottleType: 'Gallon',
  quantity: 2,
  pricePerBottle: 300,
  notes: '',
};

describe('sale payment schedule semantics', () => {
  it('starts a monthly delivery with no daily payment', () => {
    expect(buildSaleTransaction({
      ...baseSale,
      paymentSchedule: 'monthly',
      amountPaid: 600,
    })).toMatchObject({
      totalAmount: 600,
      amountPaid: 0,
      amountDue: 600,
      paymentSchedule: 'monthly',
    });
  });

  it('keeps a payment captured for an on-delivery sale', () => {
    expect(buildSaleTransaction({
      ...baseSale,
      paymentSchedule: 'on_delivery',
      amountPaid: 250,
    })).toMatchObject({
      totalAmount: 600,
      amountPaid: 250,
      amountDue: 350,
      paymentSchedule: 'on_delivery',
    });
  });

  it('clamps an on-delivery payment to the sale total', () => {
    expect(buildSaleTransaction({
      ...baseSale,
      paymentSchedule: 'on_delivery',
      amountPaid: 900,
    })).toMatchObject({
      amountPaid: 600,
      amountDue: 0,
    });
  });
});
