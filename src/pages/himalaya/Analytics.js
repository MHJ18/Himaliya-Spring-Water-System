import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import { alpha } from '@mui/material/styles';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import CustomerGrowthChart from '../../components/charts/CustomerGrowthChart';
import {
  BottleMixChart,
  DailySalesTrendChart,
  MonthlyCollectionChart,
} from '../../components/charts/SalesOverviewCharts';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSettings } from '../../context/SettingsContext';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import { formatCurrency } from '../../utils/formatters';
import { exportSalesToCsv } from '../../utils/exportCsv';
import { getMonthToDateRevenueComparison } from '../../utils/analytics';
import LoadingState from '../../components/LoadingState/LoadingState';

function customerSalesSummary(customer) {
  const history = Array.isArray(customer.purchaseHistory) ? customer.purchaseHistory : [];
  return history.reduce((summary, sale) => ({
    orders: summary.orders + 1,
    bottles: summary.bottles + (Number(sale.quantity) || 0),
    revenue: summary.revenue + (Number(sale.totalAmount) || 0),
    paid: summary.paid + (Number(sale.amountPaid) || 0),
  }), {
    orders: 0, bottles: 0, revenue: 0, paid: 0,
  });
}

export default function Analytics() {
  const {
    loading,
    revenueThisMonth,
    collectedThisMonth,
    outstandingThisMonth,
    monthlyAccountRevenue,
    dailyCashRevenue,
    bottlesSoldToday,
    activeCustomers,
    totalCustomers,
    monthlyRevenueChart,
    dailySalesChart,
    bottleDistribution,
    customerGrowth,
    allTransactions,
  } = useAnalytics();
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const urdu = settings.language === 'ur';

  if (loading) {
    return <PageShell title="Analytics"><LoadingState label="Loading analytics..." variant="analytics" /></PageShell>;
  }

  const collectionRate = revenueThisMonth
    ? Math.min(100, Math.round((collectedThisMonth / revenueThisMonth) * 100))
    : 0;
  const activeRate = totalCustomers
    ? Math.min(100, Math.round((activeCustomers / totalCustomers) * 100))
    : 0;
  const monthToDateComparison = getMonthToDateRevenueComparison(allTransactions);
  const revenueChange = monthToDateComparison.percentage;
  const classifiedRevenue = monthlyAccountRevenue + dailyCashRevenue;
  const monthlyPlanShare = classifiedRevenue
    ? Math.round((monthlyAccountRevenue / classifiedRevenue) * 100)
    : 0;
  const topCustomers = customers
    .map((customer) => ({ customer, ...customerSalesSummary(customer) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const recentDue = [...allTransactions]
    .filter((transaction) => Number(transaction.amountDue) > 0)
    .sort((a, b) => Number(b.amountDue) - Number(a.amountDue))
    .slice(0, 6);
  const metrics = [
    {
      label: urdu ? 'ماہانہ آمدنی' : 'Monthly revenue',
      value: formatCurrency(revenueThisMonth),
      detail: revenueThisMonth || monthToDateComparison.previous
        ? `${revenueChange >= 0 ? '+' : ''}${revenueChange}% ${urdu ? 'گزشتہ ماہ کے اسی دن تک' : 'vs the same point last month'}`
        : (urdu ? 'اس ماہ کوئی آمدنی درج نہیں ہوئی' : 'No revenue recorded this month'),
      color: revenueChange < 0 ? '#e65b6a' : '#2488ff',
      icon: revenueChange < 0 ? TrendingDownRoundedIcon : TrendingUpRoundedIcon,
    },
    {
      label: urdu ? 'وصولی کی شرح' : 'Collection rate',
      value: `${collectionRate}%`,
      detail: `${formatCurrency(collectedThisMonth)} ${urdu ? 'وصول شدہ' : 'collected this month'}`,
      color: '#10a979',
      icon: PaymentsRoundedIcon,
      progress: collectionRate,
    },
    {
      label: urdu ? 'بقایا رقم' : 'Outstanding balance',
      value: formatCurrency(outstandingThisMonth),
      detail: urdu ? 'اس ماہ کی فروخت سے وصول کرنا ہے' : 'To collect from this month’s sales',
      color: '#ef8a28',
      icon: AccountBalanceWalletRoundedIcon,
    },
    {
      label: urdu ? 'آج کی بوتلیں' : 'Bottles today',
      value: bottlesSoldToday.toLocaleString(),
      detail: urdu ? 'آج کی درج شدہ فروخت' : 'Recorded sales today',
      color: '#10a979',
      icon: WaterDropRoundedIcon,
    },
    {
      label: urdu ? 'فعال صارفین' : 'Active customers',
      value: `${activeCustomers}/${totalCustomers}`,
      detail: `${activeRate}% ${urdu ? 'گزشتہ 30 دن میں فعال' : 'active in the last 30 days'}`,
      color: '#7c62ff',
      icon: Groups2RoundedIcon,
      progress: activeRate,
    },
    {
      label: urdu ? 'ادائیگی کا انداز' : 'Payment model mix',
      value: classifiedRevenue ? `${monthlyPlanShare}% ${urdu ? 'ماہانہ' : 'monthly plans'}` : '—',
      detail: classifiedRevenue
        ? `${urdu ? 'مجموعی' : 'All-time'}: ${formatCurrency(monthlyAccountRevenue)} ${urdu ? 'ماہانہ' : 'plans'} · ${formatCurrency(dailyCashRevenue)} ${urdu ? 'روزانہ' : 'on delivery'}`
        : (urdu ? 'ابھی ادائیگی کا ڈیٹا موجود نہیں' : 'No classified payment data yet'),
      color: '#a855f7',
      icon: CalendarMonthRoundedIcon,
    },
  ];

  return (
    <PageShell
      title="Analytics"
      subtitle="Sales performance, customer growth, and bottle distribution"
      actions={(
        <Button
          variant="outlined"
          startIcon={<DownloadRoundedIcon />}
          sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 42 }}
          onClick={() => {
            exportSalesToCsv(customers);
            toast.success('Sales CSV exported.');
          }}
        >
          {urdu ? 'سیلز CSV ڈاؤن لوڈ' : 'Export sales CSV'}
        </Button>
      )}
    >
      <Grid container spacing={{ xs: 1.5, sm: 2.25 }}>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Grid item xs={12} sm={6} lg={4} key={metric.label}>
              <Card
                sx={{
                  height: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  borderColor: alpha(metric.color, 0.18),
                  '@media (prefers-reduced-motion: no-preference)': {
                    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      borderColor: alpha(metric.color, 0.38),
                      boxShadow: 5,
                    },
                  },
                }}
              >
                <CardContent sx={{ minHeight: { xs: 132, sm: 142 }, p: { xs: 2, sm: 2.25 } }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" color="text.secondary" fontWeight={750}>{metric.label}</Typography>
                      <Typography
                        variant="h4"
                        sx={{
                          mt: 0.75,
                          fontSize: 'clamp(1.35rem, 2.4vw, 1.9rem)',
                          fontWeight: 880,
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1.2,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {metric.value}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.45, lineHeight: 1.35, overflowWrap: 'anywhere' }}
                      >
                        {metric.detail}
                      </Typography>
                    </Box>
                    <Box sx={{
                      display: 'grid',
                      width: 40,
                      height: 40,
                      flex: '0 0 40px',
                      placeItems: 'center',
                      color: metric.color,
                      bgcolor: alpha(metric.color, 0.11),
                      borderRadius: 2,
                    }}
                    >
                      <Icon />
                    </Box>
                  </Stack>
                </CardContent>
                <Box sx={{ height: 4, bgcolor: alpha(metric.color, 0.12) }}>
                  <Box
                    sx={{
                      width: `${metric.progress === undefined ? 100 : metric.progress}%`,
                      height: '100%',
                      bgcolor: metric.color,
                      '@media (prefers-reduced-motion: no-preference)': {
                        transition: 'width 500ms cubic-bezier(.22, 1, .36, 1)',
                      },
                    }}
                  />
                </Box>
              </Card>
            </Grid>
          );
        })}

        <Grid item xs={12} lg={7}>
          <Widget title={urdu ? 'روزانہ فروخت کا رجحان' : 'Daily sales trend'} fullscreen>
            <DailySalesTrendChart data={dailySalesChart} />
          </Widget>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Widget title={urdu ? 'وصولی بمقابلہ بقایا' : 'Collections vs outstanding'} fullscreen>
            <MonthlyCollectionChart data={monthlyRevenueChart} />
          </Widget>
        </Grid>
        <Grid item xs={12} md={6}>
          <Widget title={urdu ? 'بوتلوں کی تقسیم' : 'Bottle distribution'} fullscreen>
            <BottleMixChart
              data={bottleDistribution.map((item) => ({
                ...item,
                label: BOTTLE_TYPE_LABELS[item.name] || item.name,
              }))}
            />
          </Widget>
        </Grid>
        <Grid item xs={12} md={6}>
          <Widget title={urdu ? 'صارفین کی ترقی' : 'Customer growth'} fullscreen>
            <CustomerGrowthChart data={customerGrowth} />
          </Widget>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1}
                sx={{ mb: 1.5 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5">{urdu ? 'بہترین صارفین' : 'Top customers'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {urdu ? 'درج شدہ آمدنی اور بوتلوں کے حساب سے' : 'Ranked by recorded revenue and bottle volume'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={urdu ? `${customers.length} صارفین` : `${customers.length} customers`}
                />
              </Stack>
              <TableContainer sx={{ maxWidth: '100%' }}>
                <Table size="small" aria-label={urdu ? 'بہترین صارفین' : 'Top customers'} sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{urdu ? 'صارف' : 'Customer'}</TableCell>
                      <TableCell align="right">{urdu ? 'آرڈرز' : 'Orders'}</TableCell>
                      <TableCell align="right">{urdu ? 'بوتلیں' : 'Bottles'}</TableCell>
                      <TableCell align="right">{urdu ? 'آمدنی' : 'Revenue'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topCustomers.map((row, index) => (
                      <TableRow key={row.customer.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar src={row.customer.photo || getCustomerAvatar(index)} sx={{ width: 32, height: 32 }} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={800} noWrap>{row.customer.name}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>{row.customer.phone || row.customer.email}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{row.orders}</TableCell>
                        <TableCell align="right">{row.bottles}</TableCell>
                        <TableCell align="right"><strong>{formatCurrency(row.revenue)}</strong></TableCell>
                      </TableRow>
                    ))}
                    {!topCustomers.length && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          {urdu ? 'ابھی صارفین کی فروخت موجود نہیں۔' : 'No customer sales recorded yet.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Typography variant="h5">{urdu ? 'ادائیگی کی صحت' : 'Payment health'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {urdu ? 'بڑی بقایا فروخت پہلے دکھائی گئی ہے' : 'Largest outstanding sales shown first'}
              </Typography>
              <Box sx={{ mt: 2, mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
                  <Typography variant="caption" fontWeight={800}>{collectionRate}% collected</Typography>
                  <Typography variant="caption" color="text.secondary">{formatCurrency(outstandingThisMonth)} due</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={collectionRate}
                  color={collectionRate >= 75 ? 'success' : 'warning'}
                  aria-label={`${collectionRate}% ${urdu ? 'وصول شدہ' : 'collected'}`}
                  sx={{ height: 8, borderRadius: 99 }}
                />
              </Box>
              <Stack spacing={1}>
                {recentDue.map((sale) => (
                  <Box
                    key={sale.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      p: 1.1,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={800} noWrap>{sale.customerName}</Typography>
                      <Typography variant="caption" color="text.secondary">{BOTTLE_TYPE_LABELS[sale.bottleType] || sale.bottleType} × {sale.quantity}</Typography>
                    </Box>
                    <Chip size="small" color="warning" label={formatCurrency(sale.amountDue)} />
                  </Box>
                ))}
                {!recentDue.length && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    {urdu ? 'کوئی بقایا فروخت نہیں۔' : 'No outstanding sales.'}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </PageShell>
  );
}
