jest.mock('../../cloud/supabaseClient', () => ({
  dbRequest: jest.fn(),
  isSupabaseConfigured: jest.fn(() => true),
}));

const { dbRequest } = require('../../cloud/supabaseClient');
const { invoiceApi, rowToInvoice } = require('../invoiceApi');

describe('invoiceApi row totals', () => {
  it('uses legacy payload line prices when the table total is zero', () => {
    const result = rowToInvoice({
      id: 'invoice-1',
      invoice_number: 'HSW-OLD001',
      total_amount: 0,
      total_qty: 0,
      payload: {
        history: [{ quantity: 3, pricePerBottle: 250, totalAmount: 0 }],
      },
    });

    expect(result.totalAmount).toBe(750);
    expect(result.totalQty).toBe(3);
  });
});

describe('invoiceApi.createFromCustomer', () => {
  beforeEach(() => dbRequest.mockReset());

  it('stores only the unpaid balance as the invoice amount', async () => {
    dbRequest
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'invoice-payment-1',
        customer_id: 'customer-1',
        invoice_number: 'HSW-PAY001',
        invoice_date: '2026-07-29T00:00:00Z',
        total_amount: 350,
        total_qty: 3,
        payment_status: 'unpaid',
        payload: {},
      }]);

    await invoiceApi.createFromCustomer(
      { id: 'customer-1', name: 'Payment Test' },
      [
        { id: 'sale-1', quantity: 2, pricePerBottle: 300, totalAmount: 600, amountPaid: 250 },
        { id: 'sale-2', quantity: 1, pricePerBottle: 400, totalAmount: 400, amountPaid: 400 },
      ],
    );

    expect(dbRequest.mock.calls[1][0]).toBe('/rpc/create_customer_invoice');
    const requestBody = JSON.parse(dbRequest.mock.calls[1][1].body);
    expect(requestBody.p_total_amount).toBe(350);
    expect(requestBody.p_payload.summary).toMatchObject({
      grossAmount: 1000,
      amountPaid: 650,
      totalAmount: 350,
    });
  });

  it('excludes entries already claimed by a non-void invoice', async () => {
    dbRequest
      .mockResolvedValueOnce([{ source_key: 'sale-1' }])
      .mockResolvedValueOnce([{
        id: 'invoice-payment-2',
        customer_id: 'customer-1',
        invoice_number: 'HSW-PAY002',
        invoice_date: '2026-07-29T00:00:00Z',
        total_amount: 200,
        total_qty: 1,
        payment_status: 'unpaid',
        payload: {},
      }]);

    await invoiceApi.createFromCustomer(
      { id: 'customer-1', name: 'Payment Test' },
      [
        { id: 'sale-1', quantity: 2, pricePerBottle: 300, totalAmount: 600, amountPaid: 250 },
        { id: 'sale-2', quantity: 1, pricePerBottle: 300, totalAmount: 300, amountPaid: 100 },
      ],
    );

    expect(dbRequest.mock.calls[0][0]).toContain('released_at=is.null');
    const requestBody = JSON.parse(dbRequest.mock.calls[1][1].body);
    expect(requestBody.p_total_amount).toBe(200);
    expect(requestBody.p_payload.history).toEqual([
      expect.objectContaining({ id: 'sale-2', balanceDue: 200 }),
    ]);
  });

  it('rejects a zero-balance invoice before touching Supabase', async () => {
    await expect(invoiceApi.createFromCustomer(
      { id: 'customer-1', name: 'Payment Test' },
      [{
        id: 'sale-paid',
        quantity: 1,
        pricePerBottle: 400,
        totalAmount: 400,
        amountPaid: 400,
      }],
    )).rejects.toThrow(/no unpaid balance/i);

    expect(dbRequest).not.toHaveBeenCalled();
  });

  it('turns a concurrent source-claim conflict into an actionable error', async () => {
    dbRequest
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(Object.assign(
        new Error('customer_invoice_line_claims_active_source_idx'),
        { code: '23505' },
      ));

    await expect(invoiceApi.createFromCustomer(
      { id: 'customer-1', name: 'Payment Test' },
      [{
        id: 'sale-race',
        quantity: 1,
        pricePerBottle: 400,
        totalAmount: 400,
        amountPaid: 0,
      }],
    )).rejects.toThrow(/another active invoice/i);
  });

  it('fails safely when transactional invoice creation is not installed', async () => {
    dbRequest
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(Object.assign(
        new Error('function missing from schema cache'),
        { code: 'PGRST202' },
      ));

    await expect(invoiceApi.createFromCustomer(
      { id: 'customer-1', name: 'Payment Test' },
      [{
        id: 'sale-no-rpc',
        quantity: 1,
        pricePerBottle: 400,
        totalAmount: 400,
        amountPaid: 0,
      }],
    )).rejects.toThrow(/transactional invoice creation is not installed/i);

    expect(dbRequest).toHaveBeenCalledTimes(2);
    expect(dbRequest.mock.calls.some(([path]) => path === '/customer_invoices')).toBe(false);
  });

  it('turns a server-side balance mismatch into a refresh prompt', async () => {
    dbRequest
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(Object.assign(
        new Error('Invoice source sale-stale balance changed from 400 to 200'),
        { code: '23514' },
      ));

    await expect(invoiceApi.createFromCustomer(
      { id: 'customer-1', name: 'Payment Test' },
      [{
        id: 'sale-stale',
        quantity: 1,
        pricePerBottle: 400,
        totalAmount: 400,
        amountPaid: 0,
      }],
    )).rejects.toThrow(/balances changed.*refresh/i);
  });
});

