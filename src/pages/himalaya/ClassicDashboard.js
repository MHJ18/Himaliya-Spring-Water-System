import React from 'react';
import { Link } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ShoppingCartCheckoutRoundedIcon from '@mui/icons-material/ShoppingCartCheckoutRounded';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PointOfSaleRoundedIcon from '@mui/icons-material/PointOfSaleRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { motion, useReducedMotion } from 'motion/react';
import CustomerMap from '../dashboard/components/customer-map/CustomerMap';
import {
  DailySalesTrendChart,
  MonthlyCollectionChart,
} from '../../components/charts/SalesOverviewCharts';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/formatters';
import { getAdminCustomerPortalStats } from '../../services/api/customerPortalApi';
import { ADMIN_AVATAR } from '../../utils/customerPhotos';
import LoadingState from '../../components/LoadingState/LoadingState';
import PageShell from '../../components/PageShell/PageShell';
import { responsiveTableContainerSx } from '../../components/tables/tableStyles';

const statCards = [
  {
    key: 'revenue',
    label: 'Revenue this month',
    icon: PaymentsOutlinedIcon,
    color: 'primary',
    href: '/app/analytics',
  },
  {
    key: 'orders',
    label: "Today's orders",
    icon: ShoppingCartCheckoutRoundedIcon,
    color: 'secondary',
    href: '/app/daily-sales',
  },
  {
    key: 'bottles',
    label: 'Bottles delivered today',
    icon: WaterDropOutlinedIcon,
    color: 'success',
    href: '/app/history',
  },
  {
    key: 'customers',
    label: 'Active customers',
    icon: Groups2OutlinedIcon,
    color: 'warning',
    href: '/app/customers',
  },
];

