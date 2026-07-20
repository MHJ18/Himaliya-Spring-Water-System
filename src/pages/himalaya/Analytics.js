import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import MonthlyRevenueChart from '../../components/charts/MonthlyRevenueChart';
import DailySalesChart from '../../components/charts/DailySalesChart';
import BottlePieChart from '../../components/charts/BottlePieChart';
import CustomerGrowthChart from '../../components/charts/CustomerGrowthChart';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useCustomers } from '../../context/CustomerContext';
import { formatCurrency } from '../../utils/formatters';
import { exportSalesToCsv } from '../../utils/exportCsv';
import LoadingState from '../../components/LoadingState/LoadingState';

export default function Analytics() {
  const {
    loading,
    revenueThisMonth,
    bottlesSoldToday,
    activeCustomers,
    totalCustomers,
    monthlyRevenueChart,
    dailySalesChart,
    bottleDistribution,
    customerGrowth,
  } = useAnalytics();
  const { customers } = useCustomers();

  if (loading) {
    return <PageShell title="Analytics"><LoadingState label="Loading analytics..." variant="analytics" /></PageShell>;
  }

  const metrics = [
    { label: 'Monthly revenue', value: formatCurrency(revenueThisMonth), accent: '#32b5f5' },
    { label: 'Bottles today', value: bottlesSoldToday, accent: '#27c59a' },
    { label: 'Active customers', value: activeCustomers, accent: '#7b79f7' },
    { label: 'Total customers', value: totalCustomers, accent: '#f5a524' },
  ];

  return (
    <PageShell title="Analytics" subtitle="Sales performance, customer growth, and bottle distribution">
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadRoundedIcon />}
          onClick={() => {
            exportSalesToCsv(customers);
            toast.success('Sales CSV exported.');
          }}
        >
          Export sales CSV
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        {metrics.map((metric) => (
          <Grid item xs={12} sm={6} lg={3} key={metric.label}>
            <Card sx={{ height: '100%', borderTop: `3px solid ${metric.accent}` }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" fontWeight={700}>{metric.label}</Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 820, fontVariantNumeric: 'tabular-nums' }}>
                  {metric.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid item xs={12} lg={6}>
          <Widget title="Monthly revenue" fullscreen><MonthlyRevenueChart data={monthlyRevenueChart} /></Widget>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Widget title="Daily sales" fullscreen><DailySalesChart data={dailySalesChart} /></Widget>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Widget title="Bottle distribution" fullscreen><BottlePieChart data={bottleDistribution} /></Widget>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Widget title="Customer growth" fullscreen><CustomerGrowthChart data={customerGrowth} /></Widget>
        </Grid>
      </Grid>
    </PageShell>
  );
}
