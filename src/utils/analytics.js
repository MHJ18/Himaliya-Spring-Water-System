import { BOTTLE_TYPES } from '../data/constants';

export function getAllTransactions(customers) {
  return (customers || []).flatMap((c) =>
    (c.purchaseHistory || []).map((t) => ({
      ...t,
      customerId: c.id,
      customerName: c.name,
    }))
  );
}

export function filterTransactionsByPeriod(transactions, period, ref = new Date()) {
  const end = new Date(ref);
  end.setHours(23, 59, 59, 999);
  return transactions.filter((t) => {
    const d = new Date(t.date);
    if (period === 'daily') {
      return d.toDateString() === end.toDateString();
    }
    if (period === 'weekly') {
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return d >= start && d <= end;
    }
    if (period === 'monthly') {
      return d.getMonth() === end.getMonth() && d.getFullYear() === end.getFullYear();
    }
    return true;
  });
}

export function computePurchaseStats(transactions) {
  const totalOrders = transactions.length;
  const totalBottles = transactions.reduce((s, t) => s + (t.quantity || 0), 0);
  const totalRevenue = transactions.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const byType = {};
  BOTTLE_TYPES.forEach((bt) => { byType[bt] = 0; });
  transactions.forEach((t) => {
    byType[t.bottleType] = (byType[t.bottleType] || 0) + (t.quantity || 0);
  });
  let mostPurchased = '—';
  let max = 0;
  Object.entries(byType).forEach(([type, qty]) => {
    if (qty > max) { max = qty; mostPurchased = type; }
  });
  return { totalOrders, totalBottles, totalRevenue, mostPurchased, byType };
}

export function getMonthlyRevenueData(customers, months = 6) {
  const tx = getAllTransactions(customers);
  const data = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
    const monthTx = tx.filter((t) => {
      const td = new Date(t.date);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    data.push({
      name: label,
      revenue: monthTx.reduce((s, t) => s + t.totalAmount, 0),
    });
  }
  return data;
}

export function getDailySalesData(customers, days = 14) {
  const tx = getAllTransactions(customers);
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const label = d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric' });
    const dayTx = tx.filter((t) => new Date(t.date).toDateString() === d.toDateString());
    data.push({ name: label, sales: dayTx.reduce((s, t) => s + t.totalAmount, 0) });
  }
  return data;
}

export function getBottleDistribution(customers) {
  const stats = computePurchaseStats(getAllTransactions(customers));
  return BOTTLE_TYPES.map((name) => ({
    name,
    value: stats.byType[name] || 0,
  })).filter((d) => d.value > 0);
}

export function getCustomerGrowthData(customers) {
  const sorted = [...(customers || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
  const byMonth = {};
  let cumulative = 0;
  sorted.forEach((c) => {
    const d = new Date(c.createdAt);
    const key = d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
    cumulative += 1;
    byMonth[key] = cumulative;
  });
  return Object.entries(byMonth).map(([name, customersCount]) => ({
    name,
    customers: customersCount,
  }));
}

export function getRecentTransactions(customers, limit = 8) {
  return getAllTransactions(customers)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

export function getActiveCustomersCount(customers, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const ids = new Set();
  getAllTransactions(customers).forEach((t) => {
    if (new Date(t.date) >= cutoff) ids.add(t.customerId);
  });
  return ids.size;
}
