import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, BellRing, CalendarDays, CheckCheck, ChevronDown, Clock3, Cookie, Download, Droplets, LoaderCircle, LogOut, Minus, Navigation, PackageCheck, Plus, ReceiptText, ShieldCheck, UserRound, Wallet, X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  createCustomerOrder,
  cancelCustomerOrder,
  getCustomerNotifications,
  getCustomerOrderControls,
  getCustomerOrders,
  getCustomerInvoices,
  getCustomerProfile,
  markCustomerNotificationsRead,
} from '../../services/api/customerPortalApi';
import { getOwnCustomerBottlePrices } from '../../services/api/customerBottlePriceApi';
import { resolveOrderPricing } from '../../utils/orderPricing';
import { signOut } from '../../services/cloud/supabaseClient';
import { getCustomerUnreadMessageCount } from '../../services/api/messagingApi';
import {
  enableNotifications,
  getInstallRequirement,
  getPermission,
  isNotificationSupported,
  showNotification,
} from '../../services/notifications/pushNotifications';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import LoadingState from '../../components/LoadingState/LoadingState';
import CustomerChatWidget from '../../components/CustomerChatWidget/CustomerChatWidget';
import './CustomerPortal.css';
import useCustomerTheme from './useCustomerTheme';

const DeliveryCelebration = React.lazy(() => import('../../components/DeliveryCelebration/DeliveryCelebration'));
const COOKIE_CONSENT_KEY = 'himaliya.customer.cookie-consent';

const todayIso = () => new Date().toISOString().slice(0, 10);
const customerBottleTypes = BOTTLE_TYPES;
const defaultOrder = {
  quantities: {},
  deliveryAddress: '',
  deliveryDate: todayIso(),
  notes: '',
};

function statusLabel(status) {
  const labels = {
    pending: 'Waiting for admin',
    accepted: 'Accepted',
    delivered: 'Delivered',
    canceled: 'Canceled',
    rejected: 'Rejected',
  };
  return labels[status] || status;
}

function formatDate(value) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function bottleLabel(type) {
  return BOTTLE_TYPE_LABELS[type] || type;
}

function orderBottleSummary(order) {
  const items = Array.isArray(order.items) && order.items.length
    ? order.items
    : [{ bottleType: order.bottleType, quantity: order.quantity }];
  return items.map((item) => `${item.quantity} × ${bottleLabel(item.bottleType)}`).join(' + ');
}

function preferredBottleType(profile, prices, fallback = 'Gallon') {
  const preferred = (profile.preferences && profile.preferences.defaultBottleType) || fallback;
  if (Number(prices[preferred] || 0) > 0) return preferred;
  return customerBottleTypes.find((type) => Number(prices[type] || 0) > 0) || preferred;
}

// Notification delivery lives in services/notifications: raising one from the
// page throws "Illegal constructor" on Android, so it has to go through the
// service worker.

function readCookieConsent() {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
}

// The ring on the right of each stat tile plots the tile's own share, so it
// carries real meaning rather than being a decorative squiggle.
function StatRing({ ratio }) {
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <svg className="customer-stat-ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <circle className="customer-stat-ring__track" cx="18" cy="18" r={radius} />
      <circle
        className="customer-stat-ring__value"
        cx="18"
        cy="18"
        r={radius}
        strokeDasharray={`${(clamped * circumference).toFixed(2)} ${circumference.toFixed(2)}`}
      />
    </svg>
  );
}

StatRing.propTypes = { ratio: PropTypes.number };
StatRing.defaultProps = { ratio: 0 };

