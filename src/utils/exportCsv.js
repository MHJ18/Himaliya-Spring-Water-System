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

function paymentAmounts(transaction) {
  const total = Number(transaction && transaction.totalAmount) || 0;
  const paid = Math.min(
    total,
    Math.max(0, Number(transaction && transaction.amountPaid) || 0),
  );
  return { total, paid, due: Math.max(0, total - paid) };
}

export function buildCustomersCsv(customers) {
  const headers = [
    'ID',
    'Name',
    'Phone',
    'Email',
    'Address',
    'Payment Schedule',
    'Created At',
    'Sales Count',
    'Gross Sales',
    'Amount Paid',
    'Balance Due',
  ];
  const rows = customers.map((customer) => {
    const history = customer.purchaseHistory || [];
    const totals = history.reduce((summary, sale) => {
      const amounts = paymentAmounts(sale);
      return {
        total: summary.total + amounts.total,
        paid: summary.paid + amounts.paid,
        due: summary.due + amounts.due,
      };
    }, { total: 0, paid: 0, due: 0 });
    return [
      customer.id,
      customer.name,
      customer.phone,
      customer.email || '',
      customer.address,
      customer.paymentSchedule === 'on_delivery' ? 'On delivery' : 'Monthly',
      formatDate(customer.createdAt),
      history.length,
      totals.total,
      totals.paid,
      totals.due,
    ];
  });

  return rowsToCsv(headers, rows);
}

export function buildSalesCsv(customers) {
  const transactions = getAllTransactions(customers);
  const headers = [
    'Date',
    'Customer',
    'Phone',
    'Bottle Type',
    'Quantity',
    'Price',
    'Total',
    'Amount Paid',
    'Balance Due',
    'Notes',
  ];
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
      t.amountPaid,
      t.amountDue,
      t.notes || '',
    ];
  });

  return rowsToCsv(headers, rows);
}

export function buildEntryHistoryCsv(transactions) {
  const headers = [
    'Entry ID',
    'Date',
    'Customer',
    'Bottle Type',
    'Quantity',
    'Price',
    'Total',
    'Amount Paid',
    'Balance Due',
    'Notes',
  ];
  const rows = transactions.map((transaction) => {
    const amounts = paymentAmounts(transaction);
    return [
      transaction.id,
      formatDate(transaction.date),
      transaction.customerName || '',
      transaction.bottleType,
      transaction.quantity,
      transaction.pricePerBottle,
      amounts.total,
      amounts.paid,
      amounts.due,
      transaction.notes || '',
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

export function exportEntryHistoryToCsv(transactions) {
  downloadCsv(buildEntryHistoryCsv(transactions), `entry-history-${new Date().toISOString().slice(0, 10)}.csv`);
}
