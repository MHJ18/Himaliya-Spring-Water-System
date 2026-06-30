import { formatDate } from './formatters';
import { getAllTransactions } from './analytics';

function escapeCsvCell(cell) {
  return `"${String(cell === undefined || cell === null ? '' : cell).replace(/"/g, '""')}"`;
}

function rowsToCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function buildCustomersCsv(customers) {
  const headers = ['ID', 'Name', 'Phone', 'Email', 'Address', 'Created At', 'Sales Count', 'Total Spent'];
  const rows = customers.map((customer) => {
    const history = customer.purchaseHistory || [];
    const totalSpent = history.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
    return [
      customer.id,
      customer.name,
      customer.phone,
      customer.email || '',
      customer.address,
      formatDate(customer.createdAt),
      history.length,
      totalSpent,
    ];
  });

  return rowsToCsv(headers, rows);
}

export function buildSalesCsv(customers) {
  const transactions = getAllTransactions(customers);
  const headers = ['Date', 'Customer', 'Phone', 'Bottle Type', 'Quantity', 'Price', 'Total', 'Notes'];
  const rows = transactions.map((t) => {
    const c = customers.find((x) => x.id === t.customerId) || {};
    return [
      formatDate(t.date),
      t.customerName || c.name || '',
      c.phone || '',
      t.bottleType,
      t.quantity,
      t.pricePerBottle,
      t.totalAmount,
      t.notes || '',
    ];
  });

  return rowsToCsv(headers, rows);
}

export function exportSalesToCsv(customers) {
  downloadCsv(buildSalesCsv(customers), `sales-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportCustomersToCsv(customers) {
  downloadCsv(buildCustomersCsv(customers), `customers-${new Date().toISOString().slice(0, 10)}.csv`);
}