describe('invoiceApi.lookupByNumber', () => {
  beforeEach(() => dbRequest.mockReset());

  it('falls back to the protected invoice table when the RPC is missing', async () => {
    dbRequest
      .mockRejectedValueOnce(Object.assign(new Error('function missing from schema cache'), { code: 'PGRST202' }))
      .mockResolvedValueOnce([{
        payload: { customer: { name: 'Test Customer' } },
        invoice_number: 'HSW-ABC123',
        invoice_date: '2026-06-28T00:00:00Z',
        total_amount: 1200,
        total_qty: 4,
      }]);

    const result = await invoiceApi.lookupByNumber('HSW-ABC123', { authenticatedFallback: true });

    expect(result.customer.name).toBe('Test Customer');
    expect(result.invoice_number).toBe('HSW-ABC123');
    expect(dbRequest).toHaveBeenCalledTimes(2);
  });

  it('does not expose the protected fallback to public invoice requests', async () => {
    const missingRpc = Object.assign(new Error('function missing from schema cache'), { code: 'PGRST202' });
    dbRequest.mockRejectedValueOnce(missingRpc);

    await expect(invoiceApi.lookupByNumber('HSW-ABC123')).rejects.toBe(missingRpc);
    expect(dbRequest).toHaveBeenCalledTimes(1);
  });
});

describe('invoiceApi transactional settlement', () => {
  beforeEach(() => dbRequest.mockReset());

  it('marks an invoice paid by number with one RPC and no source-row patches', async () => {
    dbRequest.mockResolvedValueOnce([{
      id: '03bf79a1-72a8-4f89-9cdf-d1c165454344',
      invoice_number: 'HSW-TXN001',
      payment_status: 'paid',
      total_amount: 350,
      total_qty: 2,
      payload: { history: [] },
    }]);

    const result = await invoiceApi.markAsPaid('HSW-TXN001');

    expect(result.paymentStatus).toBe('paid');
    expect(dbRequest).toHaveBeenCalledTimes(1);
    expect(dbRequest).toHaveBeenCalledWith('/rpc/set_customer_invoice_payment_status', {
      method: 'POST',
      body: JSON.stringify({
        p_invoice_id: null,
        p_invoice_number: 'HSW-TXN001',
        p_paid: true,
      }),
    });
  });

  it('marks an invoice unpaid by id through the same reversible RPC', async () => {
    const invoiceId = '03bf79a1-72a8-4f89-9cdf-d1c165454344';
    dbRequest.mockResolvedValueOnce([{
      id: invoiceId,
      invoice_number: 'HSW-TXN002',
      payment_status: 'unpaid',
      total_amount: 350,
      total_qty: 2,
      payload: { history: [] },
    }]);

    await invoiceApi.markAsUnpaid(invoiceId);

    expect(JSON.parse(dbRequest.mock.calls[0][1].body)).toEqual({
      p_invoice_id: invoiceId,
      p_invoice_number: null,
      p_paid: false,
    });
  });

  it('fails safely instead of falling back to non-transactional patches', async () => {
    dbRequest.mockRejectedValueOnce(Object.assign(
      new Error('function missing from schema cache'),
      { code: 'PGRST202' },
    ));

    await expect(invoiceApi.markAsPaid('HSW-TXN003')).rejects.toThrow(
      /transactional invoice settlement is not installed/i,
    );
    expect(dbRequest).toHaveBeenCalledTimes(1);
  });
});
