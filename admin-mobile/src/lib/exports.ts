import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { Customer, Invoice, Sale } from '../types';

const money = (value: number) => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

export async function shareInvoicePdf(invoice: Invoice) {
  const p = invoice.payload || {}; const history = p.history || []; const summary = p.summary || {};
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#17213f;padding:32px}header{display:flex;justify-content:space-between;border-bottom:3px solid #2f80ed;padding-bottom:18px}.muted{color:#6b7890}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.summary{display:flex;gap:12px}.summary div{background:#eef5ff;padding:14px;flex:1;border-radius:10px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #dfe6f1;text-align:left}th{background:#0b1533;color:white}.total{text-align:right;font-size:24px;font-weight:bold;margin-top:24px}</style></head><body><header><div><h1>${esc(p.company?.name || 'Himaliya Spring Water')}</h1><div class="muted">${esc(p.company?.address || 'Sialkot Cantt')} · ${esc(p.company?.phone)}</div></div><div><b>INVOICE</b><h2>${esc(invoice.invoice_number)}</h2><div class="muted">${new Date(invoice.invoice_date).toLocaleDateString()}</div></div></header><div class="grid"><div><b>Bill to</b><h3>${esc(p.customer?.name)}</h3><div>${esc(p.customer?.phone)}</div><div>${esc(p.customer?.address)}</div></div><div><b>Prepared by</b><h3>${esc(p.preparedBy?.name)}</h3><div>${esc(p.preparedBy?.role)}</div><div>${esc(p.preparedBy?.email)}</div></div></div><div class="summary"><div>Entries<br><b>${summary.entryCount || history.length}</b></div><div>Quantity<br><b>${summary.totalQty || invoice.total_qty}</b></div><div>Total<br><b>${money(summary.totalAmount || invoice.total_amount)}</b></div></div><table><thead><tr><th>Date</th><th>Bottle</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${history.map((x: any) => `<tr><td>${new Date(x.date).toLocaleDateString()}</td><td>${esc(x.bottleType)}</td><td>${x.quantity}</td><td>${money(x.pricePerBottle)}</td><td>${money(x.totalAmount)}</td></tr>`).join('')}</tbody></table><div class="total">Amount due: ${money(summary.totalAmount || invoice.total_amount)}</div></body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoice.invoice_number}` });
  return uri;
}

export async function exportSalesCsv(customers: Customer[], sales: Sale[]) {
  const byId = new Map(customers.map(x => [x.id, x.name]));
  const csv = ['Date,Customer,Bottle Type,Quantity,Unit Price,Total,Notes', ...sales.map(x => [x.created_at, byId.get(x.customer_id) || '', x.bottle_type, x.quantity, x.price_per_bottle, x.total_amount, x.notes || ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  const uri = `${FileSystem.cacheDirectory}himaliya-sales-${Date.now()}.csv`; await FileSystem.writeAsStringAsync(uri, csv);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export sales CSV' });
}
