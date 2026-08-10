import { generateInvoiceNumber } from '../invoiceNumber';

describe('generateInvoiceNumber', () => {
  it('creates high-entropy, URL-safe public invoice identifiers', () => {
    const first = generateInvoiceNumber();
    const second = generateInvoiceNumber();

    expect(first).toMatch(/^HSW-[0-9A-F]{32}$/);
    expect(second).not.toBe(first);
  });
});