function CustomerPortal({ history }) {
  const { theme, dashboardStyle } = useCustomerTheme();
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState(null);
  const [orders, setOrders] = React.useState([]);
  const [notifications, setNotifications] = React.useState([]);
  const [invoices, setInvoices] = React.useState([]);
  const [orderForm, setOrderForm] = React.useState(defaultOrder);
  const [prices, setPrices] = React.useState({});
  const [priceWarning, setPriceWarning] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [deliveredOrder, setDeliveredOrder] = React.useState(null);
  const [orderControls, setOrderControls] = React.useState({ allowCancellation: true, orderCutoffTime: '18:00', orderingOpen: true });
  const [cancelingOrder, setCancelingOrder] = React.useState('');
  const [unreadMessages, setUnreadMessages] = React.useState(0);
  const [notificationPermission, setNotificationPermission] = React.useState(getPermission);
  const [historyFilter, setHistoryFilter] = React.useState('all');
  const [cookieConsent, setCookieConsent] = React.useState(readCookieConsent);
  const seenInvoiceIds = React.useRef(new Set());
  const seenOrderStatuses = React.useRef(new Map());
  const activityRequestRunning = React.useRef(false);
  const accountRef = React.useRef(null);

  const chooseCookieConsent = (choice) => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    } catch {
      // The prompt can still close for this visit when storage is unavailable.
    }
    setCookieConsent(choice);
  };

  const openDashboardSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const nextProfile = await getCustomerProfile();
      if (!nextProfile) {
        setProfile(null);
        history.replace('/customer/login', { completeProfile: true });
        return;
      }
      const nextPrices = await getOwnCustomerBottlePrices();
      const [nextOrders, nextNotifications, nextInvoices, nextControls, nextUnreadMessages] = await Promise.all([
        getCustomerOrders(nextPrices),
        getCustomerNotifications(),
        getCustomerInvoices(),
        getCustomerOrderControls(),
        getCustomerUnreadMessageCount().catch(() => 0),
      ]);
      const hasAnyPrice = Object.values(nextPrices || {}).some((value) => Number(value) > 0);
      setProfile(nextProfile);
      setOrderForm((current) => ({
        ...current,
        quantities: Object.values(current.quantities || {}).some((value) => Number(value) > 0)
          ? current.quantities
          : {
            [preferredBottleType(nextProfile, nextPrices)]:
              (nextProfile.preferences && nextProfile.preferences.defaultQuantity) || 1,
          },
        deliveryAddress: nextProfile.address || current.deliveryAddress,
        deliveryDate: current.deliveryDate || todayIso(),
      }));
      setOrders(nextOrders);
      seenOrderStatuses.current = new Map(nextOrders.map((order) => [order.id, order.status]));
      setNotifications(nextNotifications);
      setInvoices(nextInvoices);
      seenInvoiceIds.current = new Set(nextInvoices.map((invoice) => invoice.id || invoice.invoiceNumber));
      setPrices(nextPrices || {});
      setOrderControls(nextControls);
      setUnreadMessages(nextUnreadMessages);
      setPriceWarning(hasAnyPrice ? '' : 'Bottle pricing is not set up for your account yet. Please contact the company.');
    } catch (err) {
      if (/deactivated/i.test(err.message || '')) {
        await signOut().catch(() => {});
        history.replace('/customer/login', { accountDeactivated: true });
      } else {
        toast.error(err.message || 'Could not load customer portal.');
      }
    } finally {
      setLoading(false);
    }
  }, [history]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    const closeAccountMenu = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', closeAccountMenu);
    return () => document.removeEventListener('mousedown', closeAccountMenu);
  }, []);

  const refreshActivity = React.useCallback(async () => {
    if (activityRequestRunning.current || document.hidden) return;
    activityRequestRunning.current = true;
    try {
      await getCustomerProfile();
      const nextPrices = profile ? await getOwnCustomerBottlePrices() : {};
      const [nextOrders, nextNotifications, nextInvoices, nextUnreadMessages] = await Promise.all([
        getCustomerOrders(nextPrices),
        getCustomerNotifications(),
        getCustomerInvoices(),
        getCustomerUnreadMessageCount().catch(() => 0),
      ]);
      const previousInvoiceIds = seenInvoiceIds.current;
      const newlyRegistered = nextInvoices.filter((invoice) => !previousInvoiceIds.has(invoice.id || invoice.invoiceNumber));
      if (newlyRegistered.length && (!profile || !profile.preferences || profile.preferences.invoiceAlerts !== false)) {
        const newest = newlyRegistered[0];
        showNotification({
          title: 'New Himaliya invoice registered',
          body: `${newest.invoiceNumber} is now available in your portal.`,
          type: 'invoice',
          id: newest.id || newest.invoiceNumber,
          url: '/customer/portal',
        });
        toast.info(`New invoice ${newest.invoiceNumber} is available.`);
      }
      seenInvoiceIds.current = new Set(nextInvoices.map((invoice) => invoice.id || invoice.invoiceNumber));
      const deliveredUpdate = nextOrders.find((order) => {
        const previousStatus = seenOrderStatuses.current.get(order.id);
        return order.status === 'delivered' && previousStatus && previousStatus !== 'delivered';
      });
      if (deliveredUpdate && (!profile || !profile.preferences || profile.preferences.orderUpdates !== false)) {
        setDeliveredOrder(deliveredUpdate);
        showNotification({
          title: 'Your delivery has arrived',
          body: `${orderBottleSummary(deliveredUpdate)} was marked delivered.`,
          type: 'delivery',
          id: deliveredUpdate.id,
          url: '/customer/portal',
        });
      }
      seenOrderStatuses.current = new Map(nextOrders.map((order) => [order.id, order.status]));
      setOrders(nextOrders);
      setNotifications(nextNotifications);
      setInvoices(nextInvoices);
      setPrices(nextPrices || {});
      setUnreadMessages(nextUnreadMessages);
    } catch (error) {
      if (/deactivated/i.test(error.message || '')) {
        await signOut().catch(() => {});
        history.replace('/customer/login', { accountDeactivated: true });
      }
    } finally {
      activityRequestRunning.current = false;
    }
  }, [history, profile]);

  React.useEffect(() => {
    if (!profile) return undefined;
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshActivity();
    };
    const intervalId = window.setInterval(refreshWhenVisible, 10000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
    };
  }, [profile, refreshActivity]);

  const updateOrder = (field, value) => setOrderForm((current) => ({ ...current, [field]: value }));
  const updateBottleQuantity = (bottleType, quantity) => setOrderForm((current) => ({
    ...current,
    quantities: {
      ...(current.quantities || {}),
      [bottleType]: Math.max(0, Math.min(500, Number(quantity) || 0)),
    },
  }));

  const submitOrder = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (!profile) throw new Error('Complete your customer profile before placing an order.');
      const items = customerBottleTypes
        .map((bottleType) => ({
          bottleType,
          quantity: Number((orderForm.quantities || {})[bottleType] || 0),
          unitPrice: Number(prices[bottleType] || 0),
        }))
        .filter((item) => item.quantity > 0);
      if (!items.length) throw new Error('Choose at least one bottle before placing the order.');
      if (items.some((item) => !item.unitPrice)) {
        throw new Error('One selected bottle has no active price. Ask admin to set the customer price.');
      }
      const order = await createCustomerOrder(profile, { ...orderForm, items });
      setOrders((current) => [order, ...current]);
      seenOrderStatuses.current.set(order.id, order.status);
      const preferredType = preferredBottleType(profile, prices);
      setOrderForm({
        ...defaultOrder,
        quantities: {
          [preferredType]: (profile.preferences && profile.preferences.defaultQuantity) || 1,
        },
        deliveryAddress: profile.address,
        deliveryDate: todayIso(),
      });
      toast.success('Order placed. The admin team will accept it shortly.');
    } catch (err) {
      toast.error(err.message || 'Could not place order.');
    } finally {
      setSubmitting(false);
    }
  };

  const markRead = async () => {
    await markCustomerNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const cancelOrder = async (orderId) => {
    setCancelingOrder(orderId);
    try {
      const canceled = await cancelCustomerOrder(orderId);
      setOrders((current) => current.map((order) => (order.id === canceled.id ? canceled : order)));
      toast.success('Order canceled.');
    } catch (error) {
      toast.error(error.message || 'Could not cancel this order.');
    } finally {
      setCancelingOrder('');
    }
  };

  const logout = async () => {
    const remoteLogout = signOut();
    history.replace('/');
    await remoteLogout;
  };

  const enableBrowserNotifications = async () => {
    if (!isNotificationSupported()) {
      toast.info(getInstallRequirement() || 'Notifications are not supported on this device.');
      return;
    }
    const result = await enableNotifications();
    setNotificationPermission(result.permission);

    if (result.permission === 'denied') {
      toast.info('Notifications are blocked. Turn them back on in your browser or phone settings for this site.');
      return;
    }
    if (result.permission !== 'granted') return;

    // A phone that granted permission but cannot actually display anything is
    // the exact failure this replaces, so say so instead of claiming success.
    if (result.transport === 'unsupported') {
      toast.warn(result.installHint || 'This browser accepted the permission but cannot display notifications.');
      return;
    }
    toast.success(result.pushEnabled
      ? 'Notifications are on, including while the app is closed.'
      : 'Notifications are on while the portal is open.');
  };

  if (loading) {
    return <LoadingState label="Loading your delivery portal..." variant="portal" className={`customer-theme--${theme}${theme === 'dark-gradient' ? ' customer-theme--dark' : ''}`} />;
  }

  if (!profile) {
    return (
      <main className="customer-portal-page">
        <div className="customer-portal-loader">Completing your customer profile...</div>
      </main>
    );
  }

  const pending = orders.filter((order) => order.status === 'pending').length;
  const paidInvoices = invoices.filter((invoice) => invoice.paymentStatus === 'paid').length;
  const unpaidInvoices = invoices.filter((invoice) => invoice.paymentStatus !== 'paid');
  const outstandingInvoices = unpaidInvoices.length;
  const balanceDue = unpaidInvoices.reduce((sum, invoice) => sum + (Number(invoice.totalAmount) || 0), 0);

  const downloadInvoice = async (invoice) => {
    try {
      const { exportInvoicePdf } = await import('../../utils/exportPdf');
      exportInvoicePdf({
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        payload: invoice.payload,
        totalAmount: invoice.totalAmount,
        totalQty: invoice.totalQty,
      });
    } catch (error) {
      toast.error(error.message || 'Could not prepare this invoice.');
    }
  };

  const invoiceStatusLabel = (status) => (status === 'paid' ? 'Paid' : 'Unpaid');
  const accepted = orders.filter((order) => order.status === 'accepted').length;
  const activeOrders = pending + accepted;
  const unread = notifications.filter((item) => !item.read).length;
  const filteredOrders = [...orders]
    .filter((order) => {
      if (historyFilter === 'active') return ['pending', 'accepted'].includes(order.status);
      if (historyFilter === 'completed') return ['delivered', 'canceled', 'rejected'].includes(order.status);
      return true;
    })
    .sort((left, right) => (
      new Date(right.createdAt || right.deliveryDate || 0)
      - new Date(left.createdAt || left.deliveryDate || 0)
    ));
  const orderGroups = filteredOrders.reduce((groups, order) => {
    const date = new Date(order.createdAt || order.deliveryDate || 0);
    const label = Number.isNaN(date.getTime())
      ? 'Earlier orders'
      : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const group = groups.find((item) => item.label === label);
    if (group) group.orders.push(order);
    else groups.push({ label, orders: [order] });
    return groups;
  }, []);
  const selectedItems = customerBottleTypes
    .map((bottleType) => ({
      bottleType,
      quantity: Number((orderForm.quantities || {})[bottleType] || 0),
      unitPrice: Number(prices[bottleType] || 0),
    }))
    .filter((item) => item.quantity > 0);
  const selectedTotal = selectedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  return (
    <main className={`customer-portal-page customer-theme--${theme}${theme === 'dark-gradient' ? ' customer-theme--dark' : ''} customer-accent--${dashboardStyle.accent} customer-header--${dashboardStyle.header} customer-cards--${dashboardStyle.cards}`}>
      {deliveredOrder && (
        <React.Suspense fallback={null}>
          <DeliveryCelebration
            animationPath="/Approved%20animation.json"
            title="Your order has arrived"
            message="Delivery completed successfully. Thank you for choosing Himaliya Spring Water."
            onClose={() => setDeliveredOrder(null)}
          />
        </React.Suspense>
      )}
      <header className="customer-portal-header">
        <div className="customer-header-aurora" aria-hidden="true" />
        <div className="customer-brand-lockup">
          <span className="customer-brand-mark" aria-hidden="true"><Droplets size={24} /></span>
          <div>
            <span className="customer-portal-kicker">Himaliya Spring Water</span>
            <h1>Good to see you, {profile.name.split(' ')[0]}</h1>
            <p>Your orders, delivery updates and invoices in one calm workspace.</p>
          </div>
        </div>
        <div className="customer-header-actions">
          {(!profile.preferences || profile.preferences.browserNotifications !== false) &&
            notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button type="button" className="customer-notification-enable" onClick={enableBrowserNotifications} aria-label="Enable browser notifications">
              <span className="customer-notification-enable__icon"><BellRing size={18} /></span>
              <span className="customer-notification-enable__copy"><strong>Enable alerts</strong><small>Order & invoice updates</small></span>
            </button>
          )}
          <div className="customer-account" ref={accountRef}>
            <button
              type="button"
              className="customer-account-trigger"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label={accountOpen ? 'Close account menu' : 'Open account menu'}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className="customer-account-avatar" aria-hidden="true"><UserRound size={17} /></span>
              <span className="customer-account-copy"><strong>{profile.name}</strong></span>
              <ChevronDown size={18} className={accountOpen ? 'is-open' : ''} />
            </button>
            {accountOpen && (
              <motion.div className="customer-account-menu" role="menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    history.push('/customer/profile');
                  }}
                ><UserRound size={18} /><span><strong>View profile & settings</strong><small>Contact details and theme</small></span></button>
                <button type="button" role="menuitem" className="is-danger" onClick={logout}><LogOut size={18} /><span><strong>Sign out</strong><small>Return to the landing page</small></span></button>
              </motion.div>
            )}
          </div>
        </div>
      </header>

      {/* Four equal tiles on a single row. Each carries an icon for its own
          metric and a ring plotting that metric's share. */}
      <section className="customer-portal-stats">
        {[
          {
            key: 'pending',
            icon: Clock3,
            label: 'Pending orders',
            value: pending,
            note: 'Waiting for review',
            ratio: activeOrders ? pending / activeOrders : 0,
            target: 'customer-order-history',
            tone: 'amber',
          },
          {
            key: 'accepted',
            icon: PackageCheck,
            label: 'Accepted',
            value: accepted,
            note: `${activeOrders} active order${activeOrders === 1 ? '' : 's'}`,
            ratio: activeOrders ? accepted / activeOrders : 0,
            target: 'customer-order-history',
            tone: 'cyan',
          },
          {
            key: 'invoices',
            icon: ReceiptText,
            label: 'Invoices',
            value: invoices.length,
            note: invoices.length ? `${Math.round((paidInvoices / invoices.length) * 100)}% paid` : 'No invoices yet',
            ratio: invoices.length ? paidInvoices / invoices.length : 0,
            target: 'customer-invoices',
            tone: 'violet',
          },
          {
            key: 'balance',
            icon: Wallet,
            label: 'Balance due',
            value: `PKR ${Math.round(balanceDue).toLocaleString()}`,
            note: outstandingInvoices ? `${outstandingInvoices} unpaid invoice${outstandingInvoices === 1 ? '' : 's'}` : 'All settled',
            ratio: invoices.length ? (invoices.length - outstandingInvoices) / invoices.length : 0,
            target: 'customer-invoices',
            tone: 'emerald',
          },
        ].map((stat, index) => {
          const StatIcon = stat.icon;
          return (
            <motion.button
              key={stat.key}
              type="button"
              className={`customer-stat-tile is-${stat.tone}`}
              onClick={() => openDashboardSection(stat.target)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="customer-stat-icon"><StatIcon size={18} aria-hidden="true" /></span>
              <span className="customer-stat-copy">
                <small>{stat.label}</small>
                <strong>{stat.value}</strong>
                <em>{stat.note}</em>
              </span>
              <StatRing ratio={stat.ratio} />
            </motion.button>
          );
        })}
      </section>

      <div className="customer-portal-grid">
        <section className="customer-portal-card customer-order-card">
          <div className="customer-card-heading">
            <span>Place order</span>
            <h2>Request a water delivery</h2>
          </div>
          <form onSubmit={submitOrder} className="customer-form">
            <fieldset className="customer-bottle-picker customer-form-wide">
              <legend>Choose bottles</legend>
              <p>Select one or several bottle types in the same order.</p>
              <div className="customer-bottle-options">
                {customerBottleTypes.map((type) => {
                  const unitPrice = Number(prices[type] || 0);
                  const quantity = Number((orderForm.quantities || {})[type] || 0);
                  return (
                    <article key={type} className={`customer-bottle-option${quantity > 0 ? ' is-selected' : ''}${!unitPrice ? ' is-unavailable' : ''}`}>
                      <span className="customer-bottle-option__icon"><Droplets size={19} aria-hidden="true" /></span>
                      <div className="customer-bottle-option__copy">
                        <strong>{bottleLabel(type)}</strong>
                        <small>{unitPrice ? `PKR ${unitPrice.toLocaleString()} each` : 'Not available'}</small>
                      </div>
                      <div className="customer-bottle-stepper" aria-label={`${bottleLabel(type)} quantity`}>
                        <button type="button" disabled={!unitPrice || quantity === 0} onClick={() => updateBottleQuantity(type, quantity - 1)} aria-label={`Remove one ${bottleLabel(type)}`}><Minus size={17} aria-hidden="true" /></button>
                        <output aria-live="polite" aria-label={`${quantity} selected`}>{quantity}</output>
                        <button type="button" disabled={!unitPrice || quantity >= 500} onClick={() => updateBottleQuantity(type, quantity + 1)} aria-label={`Add one ${bottleLabel(type)}`}><Plus size={17} aria-hidden="true" /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </fieldset>
            {priceWarning && <div className="customer-price-warning">{priceWarning}</div>}
            {!orderControls.orderingOpen && <div className="customer-price-warning">Orders are closed after {orderControls.orderCutoffTime}. Please order again tomorrow.</div>}
            <label className="customer-form-wide">
              Delivery address from profile
              <input
                value={orderForm.deliveryAddress || profile.address || ''}
                readOnly
                required
                title="Update this from your profile if it needs to change"
              />
              <small className="customer-price-hint">
                Uses the address saved on your profile. Update it under Profile if needed.
              </small>
            </label>
            <label>
              Delivery date
              <input type="date" min={todayIso()} value={orderForm.deliveryDate} onChange={(e) => updateOrder('deliveryDate', e.target.value)} />
            </label>
            <div className="customer-order-price-summary">
              <span>Estimated total</span>
              <strong>PKR {selectedTotal.toLocaleString()}</strong>
            </div>
            <label className="customer-form-wide">
              Notes
              <textarea value={orderForm.notes} onChange={(e) => updateOrder('notes', e.target.value)} placeholder="Gate number, delivery timing, empty gallons to collect..." />
            </label>
            <div className="customer-btn-row">
              <button
                type="submit"
                className="customer-btn customer-btn--primary"
                disabled={submitting || !orderControls.orderingOpen || !selectedItems.length || selectedItems.some((item) => !item.unitPrice) || !profile.address}
                aria-busy={submitting}
              >
                <span>{submitting ? 'Sending...' : orderControls.orderingOpen ? 'Place order' : 'Orders closed'}</span>
                {submitting ? <LoaderCircle size={17} className="is-spinning" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </div>
          </form>
        </section>

        <section className="customer-portal-card customer-notifications-card">
          <div className="customer-card-heading">
            <span>Notifications</span>
            <h2>
              Updates
              {unread > 0 && <span className="customer-notification-badge">{unread} new</span>}
            </h2>
          </div>
          <div className="customer-btn-row customer-btn-row--start">
            <button type="button" className="customer-link-button" onClick={markRead} disabled={unread === 0}>
              <CheckCheck size={16} aria-hidden="true" />
              <span>Mark all as read</span>
            </button>
          </div>
          <div className="customer-notification-list">
            {notifications.slice(0, 5).map((item) => (
              <article key={item.id} className={item.read ? 'is-read' : ''}>
                <span className="customer-notification-dot" aria-hidden="true" />
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
                {!item.read && <span className="customer-notification-pill">New</span>}
              </article>
            ))}
            {!notifications.length && <p className="customer-empty">No notifications yet. New order updates will appear here.</p>}
          </div>
        </section>

        <section id="customer-order-history" className="customer-portal-card customer-order-history-card">
          <div className="customer-order-history-heading">
            <div className="customer-card-heading">
              <span>Order history</span>
              <h2>Order timeline</h2>
            </div>
          </div>
          <div className="customer-order-filters" role="tablist" aria-label="Filter order history">
            {[
              ['all', 'All', orders.length],
              ['active', 'Active', orders.filter((order) => ['pending', 'accepted'].includes(order.status)).length],
              ['completed', 'Completed', orders.filter((order) => ['delivered', 'canceled', 'rejected'].includes(order.status)).length],
            ].map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={historyFilter === value}
                className={historyFilter === value ? 'is-active' : ''}
                onClick={() => setHistoryFilter(value)}
              >
                {historyFilter === value && (
                  <motion.span
                    layoutId="customer-order-history-filter"
                    className="customer-order-filter__selection"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    aria-hidden="true"
                  />
                )}
                <span>{label}</span>
                <small>{count}</small>
              </button>
            ))}
          </div>
          <div className="customer-order-list" role="region" aria-label={`${historyFilter} order history`}>
            {orderGroups.map((group) => (
              <section className="customer-order-month" key={group.label}>
                <div className="customer-order-month__heading">
                  <strong>{group.label}</strong>
                  <span>{group.orders.length} {group.orders.length === 1 ? 'order' : 'orders'}</span>
                </div>
                <div className="customer-order-month__list">
                  {group.orders.map((order, index) => {
                    const pricing = resolveOrderPricing(order, prices);
                    return (
                      <motion.article
                        key={order.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.12) }}
                        className={`customer-order-entry customer-order-entry--${order.status}`}
                      >
                        <div className="customer-order-entry__summary">
                          <span className="customer-order-entry__icon"><Droplets aria-hidden="true" /></span>
                          <div>
                            <strong>{orderBottleSummary(order)}</strong>
                            <small>Delivery {formatDate(order.deliveryDate)}</small>
                          </div>
                        </div>
                        <div className="customer-order-entry__meta">
                          <span className={`customer-status customer-status--${order.status}`}>{statusLabel(order.status)}</span>
                          <strong className="customer-order-entry__price">PKR {pricing.totalAmount.toLocaleString()}</strong>
                          {order.trackingToken && ['accepted', 'delivered'].includes(order.status) && (
                            <button
                              type="button"
                              className="customer-order-route"
                              onClick={() => history.push(`/track/${order.trackingToken}`)}
                              aria-label={order.status === 'delivered' ? 'View delivery route details' : 'Track delivery route'}
                              title={order.status === 'delivered' ? 'View delivery route details' : 'Track delivery route'}
                            >
                              <Navigation size={16} aria-hidden="true" />
                            </button>
                          )}
                          {order.status === 'pending' && orderControls.allowCancellation && (
                            <button
                              type="button"
                              className="customer-order-cancel"
                              disabled={cancelingOrder === order.id}
                              aria-busy={cancelingOrder === order.id}
                              onClick={() => cancelOrder(order.id)}
                            >
                              {cancelingOrder === order.id
                                ? <LoaderCircle size={14} className="is-spinning" aria-hidden="true" />
                                : <X size={14} aria-hidden="true" />}
                              <span>{cancelingOrder === order.id ? 'Canceling...' : 'Cancel'}</span>
                            </button>
                          )}
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </section>
            ))}
            {!filteredOrders.length && (
              <p className="customer-empty">
                {orders.length
                  ? `No ${historyFilter} orders to show.`
                  : 'No orders yet. Your first order will show here.'}
              </p>
            )}
          </div>
        </section>

        <section id="customer-invoices" className="customer-portal-card customer-invoices-card">
          <div className="customer-card-heading">
            <span>Your invoices</span>
            <h2>Invoice details</h2>
          </div>
          <div className="customer-invoice-list" tabIndex="0" role="region" aria-label="Scrollable customer invoices">
            {invoices.map((invoice) => (
              <article className="customer-invoice-item" key={invoice.id}>
                <div className="customer-invoice-main">
                  <div className="customer-invoice-identity">
                    <span className="customer-invoice-icon" aria-hidden="true"><ReceiptText size={19} /></span>
                    <div className="customer-invoice-copy">
                      <strong title={invoice.invoiceNumber}>{invoice.invoiceNumber}</strong>
                      <small>
                        <CalendarDays size={13} aria-hidden="true" />
                        <span>{formatDate(invoice.invoiceDate)}</span>
                        <i aria-hidden="true" />
                        <span>{invoice.totalQty} item{invoice.totalQty === 1 ? '' : 's'}</span>
                      </small>
                    </div>
                  </div>
                  <div className="customer-invoice-tags">
                    <span className={`customer-invoice-tag customer-invoice-tag--${invoice.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                      {invoiceStatusLabel(invoice.paymentStatus)}
                    </span>
                    {invoice.validated && <span className="customer-invoice-tag customer-invoice-tag--validated">Validated</span>}
                  </div>
                </div>
                <div className="customer-invoice-actions">
                  <div className="customer-invoice-total">
                    <span>Invoice total</span>
                    <strong>PKR {invoice.totalAmount.toLocaleString()}</strong>
                  </div>
                  <button type="button" className="customer-btn customer-btn--ghost customer-invoice-download" onClick={() => downloadInvoice(invoice)}>
                    <Download size={16} aria-hidden="true" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </article>
            ))}
            {!invoices.length && <p className="customer-empty">No invoices linked yet. When admin generates a bill for your account, it will appear here.</p>}
          </div>
        </section>

      </div>
      <CustomerChatWidget
        unreadCount={unreadMessages}
        onOpenFullThread={() => history.push('/customer/messages')}
      />

      {!cookieConsent && (
        <motion.aside
          className="customer-cookie-consent"
          role="dialog"
          aria-modal="false"
          aria-labelledby="customer-cookie-title"
          initial={{ opacity: 0, y: 28, scale: .97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.9 }}
        >
          <span className="customer-cookie-consent__icon"><Cookie size={20} aria-hidden="true" /></span>
          <div>
            <strong id="customer-cookie-title">Your privacy, your choice</strong>
            <p>Essential storage keeps you signed in. Allow optional cookies for saved dashboard preferences, or decline them.</p>
          </div>
          <div className="customer-cookie-consent__actions">
            <button type="button" className="is-secondary" onClick={() => chooseCookieConsent('declined')}>Decline</button>
            <button type="button" className="is-primary" onClick={() => chooseCookieConsent('allowed')}><ShieldCheck size={15} /> Allow</button>
          </div>
        </motion.aside>
      )}
    </main>
  );
}

CustomerPortal.propTypes = {
  history: PropTypes.object.isRequired,
};

export default withRouter(CustomerPortal);
