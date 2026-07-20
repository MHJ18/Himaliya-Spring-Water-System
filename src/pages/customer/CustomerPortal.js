import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, BellRing, CheckCheck, ChevronDown, Download, Droplets, LoaderCircle, LogOut, MessageCircle, Navigation, UserRound, X,
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
import { getBottlePrices } from '../../services/api/bottlePriceApi';
import { resolveOrderPricing } from '../../utils/orderPricing';
import { signOut } from '../../services/cloud/supabaseClient';
import { getCustomerUnreadMessageCount } from '../../services/api/messagingApi';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import LoadingState from '../../components/LoadingState/LoadingState';
import './CustomerPortal.css';
import useCustomerTheme from './useCustomerTheme';

const DeliveryCelebration = React.lazy(() => import('../../components/DeliveryCelebration/DeliveryCelebration'));

const todayIso = () => new Date().toISOString().slice(0, 10);
const customerBottleTypes = BOTTLE_TYPES;
const defaultOrder = {
  quantity: 1,
  bottleType: 'Gallon',
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

function canUseBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function notifyDesktop(title, body) {
  if (!canUseBrowserNotifications() || window.Notification.permission !== 'granted') return;
  try {
    new window.Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'himaliya-invoice',
    });
  } catch {
    // Browser notification support can vary; keep the app flow stable.
  }
}

