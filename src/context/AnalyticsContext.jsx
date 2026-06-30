import React, { createContext, useContext, useMemo } from 'react';
import { useCustomers } from './CustomerContext';
import {
  getAllTransactions,
  filterTransactionsByPeriod,
  computePurchaseStats,
  getMonthlyRevenueData,
  getDailySalesData,
  getBottleDistribution,
  getCustomerGrowthData,
  getRecentTransactions,
  getActiveCustomersCount,
} from '../utils/analytics';

const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const { customers, loading } = useCustomers();

  const value = useMemo(() => {
    const allTx = getAllTransactions(customers);
    const todayTx = filterTransactionsByPeriod(allTx, 'daily');
    const monthTx = filterTransactionsByPeriod(allTx, 'monthly');
    const todayStats = computePurchaseStats(todayTx);
    const monthStats = computePurchaseStats(monthTx);
    return {
      loading,
      allTransactions: allTx,
      todayStats,
      monthStats,
      revenueThisMonth: monthStats.totalRevenue,
      bottlesSoldToday: todayStats.totalBottles,
      activeCustomers: getActiveCustomersCount(customers),
      totalCustomers: customers.length,
      monthlyRevenueChart: getMonthlyRevenueData(customers),
      dailySalesChart: getDailySalesData(customers),
      bottleDistribution: getBottleDistribution(customers),
      customerGrowth: getCustomerGrowthData(customers),
      recentTransactions: getRecentTransactions(customers),
      filterByPeriod: (period) =>
        computePurchaseStats(filterTransactionsByPeriod(allTx, period)),
    };
  }, [customers, loading]);

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics requires AnalyticsProvider');
  return ctx;
}
