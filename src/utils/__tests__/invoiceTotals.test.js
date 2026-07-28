import { normalizeInvoiceHistory, resolveInvoiceTotals } from '../invoiceTotals';

describe('invoice totals', () => {
  it('keeps an authoritative stored invoice total', () => {
    expect(resolveInvoiceTotals({
      total_amount: 1800,
      total_qty: 6,
      payload: { summary: { totalAmount: 1200, totalQty: 4 } },
    })).toMatchObject({ totalAmount: 1800, totalQty: 6 });
  });

  it('recovers legacy totals from the saved invoice summary', () => {
    expect(resolveInvoiceTotals({
      total_amount: 0,
      total_qty: 0,
      payload: { summary: { totalAmount: 1200, totalQty: 4 } },
    })).toMatchObject({ totalAmount: 1200, totalQty: 4 });
  });

  it('calculates legacy line totals from quantity and saved unit price', () => {
    const totals = resolveInvoiceTotals({
      total_amount: 0,
      total_qty: 0,
      payload: {
        history: [
          { quantity: 2, pricePerBottle: 300, totalAmount: 0 },
          { quantity: 1, unitPrice: 450 },
        ],
      },
    });
    expect(totals).toMatchObject({ totalAmount: 1050, totalQty: 3 });
  });

  it('normalizes invalid values without producing NaN', () => {
    expect(normalizeInvoiceHistory([
      { quantity: 'bad', pricePerBottle: 300 },
    ])[0]).toMatchObject({ quantity: 0, totalAmount: 0 });
  });
});
