import React from 'react';
import { Link } from 'react-router-dom';
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import PointOfSaleRoundedIcon from '@mui/icons-material/PointOfSaleRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { motion, useReducedMotion } from 'motion/react';
import {
  BottleMixChart,
  BusinessSalesChart,
  CustomerTrendMiniChart,
  WeeklyPaymentsMiniChart,
} from '../../components/charts/SalesOverviewCharts';
import LoadingState from '../../components/LoadingState/LoadingState';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSettings } from '../../context/SettingsContext';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';
import {
  getAdminCustomerOrders,
  getAdminCustomerPortalStats,
} from '../../services/api/customerPortalApi';
import { ADMIN_AVATAR } from '../../utils/customerPhotos';
import { formatCurrency } from '../../utils/formatters';
import { getMonthToDateRevenueComparison } from '../../utils/analytics';
import { localeFor } from '../../utils/localization';
import './DashboardStudio.css';

const copyByLanguage = {
  en: {
    pageTitle: 'Business operations dashboard',
    live: 'Live business data',
    greeting: 'Congratulations, team',
    heroTitle: 'Himaliya is moving water and revenue.',
    heroText: 'Your live sales, collections, and delivery queue are summarized below.',
    pending: 'New orders',
    moving: 'On route',
    delivered: 'Delivered today',
    customers: 'Customers',
    activeCustomers: 'Active in the last 30 days',
    bottleMix: 'Products',
    bottleMixSub: 'Bottle units across recorded sales',
    totalSales: 'Total sales',
    totalSalesSub: 'Revenue and collections over time',
    collection: 'Latest collection',
    collectionSub: 'Payment health this month',
    payments: 'Payments',
    paymentsSub: 'Daily collections this week',
    recent: 'Recent sales',
    recentSub: 'Latest customer entries from your ledger',
    schedule: 'Upcoming deliveries',
    scheduleSub: 'Active customer order queue',
    emptySales: 'No sales have been recorded yet.',
    emptyOrders: 'No deliveries are waiting.',
    emptyFilteredOrders: 'No deliveries match this filter.',
    viewAll: 'View all',
    recordSale: 'Record sale',
    collected: 'Collected',
    outstanding: 'Outstanding',
    profit: 'collection rate',
    stock: 'Reusable stock',
    alerts: 'Unread alerts',
    todayRevenue: "Today's revenue",
    todayBottles: 'bottles today',
    liveLedger: 'Live ledger value',
    deliveryVelocity: 'Delivery velocity',
    movingNow: 'moving now',
    waiting: 'waiting',
    customerActivation: 'Customer activation',
    activeAccounts: 'active accounts',
    openBalance: 'Open balance',
    monthToCollect: 'to collect this month',
    liveLabel: 'Live',
    all: 'All',
    accepted: 'Accepted',
    onRoute: 'On route',
    deliveryUnavailable: 'Delivery feed unavailable',
  },
  ur: {
    pageTitle: 'کاروباری آپریشنز ڈیش بورڈ',
    live: 'لائیو کاروباری ڈیٹا',
    greeting: 'بہترین کام، ٹیم',
    heroTitle: 'ہمالیہ کی فروخت اور ڈیلیوری تیزی سے جاری ہے۔',
    heroText: 'آپ کی تازہ فروخت، وصولیاں اور ڈیلیوری قطار ایک جگہ موجود ہیں۔',
    pending: 'نئے آرڈرز',
    moving: 'راستے میں',
    delivered: 'آج مکمل',
    customers: 'صارفین',
    activeCustomers: 'گزشتہ 30 دن میں فعال',
    bottleMix: 'مصنوعات',
    bottleMixSub: 'درج شدہ فروخت میں بوتلوں کی تقسیم',
    totalSales: 'کل فروخت',
    totalSalesSub: 'وقت کے ساتھ آمدنی اور وصولیاں',
    collection: 'تازہ وصولی',
    collectionSub: 'اس ماہ ادائیگی کی صورتحال',
    payments: 'ادائیگیاں',
    paymentsSub: 'اس ہفتے کی روزانہ وصولی',
    recent: 'حالیہ فروخت',
    recentSub: 'آپ کے ریکارڈ کے تازہ ترین اندراجات',
    schedule: 'آنے والی ڈیلیوریز',
    scheduleSub: 'فعال صارف آرڈر قطار',
    emptySales: 'ابھی کوئی فروخت درج نہیں ہوئی۔',
    emptyOrders: 'کوئی ڈیلیوری انتظار میں نہیں۔',
    emptyFilteredOrders: 'اس فلٹر میں کوئی ڈیلیوری نہیں۔',
    viewAll: 'سب دیکھیں',
    recordSale: 'فروخت درج کریں',
    collected: 'وصول شدہ',
    outstanding: 'بقایا',
    profit: 'وصولی کی شرح',
    stock: 'دستیاب اسٹاک',
    alerts: 'نہ پڑھی اطلاعات',
    todayRevenue: 'آج کی آمدنی',
    todayBottles: 'آج کی بوتلیں',
    liveLedger: 'لائیو لیجر ویلیو',
    deliveryVelocity: 'ڈیلیوری کی رفتار',
    movingNow: 'ابھی راستے میں',
    waiting: 'انتظار میں',
    customerActivation: 'صارف فعالیت',
    activeAccounts: 'فعال اکاؤنٹس',
    openBalance: 'بقایا رقم',
    monthToCollect: 'اس ماہ وصول کرنا ہے',
    liveLabel: 'لائیو',
    all: 'تمام',
    accepted: 'منظور',
    onRoute: 'راستے میں',
    deliveryUnavailable: 'ڈیلیوری ڈیٹا دستیاب نہیں',
  },
};