function MetricCard({
  item, value, detail, index,
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const tone = theme.palette[item.color] || theme.palette.primary;
  const Icon = item.icon;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: reduceMotion ? 0 : index * 0.045 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      style={{ height: '100%' }}
    >
      <Card
        component={Link}
        to={item.href}
        sx={{
          position: 'relative',
          display: 'block',
          height: '100%',
          overflow: 'hidden',
          color: 'inherit',
          textDecoration: 'none',
          transition: 'box-shadow 200ms ease, border-color 200ms ease',
          '&::after': {
            position: 'absolute',
            right: -24,
            bottom: -36,
            width: 112,
            height: 112,
            content: '""',
            bgcolor: alpha(tone.main, 0.08),
            borderRadius: '50%',
          },
          '&:hover': {
            borderColor: alpha(tone.main, 0.34),
            boxShadow: `0 22px 52px ${alpha(tone.main, 0.15)}`,
          },
          '&:focus-visible': {
            outline: `3px solid ${alpha(tone.main, 0.3)}`,
            outlineOffset: 3,
          },
        }}
      >
        <CardContent sx={{ position: 'relative', zIndex: 1, p: { xs: 1.5, sm: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.label}</Typography>
              <Typography
                variant="h4"
                sx={{ mt: 0.75, fontWeight: 850, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
              >
                {value}
              </Typography>
            </Box>
            <Box sx={{
              display: 'grid',
              width: { xs: 42, sm: 46 },
              height: { xs: 42, sm: 46 },
              flex: '0 0 auto',
              placeItems: 'center',
              color: tone.main,
              bgcolor: alpha(tone.main, 0.11),
              border: `1px solid ${alpha(tone.main, 0.14)}`,
              borderRadius: 2.5,
            }}
            >
              <Icon />
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mt: { xs: 1.25, sm: 2 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{detail}</Typography>
            <ArrowForwardRoundedIcon sx={{ color: tone.main, fontSize: 18 }} />
          </Stack>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function OperationsRow({
  icon: Icon, label, detail, value, color,
}) {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '42px minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: 1.25,
      p: 1.25,
      bgcolor: 'action.hover',
      border: 1,
      borderColor: 'divider',
      borderRadius: 2.5,
    }}
    >
      <Box sx={{
        display: 'grid',
        width: 40,
        height: 40,
        placeItems: 'center',
        color: `${color}.main`,
        bgcolor: (theme) => alpha(theme.palette[color].main, 0.1),
        borderRadius: 2,
      }}
      >
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={800}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{detail}</Typography>
      </Box>
      <Typography variant="h6" fontWeight={850} sx={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Box>
  );
}

export default function ClassicDashboard() {
  const {
    loading,
    revenueThisMonth,
    bottlesSoldToday,
    activeCustomers,
    totalCustomers,
    monthStats,
    todayStats,
    recentTransactions,
    dailySalesChart,
    monthlyRevenueChart,
  } = useAnalytics();
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const [portalStats, setPortalStats] = React.useState({
    pendingOrders: 0,
    unreadAdminNotifications: 0,
    companyBottleStock: 0,
  });

  React.useEffect(() => {
    const loadStats = () => getAdminCustomerPortalStats().then(setPortalStats).catch(() => {});
    loadStats();
    const timer = window.setInterval(() => { if (!document.hidden) loadStats(); }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <PageShell title="Dashboard" subtitle="Himaliya Spring Water operations">
        <LoadingState label="Loading dashboard..." variant="dashboard" />
      </PageShell>
    );
  }

  const values = {
    revenue: formatCurrency(revenueThisMonth),
    orders: todayStats.totalOrders,
    bottles: bottlesSoldToday,
    customers: `${activeCustomers}/${totalCustomers}`,
  };
  const details = {
    revenue: `${monthStats.totalOrders} sales recorded`,
    orders: `${formatCurrency(todayStats.totalRevenue)} today`,
    bottles: `${todayStats.totalBottles} units across all types`,
    customers: 'Active during the last 30 days',
  };
  const tableRows = recentTransactions.slice(0, 7);

  return (
    <PageShell title="Dashboard" subtitle="Sales, deliveries, and customer activity at a glance">
      <Grid container spacing={2.5}>
        {statCards.map((item, index) => (
          <Grid item xs={6} sm={6} xl={3} key={item.key}>
            <MetricCard
              item={item}
              index={index}
              value={values[item.key]}
              detail={details[item.key]}
            />
          </Grid>
        ))}

        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Sales momentum"
              subheader="Daily revenue over the last 14 days"
              action={<Chip size="small" color="primary" variant="outlined" label="Chart.js" />}
            />
            <CardContent sx={{ pt: 0 }}>
              <DailySalesTrendChart data={dailySalesChart} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Collection health" subheader="Collected and outstanding sales by month" />
            <CardContent sx={{ pt: 0 }}>
              <MonthlyCollectionChart data={monthlyRevenueChart} />
            </CardContent>
          </Card>
        </Grid>

        {settings.showDashboardMap !== false && (
          <Grid item xs={12} lg={8}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title="Customer coverage"
                subheader="Delivery locations fitted to the full service area"
                action={<Chip size="small" color="info" variant="outlined" label={`${customers.length} customers`} />}
              />
              <CardContent sx={{ pt: 0 }}>
                <CustomerMap customers={customers} />
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid item xs={12} lg={settings.showDashboardMap !== false ? 4 : 12}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Needs attention" subheader="The operational items worth acting on now" />
            <CardContent sx={{ pt: 0 }}>
              <Stack spacing={1.15}>
                <OperationsRow
                  icon={LocalShippingOutlinedIcon}
                  label="Pending orders"
                  detail="Waiting for dispatch"
                  value={portalStats.pendingOrders}
                  color="warning"
                />
                <OperationsRow
                  icon={NotificationsActiveOutlinedIcon}
                  label="Unread alerts"
                  detail="Orders, payments, and messages"
                  value={portalStats.unreadAdminNotifications}
                  color="error"
                />
                <OperationsRow
                  icon={Inventory2OutlinedIcon}
                  label="Reusable stock"
                  detail="Company bottles available"
                  value={portalStats.companyBottleStock}
                  color="success"
                />
              </Stack>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Button component={Link} to="/app/customer-orders" variant="contained" fullWidth>
                  Open delivery queue
                </Button>
                <Button component={Link} to="/notifications" variant="text" fullWidth>
                  Review notifications
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography variant="h6">Quick actions</Typography>
                  <Typography variant="body2" color="text.secondary">Jump into the most common daily tasks.</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button component={Link} to="/app/add-customer" variant="outlined" startIcon={<PersonAddAlt1RoundedIcon />}>
                    Add customer
                  </Button>
                  <Button component={Link} to="/app/daily-sales" variant="contained" startIcon={<PointOfSaleRoundedIcon />}>
                    Record sale
                  </Button>
                  <Button component={Link} to="/app/rider-tracking" variant="outlined" startIcon={<RouteRoundedIcon />}>
                    Track delivery
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Recent sales"
              subheader={`${formatCurrency(monthStats.totalRevenue)} recorded this month`}
              action={<Chip size="small" color="success" label="Live" />}
            />
            <TableContainer
              role="region"
              tabIndex={0}
              aria-label="Scrollable recent sales"
              sx={{ ...responsiveTableContainerSx, maxHeight: 390 }}
            >
              <Table stickyHeader aria-label="Recent sales" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Order</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((transaction, index) => {
                    const customer = customers.find((item) => item.id === transaction.customerId);
                    return (
                      <TableRow key={transaction.id} hover>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1.25}>
                            <Avatar
                              src={(customer && customer.photo) || ADMIN_AVATAR}
                              alt=""
                              sx={{ width: 34, height: 34 }}
                            />
                            <Typography variant="body2" fontWeight={750}>{transaction.customerName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{transaction.bottleType} × {transaction.quantity}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(transaction.amountPaid)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(transaction.totalAmount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!tableRows.length && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">No sales recorded yet.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>
    </PageShell>
  );
}
