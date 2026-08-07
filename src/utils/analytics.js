import { BOTTLE_TYPES } from '../data/constants';

export function getAllTransactions(customers) {
  return (customers || []).flatMap((c) =>
    (c.purchaseHistory || []).map((t) => {
      const totalAmount = Number(t.totalAmount) || 0;
      const amountPaid = Math.min(
        totalAmount,
        Math.max(0, Number(t.amountPaid) || 0),
      );
      return {
        ...t,
        totalAmount,
        amountPaid,
        amountDue: Math.max(0, totalAmount - amountPaid),
        customerPaymentSchedule: c.paymentSchedule === 'on_delivery' ? 'on_delivery' : 'monthly',
        paymentSchedule: t.paymentSchedule === 'on_delivery' ? 'on_delivery' : (t.paymentSchedule === 'monthly' ? 'monthly' : (c.paymentSchedule === 'on_delivery' ? 'on_delivery' : 'monthly')),
        customerId: c.id,
        customerName: c.name,
      };
    })
  );
}

export function getAllCollectionEvents(customers) {
  return (customers || []).flatMap((customer) => {
    const hasLedgerEvents = Array.isArray(customer.collectionEvents);
    const ledgerEvents = (customer.collectionEvents || []).map((payment) => ({
      id: payment.id,
      date: payment.receivedAt || payment.received_at || payment.date,
      amount: Math.max(0, Number(payment.amount) || 0),
      paymentType: payment.paymentType || payment.payment_type || 'monthly',
      paymentSchedule: 'monthly',
      customerId: customer.id,
      customerName: customer.name,
      source: 'ledger',
    }));
    const directEvents = (customer.purchaseHistory || []).map((transaction) => {
      const totalAmount = Math.max(0, Number(transaction.totalAmount) || 0);
      const schedule = transaction.paymentSchedule === 'on_delivery'
        ? 'on_delivery'
        : 'monthly';
      const fallbackDirectAmount = schedule === 'on_delivery' || !hasLedgerEvents
        ? transaction.amountPaid
        : 0;
      const directAmount = Math.min(
        totalAmount,
        Math.max(0, Number(
          transaction.directAmountPaid === undefined
            ? fallbackDirectAmount
            : transaction.directAmountPaid,
        ) || 0),
      );
      if (directAmount <= 0) return null;
      return {
        id: `direct:${transaction.id}`,
        date: transaction.date,
        amount: directAmount,
        paymentType: 'direct',
        paymentSchedule: schedule,
        customerId: customer.id,
        customerName: customer.name,
        source: 'sale',
      };
    }).filter(Boolean);
    return [...ledgerEvents, ...directEvents]
      .filter((event) => event.amount > 0 && !Number.isNaN(new Date(event.date).getTime()));
  });
}

export function getCollectionTotal(collectionEvents) {
  return (collectionEvents || []).reduce(
    (sum, event) => sum + Math.max(0, Number(event && event.amount) || 0),
    0,
  );
}

export function getPaymentScheduleStats(transactions, collectionEvents = []) {
  const monthly = (transactions || []).filter((transaction) => transaction.paymentSchedule === 'monthly');
  const daily = (transactions || []).filter((transaction) => transaction.paymentSchedule === 'on_delivery');
  const monthlyCollections = (collectionEvents || []).filter(
    (event) => event.paymentSchedule !== 'on_delivery',
  );
  const dailyCollections = (collectionEvents || []).filter(
    (event) => event.paymentSchedule === 'on_delivery',
  );
  return {
    monthlyRevenue: monthly.reduce((sum, transaction) => sum + transaction.totalAmount, 0),
    monthlyCollected: getCollectionTotal(monthlyCollections),
    dailyCashRevenue: daily.reduce((sum, transaction) => sum + transaction.totalAmount, 0),
    dailyCashCollected: getCollectionTotal(dailyCollections),
  };
}

export function getMonthToDateRevenueComparison(transactions, referenceDate = new Date()) {
  const reference = new Date(referenceDate);
  if (Number.isNaN(reference.getTime())) {
    return { current: 0, previous: 0, percentage: 0 };
  }

  const currentStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const currentEnd = new Date(reference);
  currentEnd.setHours(23, 59, 59, 999);

  const previousStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const previousLastDay = new Date(
    previousStart.getFullYear(),
    previousStart.getMonth() + 1,
    0,
  ).getDate();
  const previousEnd = new Date(
    previousStart.getFullYear(),
    previousStart.getMonth(),
    Math.min(reference.getDate(), previousLastDay),
    23,
    59,
    59,
    999,
  );

  const totals = (transactions || []).reduce((result, transaction) => {
    const date = new Date(transaction && transaction.date);
    const revenue = Number(transaction && transaction.totalAmount) || 0;
    if (Number.isNaN(date.getTime()) || revenue <= 0) return result;
    if (date >= currentStart && date <= currentEnd) result.current += revenue;
    if (date >= previousStart && date <= previousEnd) result.previous += revenue;
    return result;
  }, { current: 0, previous: 0 });

  return {
    ...totals,
    percentage: totals.previous
      ? Math.round(((totals.current - totals.previous) / totals.previous) * 100)
      : totals.current ? 100 : 0,
  };
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
  const totalBottles = transactions.reduce((s, t) => s + (Number(t.quantity) || 0), 0);
  const totalRevenue = transactions.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);
  const totalPaid = transactions.reduce((s, t) => s + (Number(t.amountPaid) || 0), 0);
  const totalDue = Math.max(0, totalRevenue - totalPaid);
  const byType = {};
  BOTTLE_TYPES.forEach((bt) => { byType[bt] = 0; });
  transactions.forEach((t) => {
    byType[t.bottleType] = (byType[t.bottleType] || 0) + (Number(t.quantity) || 0);
  });
  let mostPurchased = '—';
  let max = 0;
  Object.entries(byType).forEach(([type, qty]) => {
    if (qty > max) { max = qty; mostPurchased = type; }
  });
  return {
    totalOrders,
    totalBottles,
    totalRevenue,
    totalPaid,
    totalDue,
    mostPurchased,
    byType,
  };
}

export function getMonthlyRevenueData(
  customers,
  months = 6,
  collectionEvents = getAllCollectionEvents(customers),
  referenceDate = new Date(),
) {
  const tx = getAllTransactions(customers);
  const data = [];
  const now = new Date(referenceDate);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
    const monthTx = tx.filter((t) => {
      const td = new Date(t.date);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    const monthCollections = (collectionEvents || []).filter((event) => {
      const received = new Date(event.date);
      return received.getMonth() === d.getMonth()
        && received.getFullYear() === d.getFullYear();
    });
    data.push({
      name: label,
      revenue: monthTx.reduce((s, t) => s + t.totalAmount, 0),
      paid: getCollectionTotal(monthCollections),
      due: monthTx.reduce((s, t) => s + t.amountDue, 0),
    });
  }
  return data;
}

export function getDailySalesData(
  customers,
  days = 14,
  collectionEvents = getAllCollectionEvents(customers),
  referenceDate = new Date(),
) {
  const tx = getAllTransactions(customers);
  const data = [];
  const now = new Date(referenceDate);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const label = d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric' });
    const dayTx = tx.filter((t) => new Date(t.date).toDateString() === d.toDateString());
    const dayCollections = (collectionEvents || []).filter(
      (event) => new Date(event.date).toDateString() === d.toDateString(),
    );
    data.push({
      name: label,
      sales: dayTx.reduce((s, t) => s + t.totalAmount, 0),
      paid: getCollectionTotal(dayCollections),
      due: dayTx.reduce((s, t) => s + t.amountDue, 0),
    });
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
