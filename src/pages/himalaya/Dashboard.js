import React, { useMemo } from 'react';
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
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ShoppingCartCheckoutRoundedIcon from '@mui/icons-material/ShoppingCartCheckoutRounded';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PointOfSaleRoundedIcon from '@mui/icons-material/PointOfSaleRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import CustomerMap from '../dashboard/components/customer-map/CustomerMap';
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
  { key: 'revenue', label: 'Monthly revenue', icon: PaymentsOutlinedIcon, color: '#32b5f5' },
  { key: 'orders', label: "Today's orders", icon: ShoppingCartCheckoutRoundedIcon, color: '#7b79f7' },
  { key: 'bottles', label: 'Bottles today', icon: WaterDropOutlinedIcon, color: '#27c59a' },
  { key: 'customers', label: 'Active customers', icon: Groups2OutlinedIcon, color: '#f5a524' },
];

function MetricCard({
  item, value, detail, progress,
}) {
  const Icon = item.icon;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={650}>{item.label}</Typography>
            <Typography
              variant="h4"
              sx={{ mt: 0.6, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </Typography>
          </Box>
          <Box sx={{
            display: 'grid',
            width: 44,
            height: 44,
            flex: '0 0 auto',
            placeItems: 'center',
            color: item.color,
            bgcolor: `${item.color}18`,
            borderRadius: 2,
          }}
          >
            <Icon />
          </Box>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.75 }}>
          {detail}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          sx={{
            height: 5,
            borderRadius: 99,
            bgcolor: `${item.color}16`,
            '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 99 },
          }}
        />
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const {
    loading,
    revenueThisMonth,
    bottlesSoldToday,
    activeCustomers,
    totalCustomers,
    monthStats,
    todayStats,
    recentTransactions,
  } = useAnalytics();
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const [portalStats, setPortalStats] = React.useState({
    signedUpCustomers: 0,
    pendingOrders: 0,
    unreadAdminNotifications: 0,
  });

  React.useEffect(() => {
    getAdminCustomerPortalStats().then(setPortalStats).catch(() => {});
  }, []);

  const monthGrowth = useMemo(() => {
    if (!totalCustomers) return 0;
    return Math.min(100, Math.round((activeCustomers / totalCustomers) * 100));
  }, [activeCustomers, totalCustomers]);

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
    revenue: `${monthStats.totalOrders} orders this month`,
    orders: `${formatCurrency(todayStats.totalRevenue)} recorded today`,
    bottles: `${todayStats.totalBottles} units across all types`,
    customers: `${monthGrowth}% of registered customers active`,
  };
  const progress = {
    revenue: Math.max(8, monthGrowth),
    orders: Math.min(100, todayStats.totalOrders * 10),
    bottles: Math.min(100, bottlesSoldToday * 2),
    customers: monthGrowth,
  };
  const tableRows = recentTransactions.slice(0, 6);

  return (
    <PageShell title="Dashboard" subtitle="Live overview of customers, sales, deliveries, and billing">
      <Grid container spacing={2.5}>
        {statCards.map((item) => (
          <Grid item xs={12} sm={6} xl={3} key={item.key}>
            <MetricCard
              item={item}
              value={values[item.key]}
              detail={details[item.key]}
              progress={progress[item.key]}
            />
          </Grid>
        ))}

        {settings.showDashboardMap !== false && (
          <Grid item xs={12} lg={8}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title="Customer coverage"
                subheader="Saved delivery locations across your service area"
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
            <CardHeader title="Customer app" subheader="Orders and account activity requiring attention" />
            <CardContent sx={{ pt: 0 }}>
              <Stack spacing={1.25}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 1.5,
                  bgcolor: 'rgba(29,155,240,.08)', borderRadius: 2,
                }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <Groups2OutlinedIcon color="primary" />
                    <Box><Typography variant="body2" fontWeight={750}>Signed-up customers</Typography><Typography variant="caption" color="text.secondary">Portal accounts</Typography></Box>
                  </Stack>
                  <Typography variant="h5" fontWeight={850}>{portalStats.signedUpCustomers}</Typography>
                </Box>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 1.5,
                  bgcolor: 'rgba(245,165,36,.09)', borderRadius: 2,
                }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <LocalShippingOutlinedIcon color="warning" />
                    <Box><Typography variant="body2" fontWeight={750}>Pending orders</Typography><Typography variant="caption" color="text.secondary">Waiting for acceptance</Typography></Box>
                  </Stack>
                  <Typography variant="h5" fontWeight={850}>{portalStats.pendingOrders}</Typography>
                </Box>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 1.5,
                  bgcolor: 'rgba(239,91,114,.08)', borderRadius: 2,
                }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <NotificationsActiveOutlinedIcon color="error" />
                    <Box><Typography variant="body2" fontWeight={750}>Unread alerts</Typography><Typography variant="caption" color="text.secondary">Admin notifications</Typography></Box>
                  </Stack>
                  <Typography variant="h5" fontWeight={850}>{portalStats.unreadAdminNotifications}</Typography>
                </Box>
              </Stack>
              <Button component={Link} to="/app/customer-orders" variant="contained" fullWidth sx={{ mt: 2 }}>
                Open delivery queue
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Quick actions"
              subheader="Start the most common daily tasks"
            />
            <CardContent sx={{ pt: 0 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button component={Link} to="/app/add-customer" variant="contained" startIcon={<PersonAddAlt1RoundedIcon />}>
                  Add customer
                </Button>
                <Button component={Link} to="/app/daily-sales" variant="outlined" startIcon={<PointOfSaleRoundedIcon />}>
                  Record sale
                </Button>
                <Button component={Link} to="/app/customer-orders" variant="outlined" startIcon={<LocalShippingOutlinedIcon />}>
                  Manage orders
                </Button>
                <Button component={Link} to="/app/rider-tracking" variant="outlined" startIcon={<RouteRoundedIcon />}>
                  Delivery tracker
                </Button>
                <Button component={Link} to="/app/history" variant="outlined" startIcon={<HistoryRoundedIcon />}>
                  View history
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Recent sales"
              subheader="Latest customer transactions"
              action={<Chip size="small" color="success" label="Live" />}
            />
            <CardContent sx={{ pt: 0 }}>
              <List disablePadding>
                {recentTransactions.slice(0, 5).map((transaction, index) => {
                  const customer = customers.find((item) => item.id === transaction.customerId);
                  return (
                    <React.Fragment key={transaction.id}>
                      <ListItem disableGutters sx={{ py: 1 }}>
                        <ListItemAvatar>
                          <Avatar src={(customer && customer.photo) || ADMIN_AVATAR} alt="" />
                        </ListItemAvatar>
                        <ListItemText
                          primary={transaction.customerName}
                          secondary={`${transaction.bottleType} × ${transaction.quantity}`}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 750 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <Typography variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(transaction.totalAmount)}
                        </Typography>
                      </ListItem>
                      {index < Math.min(4, recentTransactions.length - 1) && <Box component="li" sx={{ borderBottom: 1, borderColor: 'divider' }} />}
                    </React.Fragment>
                  );
                })}
                {!recentTransactions.length && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No sales recorded yet.
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Sales ledger" subheader={`${formatCurrency(monthStats.totalRevenue)} recorded this month`} />
            <TableContainer
              role="region"
              tabIndex={0}
              aria-label="Scrollable recent sales ledger"
              sx={{ ...responsiveTableContainerSx, maxHeight: 360 }}
            >
              <Table stickyHeader aria-label="Recent sales ledger" sx={{ minWidth: 460 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Order</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((transaction) => (
                    <TableRow key={transaction.id} hover>
                      <TableCell>{transaction.customerName}</TableCell>
                      <TableCell>{transaction.bottleType} × {transaction.quantity}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(transaction.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!tableRows.length && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
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
