const INVOICE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInvoiceNumber() {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += INVOICE_CHARS[Math.floor(Math.random() * INVOICE_CHARS.length)];
  }
  return `HSW-${suffix}`;
}
