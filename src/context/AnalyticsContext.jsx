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
  getAllCollectionEvents,
  getCollectionTotal,
  getPaymentScheduleStats,
} from '../utils/analytics';

const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const { customers, loading } = useCustomers();

  const value = useMemo(() => {
    const allTx = getAllTransactions(customers);
    const allCollections = getAllCollectionEvents(customers);
    const todayTx = filterTransactionsByPeriod(allTx, 'daily');
    const monthTx = filterTransactionsByPeriod(allTx, 'monthly');
    const todayCollections = filterTransactionsByPeriod(allCollections, 'daily');
    const monthCollections = filterTransactionsByPeriod(allCollections, 'monthly');
    const todayStats = {
      ...computePurchaseStats(todayTx),
      totalCollected: getCollectionTotal(todayCollections),
    };
    const monthStats = {
      ...computePurchaseStats(monthTx),
      totalCollected: getCollectionTotal(monthCollections),
    };
    const allTimePaymentStats = getPaymentScheduleStats(allTx, allCollections);
    return {
      loading,
      allTransactions: allTx,
      allCollections,
      todayStats,
      monthStats,
      revenueThisMonth: monthStats.totalRevenue,
      collectedThisMonth: monthStats.totalCollected,
      outstandingThisMonth: monthStats.totalDue,
      monthlyAccountRevenue: allTimePaymentStats.monthlyRevenue,
      monthlyAccountCollected: allTimePaymentStats.monthlyCollected,
      dailyCashRevenue: allTimePaymentStats.dailyCashRevenue,
      dailyCashCollected: allTimePaymentStats.dailyCashCollected,
      bottlesSoldToday: todayStats.totalBottles,
      activeCustomers: getActiveCustomersCount(customers),
      totalCustomers: customers.length,
      monthlyRevenueChart: getMonthlyRevenueData(customers, 6, allCollections),
      dailySalesChart: getDailySalesData(customers, 14, allCollections),
      bottleDistribution: getBottleDistribution(customers),
      customerGrowth: getCustomerGrowthData(customers),
      recentTransactions: getRecentTransactions(customers),
      filterByPeriod: (period) => ({
        ...computePurchaseStats(filterTransactionsByPeriod(allTx, period)),
        totalCollected: getCollectionTotal(filterTransactionsByPeriod(allCollections, period)),
      }),
    };
  }, [customers, loading]);

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics requires AnalyticsProvider');
  return ctx;
}