function StudioCard({
  className = '', delay = 0, children, component = 'section',
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Box
      component={motion[component] || motion.section}
      className={`studio-card ${className}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.3, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Box>
  );
}

function CardHeading({
  title, subtitle, action,
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" variant="h5" fontWeight={850}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      </Box>
      {action}
    </Stack>
  );
}

function StatusRow({
  icon: Icon, label, value, tone,
}) {
  return (
    <div className="studio-status-row">
      <span className={`studio-status-icon is-${tone}`}><Icon fontSize="small" /></span>
      <span><strong>{value}</strong><small>{label}</small></span>
    </div>
  );
}

function todayMatches(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
}

function orderStatus(order, language) {
  const status = String(order.status || '').toLowerCase();
  if (language === 'ur') {
    if (status === 'delivered') return 'مکمل';
    if (status === 'accepted') return 'منظور';
    if (status === 'ready') return 'تیار';
    if (['picked_up', 'in_transit'].includes(status)) return 'راستے میں';
    if (status === 'canceled') return 'منسوخ';
    return 'زیر التوا';
  }
  if (status === 'delivered') return 'Delivered';
  if (status === 'accepted') return 'Accepted';
  if (status === 'ready') return 'Ready';
  if (['picked_up', 'in_transit'].includes(status)) return 'On route';
  if (status === 'canceled') return 'Canceled';
  return 'Pending';
}

export default function DashboardStudio() {
  const {
    loading,
    activeCustomers,
    totalCustomers,
    monthStats,
    todayStats,
    recentTransactions,
    dailySalesChart,
    monthlyRevenueChart,
    bottleDistribution,
    customerGrowth,
    allTransactions,
  } = useAnalytics();
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const language = settings.language === 'ur' ? 'ur' : 'en';
  const copy = copyByLanguage[language];
  const locale = localeFor(language);
  const [portalStats, setPortalStats] = React.useState({
    pendingOrders: 0,
    unreadAdminNotifications: 0,
    companyBottleStock: 0,
  });
  const [orders, setOrders] = React.useState([]);
  const [orderFilter, setOrderFilter] = React.useState('all');
  const [portalStatus, setPortalStatus] = React.useState('loading');

  React.useEffect(() => {
    let alive = true;
    const load = () => Promise.all([
      getAdminCustomerPortalStats(),
      settings.featureCustomerOrders === false ? Promise.resolve([]) : getAdminCustomerOrders({}),
    ]).then(([stats, nextOrders]) => {
      if (!alive) return;
      setPortalStats(stats);
      setOrders(nextOrders || []);
      setPortalStatus('ready');
    }).catch(() => {
      if (alive) setPortalStatus('error');
    });
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [settings.featureCustomerOrders]);

  if (loading) {
    return <LoadingState label={language === 'ur' ? 'ڈیش بورڈ لوڈ ہو رہا ہے۔۔۔' : 'Loading dashboard...'} variant="dashboard" />;
  }

  const inProgress = orders.filter((order) => (
    ['accepted', 'ready', 'picked_up', 'in_transit'].includes(String(order.status || '').toLowerCase())
  )).length;
  const deliveredToday = orders.filter((order) => (
    String(order.status || '').toLowerCase() === 'delivered'
    && todayMatches(order.deliveredAt || order.updatedAt)
  )).length;
  const collectionRate = monthStats.totalRevenue
    ? Math.min(100, Math.round((monthStats.totalCollected / monthStats.totalRevenue) * 100))
    : 0;
  const deliveryQueue = orders
    .filter((order) => !['delivered', 'canceled'].includes(String(order.status || '').toLowerCase()));
  const upcomingOrders = deliveryQueue
    .filter((order) => {
      const status = String(order.status || '').toLowerCase();
      if (orderFilter === 'accepted') return ['accepted', 'ready'].includes(status);
      if (orderFilter === 'on-route') return ['picked_up', 'in_transit'].includes(status);
      return true;
    })
    .slice(0, 4);
  const recentRows = recentTransactions.slice(0, 5);
  const bottleData = bottleDistribution.map((item) => ({
    ...item,
    label: BOTTLE_TYPE_LABELS[item.name] || item.name,
  }));
  const growth = getMonthToDateRevenueComparison(allTransactions).percentage;
  const customerChart = customerGrowth.length
    ? customerGrowth
    : [{ name: 'Now', customers: totalCustomers }];
  const weeklyPayments = dailySalesChart.slice(-7);
  const activationRate = totalCustomers
    ? Math.min(100, Math.round((activeCustomers / totalCustomers) * 100))
    : 0;

  return (
    <div className="studio-dashboard-shell" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <div className="studio-dashboard-intro">
        <div>
          <span className={portalStatus === 'error' ? 'is-error' : ''}>
            <i />{portalStatus === 'error' ? copy.deliveryUnavailable : copy.live}
          </span>
          <h1>{copy.pageTitle}</h1>
        </div>
        <Button
          component={Link}
          to="/app/daily-sales"
          variant="contained"
          startIcon={<PointOfSaleRoundedIcon />}
        >
          {copy.recordSale}
        </Button>
      </div>

      <div className="studio-dashboard-grid">
        <StudioCard className="studio-hero" delay={0.02}>
          <div className="studio-hero-copy">
            <span className="studio-kicker">{copy.greeting}</span>
            <Typography component="h2" variant="h3">{copy.heroTitle}</Typography>
            <Typography variant="body2" color="text.secondary">{copy.heroText}</Typography>
            <div className="studio-status-list" aria-label="Current delivery status">
              <StatusRow icon={ReceiptLongRoundedIcon} label={copy.pending} value={portalStatus === 'error' ? '—' : portalStats.pendingOrders} tone="warning" />
              <StatusRow icon={RouteRoundedIcon} label={copy.moving} value={portalStatus === 'error' ? '—' : inProgress} tone="info" />
              <StatusRow icon={LocalShippingOutlinedIcon} label={copy.delivered} value={portalStatus === 'error' ? '—' : deliveredToday} tone="success" />
            </div>
          </div>
          <div className="studio-hero-visual" aria-hidden="true">
            <div className="studio-business-orbit" />
            <span className="studio-big-bottle"><i>19L</i><WaterDropOutlinedIcon /></span>
            <span className="studio-small-bottle"><i>1.5L</i></span>
            <span className="studio-hero-truck"><LocalShippingOutlinedIcon /></span>
          </div>
        </StudioCard>

        <StudioCard className="studio-customers" delay={0.05}>
          <CardHeading
            title={copy.customers}
            subtitle={copy.activeCustomers}
            action={(
              <Stack direction="row" spacing={0.75} alignItems="center">
                <span className="studio-customers-icon" aria-hidden="true"><Groups2OutlinedIcon fontSize="small" /></span>
                <Chip
                  size="small"
                  className="studio-positive-chip"
                  label={activeCustomers.toLocaleString(locale)}
                  aria-label={`${activeCustomers.toLocaleString(locale)} ${copy.activeCustomers}`}
                />
              </Stack>
            )}
          />
          <div className="studio-card-number">{totalCustomers.toLocaleString(locale)}</div>
          <div className="studio-mini-line">
            <CustomerTrendMiniChart data={customerChart} />
          </div>
          <AvatarGroup max={5} sx={{ justifyContent: 'flex-end', mt: 1 }}>
            {customers.slice(0, 5).map((customer) => (
              <Avatar key={customer.id} src={customer.photo || ADMIN_AVATAR} alt={customer.name} />
            ))}
          </AvatarGroup>
        </StudioCard>

        <StudioCard className="studio-bottle-mix" delay={0.08}>
          <CardHeading
            title={copy.bottleMix}
            subtitle={copy.bottleMixSub}
            action={<strong className="studio-card-figure">{monthStats.totalBottles.toLocaleString(locale)}</strong>}
          />
          <BottleMixChart data={bottleData} business />
        </StudioCard>

        <StudioCard className="studio-signal-card is-cyan" delay={0.09}>
          <span className="studio-signal-icon"><InsightsRoundedIcon /></span>
          <span className="studio-signal-copy">
            <small>{copy.todayRevenue}</small>
            <strong>{formatCurrency(todayStats.totalRevenue)}</strong>
            <em>{copy.liveLedger}</em>
          </span>
          <span className="studio-signal-trend">{todayStats.totalBottles.toLocaleString(locale)} {copy.todayBottles}</span>
        </StudioCard>

        <StudioCard className="studio-signal-card is-violet" delay={0.1}>
          <span className="studio-signal-icon"><SpeedRoundedIcon /></span>
          <span className="studio-signal-copy">
            <small>{copy.deliveryVelocity}</small>
            <strong>{portalStatus === 'error' ? '—' : inProgress} {copy.movingNow}</strong>
            <em>{portalStatus === 'error' ? '—' : portalStats.pendingOrders} {copy.waiting}</em>
          </span>
          <span className="studio-signal-trend">
            {portalStatus === 'error' ? copy.deliveryUnavailable : copy.liveLabel}
          </span>
        </StudioCard>

        <StudioCard className="studio-signal-card is-amber" delay={0.11}>
          <span className="studio-signal-icon"><WorkspacePremiumRoundedIcon /></span>
          <span className="studio-signal-copy">
            <small>{copy.customerActivation}</small>
            <strong>{activationRate}%</strong>
            <em>{activeCustomers} {copy.activeAccounts}</em>
          </span>
          <span className="studio-signal-trend">30d</span>
        </StudioCard>

        <StudioCard className="studio-signal-card is-rose" delay={0.12}>
          <span className="studio-signal-icon"><AccountBalanceWalletRoundedIcon /></span>
          <span className="studio-signal-copy">
            <small>{copy.openBalance}</small>
            <strong>{formatCurrency(monthStats.totalDue)}</strong>
            <em>{copy.monthToCollect}</em>
          </span>
          <span className="studio-signal-trend">{100 - collectionRate}%</span>
        </StudioCard>

        <StudioCard className="studio-sales-chart" delay={0.11}>
          <CardHeading
            title={copy.totalSales}
            subtitle={copy.totalSalesSub}
            action={(
              <span className={`studio-growth-pill${growth < 0 ? ' is-negative' : ''}`}>
                {growth >= 0 ? '+' : ''}{growth}%
              </span>
            )}
          />
          <div className="studio-sales-figure">
            <strong>{formatCurrency(monthStats.totalRevenue)}</strong>
            <small>{copy.collected}: {formatCurrency(monthStats.totalCollected)}</small>
          </div>
          <BusinessSalesChart data={monthlyRevenueChart.length ? monthlyRevenueChart : dailySalesChart} />
        </StudioCard>

        <StudioCard className="studio-collection" delay={0.14}>
          <CardHeading title={copy.collection} subtitle={copy.collectionSub} />
          <div className="studio-collection-rate">
            <strong>{collectionRate}%</strong>
            <span>{copy.profit}</span>
          </div>
          <LinearProgress variant="determinate" value={collectionRate} aria-label={`${collectionRate}% collected`} />
          <div className="studio-money-row">
            <span><small>{copy.collected}</small><strong>{formatCurrency(monthStats.totalCollected)}</strong></span>
            <span><small>{copy.outstanding}</small><strong>{formatCurrency(monthStats.totalDue)}</strong></span>
          </div>
          <AvatarGroup max={4} sx={{ justifyContent: 'flex-end', mt: 'auto' }}>
            {customers.slice(0, 4).map((customer) => (
              <Avatar key={customer.id} src={customer.photo || ADMIN_AVATAR} alt="" />
            ))}
          </AvatarGroup>
        </StudioCard>

        <StudioCard className="studio-payments" delay={0.17}>
          <CardHeading
            title={copy.payments}
            subtitle={copy.paymentsSub}
            action={<strong className="studio-card-figure">{formatCurrency(todayStats.totalCollected)}</strong>}
          />
          <div className="studio-payment-chart">
            <WeeklyPaymentsMiniChart data={weeklyPayments} />
          </div>
          <div className="studio-payment-legend">
            <span><i />{copy.collected}<strong>{collectionRate}%</strong></span>
            <span><i />{copy.outstanding}<strong>{100 - collectionRate}%</strong></span>
          </div>
          <div className="studio-pulse-strip">
            {settings.featureInventory !== false && (
              <StatusRow icon={Inventory2OutlinedIcon} label={copy.stock} value={portalStatus === 'error' ? '—' : portalStats.companyBottleStock} tone="success" />
            )}
            <StatusRow icon={NotificationsActiveOutlinedIcon} label={copy.alerts} value={portalStatus === 'error' ? '—' : portalStats.unreadAdminNotifications} tone="warning" />
          </div>
        </StudioCard>

        <StudioCard className="studio-recent" delay={0.2}>
          <CardHeading
            title={copy.recent}
            subtitle={copy.recentSub}
            action={(
              <Button component={Link} to="/app/history" size="small" endIcon={<ArrowForwardRoundedIcon />}>
                {copy.viewAll}
              </Button>
            )}
          />
          <div className="studio-table-wrap" role="region" tabIndex={0} aria-label="Recent sales">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>{language === 'ur' ? 'صارف' : 'Customer'}</th>
                  <th>{language === 'ur' ? 'بوتلیں' : 'Products'}</th>
                  <th>{language === 'ur' ? 'ادائیگی' : 'Payment'}</th>
                  <th>{language === 'ur' ? 'حالت' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((transaction) => {
                  const customer = customers.find((item) => item.id === transaction.customerId);
                  const paid = Number(transaction.amountDue) <= 0;
                  return (
                    <tr key={transaction.id}>
                      <td data-label={language === 'ur' ? 'صارف' : 'Customer'}>
                        <span className="studio-customer-cell">
                          <Avatar src={(customer && customer.photo) || ADMIN_AVATAR} alt="" />
                          <span>
                            <strong>{transaction.customerName}</strong>
                            <small>{new Date(transaction.date).toLocaleDateString(locale)}</small>
                          </span>
                        </span>
                      </td>
                      <td data-label={language === 'ur' ? 'بوتلیں' : 'Products'}>{BOTTLE_TYPE_LABELS[transaction.bottleType] || transaction.bottleType} × {transaction.quantity}</td>
                      <td data-label={language === 'ur' ? 'ادائیگی' : 'Payment'}><strong>{formatCurrency(transaction.totalAmount)}</strong><small>{formatCurrency(transaction.amountPaid)} {copy.collected.toLowerCase()}</small></td>
                      <td data-label={language === 'ur' ? 'حالت' : 'Status'}><span className={`studio-table-status is-${paid ? 'paid' : 'due'}`}>{paid ? (language === 'ur' ? 'ادا شدہ' : 'Paid') : copy.outstanding}</span></td>
                    </tr>
                  );
                })}
                {!recentRows.length && <tr><td colSpan="4" className="studio-empty">{copy.emptySales}</td></tr>}
              </tbody>
            </table>
          </div>
        </StudioCard>

        {settings.featureCustomerOrders !== false && (
          <StudioCard className="studio-schedule" delay={0.23}>
            <CardHeading
              title={copy.schedule}
              subtitle={copy.scheduleSub}
              action={(
                <Button component={Link} to="/app/customer-orders" size="small" endIcon={<ArrowForwardRoundedIcon />}>
                  {copy.viewAll}
                </Button>
              )}
            />
            <div className="studio-schedule-filter" aria-label={copy.schedule}>
              {[
                { value: 'all', label: copy.all },
                { value: 'accepted', label: copy.accepted },
                { value: 'on-route', label: copy.onRoute },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={orderFilter === filter.value ? 'is-active' : ''}
                  aria-pressed={orderFilter === filter.value}
                  onClick={() => setOrderFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="studio-schedule-list" aria-live="polite">
              {upcomingOrders.map((order) => (
                <Link key={order.id} to="/app/customer-orders" className="studio-schedule-row">
                  <span className="studio-schedule-marker"><LocalShippingOutlinedIcon fontSize="small" /></span>
                  <span>
                    <strong>{order.customerName || 'Customer'}</strong>
                    <small>{order.deliveryAddress || 'Address not provided'}</small>
                  </span>
                  <em>{orderStatus(order, language)}</em>
                </Link>
              ))}
              {!upcomingOrders.length && (
                <div className="studio-empty">
                  {orderFilter === 'all' ? copy.emptyOrders : copy.emptyFilteredOrders}
                </div>
              )}
            </div>
          </StudioCard>
        )}
      </div>
    </div>
  );
}
