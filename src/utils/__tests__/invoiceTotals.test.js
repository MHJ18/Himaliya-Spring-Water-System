import {
  normalizeInvoiceHistory,
  resolveInvoiceDocument,
  resolveInvoiceTotals,
} from '../invoiceTotals';

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

  it('subtracts payments captured at the time of sale from the invoice balance', () => {
    const totals = resolveInvoiceTotals({
      total_amount: 0,
      total_qty: 0,
      payload: {
        history: [
          { quantity: 2, pricePerBottle: 300, totalAmount: 600, amountPaid: 250 },
          { quantity: 1, pricePerBottle: 400, totalAmount: 400, amountPaid: 400 },
        ],
      },
    });

    expect(totals).toMatchObject({
      grossAmount: 1000,
      amountPaid: 650,
      totalAmount: 350,
      totalQty: 3,
    });
    expect(totals.history[0]).toMatchObject({
      grossAmount: 600,
      amountPaid: 250,
      balanceDue: 350,
    });
  });

  it('hydrates a legacy history-only invoice for every document renderer', () => {
    const document = resolveInvoiceDocument({
      invoice_number: 'HSW-LEGACY',
      total_amount: 0,
      total_qty: 0,
      payload: {
        history: [{ quantity: 3, pricePerBottle: 250, totalAmount: 0 }],
      },
    });

    expect(document.summary).toMatchObject({
      entryCount: 1,
      grossAmount: 750,
      amountPaid: 0,
      totalAmount: 750,
      totalQty: 3,
    });
    expect(document.payload.history[0]).toMatchObject({
      grossAmount: 750,
      amountPaid: 0,
      balanceDue: 750,
    });
  });

  it('preserves an intentional zero balance for a fully paid invoice', () => {
    const document = resolveInvoiceDocument({
      total_amount: 0,
      payload: {
        history: [{
          quantity: 1,
          pricePerBottle: 400,
          grossAmount: 400,
          amountPaid: 400,
          balanceDue: 0,
        }],
        summary: { totalAmount: 0 },
      },
    });

    expect(document.summary.totalAmount).toBe(0);
    expect(document.history[0].balanceDue).toBe(0);
  });

  it('normalizes saved payment terms and preserves legacy paid-line behavior', () => {
    const history = normalizeInvoiceHistory([
      { totalAmount: 600, amountPaid: 200, payment_schedule: 'monthly' },
      { totalAmount: 400, amountPaid: 400, paymentSchedule: 'on_delivery' },
      { totalAmount: 300, amountPaid: 100 },
      { totalAmount: 250, amountPaid: 0 },
    ]);

    expect(history.map((item) => item.paymentSchedule)).toEqual([
      'monthly',
      'on_delivery',
      'on_delivery',
      'monthly',
    ]);
  });
});