function CustomerPortal({ history }) {
  const { theme, setTheme } = useCustomerTheme();
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
  const [notificationPermission, setNotificationPermission] = React.useState(
    canUseBrowserNotifications() ? window.Notification.permission : 'unsupported',
  );
  const seenInvoiceIds = React.useRef(new Set());
  const seenOrderStatuses = React.useRef(new Map());
  const activityRequestRunning = React.useRef(false);
  const accountRef = React.useRef(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const nextProfile = await getCustomerProfile();
      if (!nextProfile) {
        setProfile(null);
        history.replace('/customer/login', { completeProfile: true });
        return;
      }
      const nextPrices = await getBottlePrices({});
      const [nextOrders, nextNotifications, nextInvoices, nextControls, nextUnreadMessages] = await Promise.all([
        getCustomerOrders(nextPrices),
        getCustomerNotifications(),
        getCustomerInvoices(),
        getCustomerOrderControls(),
        getCustomerUnreadMessageCount().catch(() => 0),
      ]);
      const hasAnyPrice = Object.values(nextPrices || {}).some((value) => Number(value) > 0);
      setProfile(nextProfile);
      setTheme(nextProfile.preferences && nextProfile.preferences.theme);
      setOrderForm((current) => ({
        ...current,
        bottleType: (nextProfile.preferences && nextProfile.preferences.defaultBottleType) || current.bottleType,
        quantity: (nextProfile.preferences && nextProfile.preferences.defaultQuantity) || current.quantity,
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
      setPriceWarning(hasAnyPrice ? '' : 'Bottle prices are not visible to this customer account yet. Ask admin to save prices in Settings and apply the Supabase price visibility SQL.');
    } catch (err) {
      toast.error(err.message || 'Could not load customer portal.');
    } finally {
      setLoading(false);
    }
  }, [history, setTheme]);

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
      const nextPrices = await getBottlePrices({});
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
        notifyDesktop(
          'New Himaliya invoice registered',
          `${newest.invoiceNumber} is now available in your portal.`,
        );
        toast.info(`New invoice ${newest.invoiceNumber} is available.`);
      }
      seenInvoiceIds.current = new Set(nextInvoices.map((invoice) => invoice.id || invoice.invoiceNumber));
      const deliveredUpdate = nextOrders.find((order) => {
        const previousStatus = seenOrderStatuses.current.get(order.id);
        return order.status === 'delivered' && previousStatus && previousStatus !== 'delivered';
      });
      if (deliveredUpdate && (!profile || !profile.preferences || profile.preferences.orderUpdates !== false)) {
        setDeliveredOrder(deliveredUpdate);
      }
      seenOrderStatuses.current = new Map(nextOrders.map((order) => [order.id, order.status]));
      setOrders(nextOrders);
      setNotifications(nextNotifications);
      setInvoices(nextInvoices);
      setPrices(nextPrices || {});
      setUnreadMessages(nextUnreadMessages);
    } catch {
      // Keep the current screen stable; session expiry is handled globally by the API layer.
    } finally {
      activityRequestRunning.current = false;
    }
  }, [profile]);

  React.useEffect(() => {
    if (!profile) return undefined;
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshActivity();
    };
    const intervalId = window.setInterval(refreshWhenVisible, 25000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
    };
  }, [profile, refreshActivity]);

  const updateOrder = (field, value) => setOrderForm((current) => ({ ...current, [field]: value }));

  const submitOrder = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (!profile) throw new Error('Complete your customer profile before placing an order.');
      const unitPrice = Number(prices[orderForm.bottleType] || 0);
      if (!unitPrice) {
        throw new Error('This bottle type has no active price yet. Ask admin to set bottle prices in Settings.');
      }
      const totalAmount = unitPrice * Number(orderForm.quantity || 1);
      const order = await createCustomerOrder(profile, { ...orderForm, unitPrice, totalAmount });
      setOrders((current) => [order, ...current]);
      seenOrderStatuses.current.set(order.id, order.status);
      setOrderForm({
        ...defaultOrder,
        bottleType: (profile.preferences && profile.preferences.defaultBottleType) || defaultOrder.bottleType,
        quantity: (profile.preferences && profile.preferences.defaultQuantity) || defaultOrder.quantity,
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
    if (!canUseBrowserNotifications()) {
      toast.info('Browser notifications are not supported on this device.');
      return;
    }
    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      notifyDesktop('Notifications enabled', 'We will alert you when a new invoice is registered.');
    }
  };

  if (loading) {
    return <LoadingState label="Loading your delivery portal..." variant="portal" className={`customer-theme--${theme}`} />;
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
  const unread = notifications.filter((item) => !item.read).length;
  const selectedUnitPrice = Number(prices[orderForm.bottleType] || 0);
  const selectedTotal = selectedUnitPrice * Number(orderForm.quantity || 1);

  return (
    <main className={`customer-portal-page customer-theme--${theme}`}>
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
          <button
            type="button"
            className="customer-messages-launch"
            onClick={() => history.push('/customer/messages')}
            aria-label={unreadMessages ? `${unreadMessages} unread messages` : 'Open messages'}
          >
            <MessageCircle size={18} />
            <span>Messages</span>
            {unreadMessages > 0 && (
              <em>{unreadMessages > 9 ? '9+' : unreadMessages}</em>
            )}
          </button>
          <div className="customer-account" ref={accountRef}>
            <button
              type="button"
              className="customer-account-trigger"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
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

      <section className="customer-portal-stats">
        <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <span>Pending</span><strong>{pending}</strong><small>Orders waiting for admin</small>
        </motion.article>
        <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <span>Accepted</span><strong>{accepted}</strong><small>Delivery approved</small>
        </motion.article>
        <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <span>Invoices</span><strong>{invoices.length}</strong><small>{paidInvoices} paid</small>
        </motion.article>
      </section>

      <div className="customer-portal-grid">
        <section className="customer-portal-card customer-order-card">
          <div className="customer-card-heading">
            <span>Place order</span>
            <h2>Request 19L gallon delivery</h2>
          </div>
          <form onSubmit={submitOrder} className="customer-form">
            <label>
              Quantity
              <input type="number" min="1" value={orderForm.quantity} onChange={(e) => updateOrder('quantity', e.target.value)} required />
            </label>
            <label>
              Bottle type
              <select value={orderForm.bottleType} onChange={(e) => updateOrder('bottleType', e.target.value)}>
                {customerBottleTypes.map((type) => (
                  <option key={type} value={type}>{BOTTLE_TYPE_LABELS[type] || type}</option>
                ))}
              </select>
              <small className="customer-price-hint">PKR {selectedUnitPrice.toLocaleString()} per unit</small>
            </label>
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
                disabled={submitting || !orderControls.orderingOpen}
                aria-busy={submitting}
              >
                <span>{submitting ? 'Sending...' : orderControls.orderingOpen ? 'Place order' : 'Orders closed'}</span>
                {submitting ? <LoaderCircle size={17} className="is-spinning" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </div>
          </form>
        </section>

        <section className="customer-portal-card">
          <div className="customer-card-heading">
            <span>Notifications</span>
            <h2>
              Updates
              {unread > 0 && <span className="customer-notification-badge">{unread} new</span>}
            </h2>
          </div>
          <div className="customer-btn-row customer-btn-row--start">
            <button type="button" className="customer-link-button" onClick={markRead}>
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

        <section className="customer-portal-card">
          <div className="customer-card-heading">
            <span>Order history</span>
            <h2>Past orders</h2>
          </div>
          <div className="customer-order-list" tabIndex="0" role="region" aria-label="Scrollable order history">
            {orders.map((order) => {
              const pricing = resolveOrderPricing(order, prices);
              const compact = ['accepted', 'delivered', 'canceled', 'rejected'].includes(order.status);
              return (
              <article key={order.id} className={compact ? 'is-compact' : ''}>
                <div>
                  <strong>{order.quantity} × {bottleLabel(order.bottleType)}</strong>
                  <small>{formatDate(order.deliveryDate)}</small>
                </div>
                <div className="customer-order-history-meta">
                  <strong>PKR {pricing.totalAmount.toLocaleString()}</strong>
                  <span className={`customer-status customer-status--${order.status}`}>{statusLabel(order.status)}</span>
                  {order.trackingToken && ['accepted', 'delivered'].includes(order.status) && (
                    <button
                      type="button"
                      className="customer-order-track"
                      onClick={() => history.push(`/track/${order.trackingToken}`)}
                    >
                      <Navigation size={14} aria-hidden="true" />
                      <span>{order.status === 'delivered' ? 'View route' : 'Track rider'}</span>
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
              </article>
            );})}
            {!orders.length && <p className="customer-empty">No orders yet. Your first order will show here.</p>}
          </div>
        </section>

        <section className="customer-portal-card customer-invoices-card">
          <div className="customer-card-heading">
            <span>Your invoices</span>
            <h2>Invoice details</h2>
          </div>
          <div className="customer-invoice-list" tabIndex="0" role="region" aria-label="Scrollable customer invoices">
            {invoices.map((invoice) => (
              <article key={invoice.id}>
                <div>
                  <strong>{invoice.invoiceNumber}</strong>
                  <small>{formatDate(invoice.invoiceDate)} · {invoice.totalQty} items</small>
                  <div className="customer-invoice-tags">
                    <span className={`customer-invoice-tag customer-invoice-tag--${invoice.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                      {invoiceStatusLabel(invoice.paymentStatus)}
                    </span>
                    {invoice.validated && <span className="customer-invoice-tag customer-invoice-tag--validated">Validated</span>}
                  </div>
                </div>
                <div className="customer-invoice-actions">
                  <strong>PKR {invoice.totalAmount.toLocaleString()}</strong>
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
    </main>
  );
}

CustomerPortal.propTypes = {
  history: PropTypes.object.isRequired,
};

export default withRouter(CustomerPortal);
