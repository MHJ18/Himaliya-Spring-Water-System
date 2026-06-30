import React from 'react';
import PropTypes from 'prop-types';
import { Link, withRouter } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellRing, ChevronDown, Droplets, LogOut, UserRound,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  createCustomerOrder,
  getCustomerNotifications,
  getCustomerOrders,
  getCustomerInvoices,
  getCustomerProfile,
  markCustomerNotificationsRead,
} from '../../services/api/customerPortalApi';
import { getBottlePrices } from '../../services/api/bottlePriceApi';
import { resolveOrderPricing } from '../../utils/orderPricing';
import { signOut } from '../../services/cloud/supabaseClient';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { exportInvoicePdf } from '../../utils/exportPdf';
import LoadingState from '../../components/LoadingState/LoadingState';
import './CustomerPortal.css';
import useCustomerTheme from './useCustomerTheme';

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
  const { theme } = useCustomerTheme();
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
  const [notificationPermission, setNotificationPermission] = React.useState(
    canUseBrowserNotifications() ? window.Notification.permission : 'unsupported',
  );
  const seenInvoiceIds = React.useRef(new Set());
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
      const [nextOrders, nextNotifications, nextInvoices] = await Promise.all([
        getCustomerOrders(nextPrices),
        getCustomerNotifications(),
        getCustomerInvoices(),
      ]);
      const hasAnyPrice = Object.values(nextPrices || {}).some((value) => Number(value) > 0);
      setProfile(nextProfile);
      setOrderForm((current) => ({
        ...current,
        deliveryAddress: nextProfile.address || current.deliveryAddress,
        deliveryDate: current.deliveryDate || todayIso(),
      }));
      setOrders(nextOrders);
      setNotifications(nextNotifications);
      setInvoices(nextInvoices);
      seenInvoiceIds.current = new Set(nextInvoices.map((invoice) => invoice.id || invoice.invoiceNumber));
      setPrices(nextPrices || {});
      setPriceWarning(hasAnyPrice ? '' : 'Bottle prices are not visible to this customer account yet. Ask admin to save prices in Settings and apply the Supabase price visibility SQL.');
    } catch (err) {
      toast.error(err.message || 'Could not load customer portal.');
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
    try {
      const nextPrices = await getBottlePrices({});
      const [nextOrders, nextNotifications, nextInvoices] = await Promise.all([
        getCustomerOrders(nextPrices),
        getCustomerNotifications(),
        getCustomerInvoices(),
      ]);
      const previousInvoiceIds = seenInvoiceIds.current;
      const newlyRegistered = nextInvoices.filter((invoice) => !previousInvoiceIds.has(invoice.id || invoice.invoiceNumber));
      if (newlyRegistered.length) {
        const newest = newlyRegistered[0];
        notifyDesktop(
          'New Himaliya invoice registered',
          `${newest.invoiceNumber} is now available in your portal.`,
        );
        toast.info(`New invoice ${newest.invoiceNumber} is available.`);
      }
      seenInvoiceIds.current = new Set(nextInvoices.map((invoice) => invoice.id || invoice.invoiceNumber));
      setOrders(nextOrders);
      setNotifications(nextNotifications);
      setInvoices(nextInvoices);
      setPrices(nextPrices || {});
    } catch {
      // Keep the current screen stable; session expiry is handled globally by the API layer.
    }
  }, []);

  React.useEffect(() => {
    if (!profile) return undefined;
    const intervalId = window.setInterval(refreshActivity, 25000);
    return () => window.clearInterval(intervalId);
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
      setOrderForm({ ...defaultOrder, deliveryAddress: profile.address, deliveryDate: todayIso() });
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
    return <main className="customer-portal-page"><LoadingState label="Loading your delivery portal..." variant="portal" /></main>;
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

  const downloadInvoice = (invoice) => {
    exportInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      payload: invoice.payload,
      totalAmount: invoice.totalAmount,
      totalQty: invoice.totalQty,
    });
  };

  const invoiceStatusLabel = (status) => (status === 'paid' ? 'Paid' : 'Unpaid');
  const accepted = orders.filter((order) => order.status === 'accepted').length;
  const unread = notifications.filter((item) => !item.read).length;
  const selectedUnitPrice = Number(prices[orderForm.bottleType] || 0);
  const selectedTotal = selectedUnitPrice * Number(orderForm.quantity || 1);

  return (
    <main className={`customer-portal-page customer-theme--${theme}`}>
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
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button type="button" className="customer-icon-action" onClick={enableBrowserNotifications} aria-label="Enable browser notifications">
              <BellRing size={20} />
            </button>
          )}
          <div className="customer-account" ref={accountRef}>
            <button
              type="button"
              className="customer-account-trigger"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className="customer-account-avatar">{profile.name.charAt(0).toUpperCase()}</span>
              <span className="customer-account-copy"><strong>{profile.name}</strong><small>Customer account</small></span>
              <ChevronDown size={18} className={accountOpen ? 'is-open' : ''} />
            </button>
            {accountOpen && (
              <motion.div className="customer-account-menu" role="menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <Link
                  role="menuitem"
                  to="/customer/profile"
                  onClick={(event) => {
                    event.preventDefault();
                    setAccountOpen(false);
                    history.push('/customer/profile');
                  }}
                ><UserRound size={18} /><span><strong>View profile & settings</strong><small>Contact details and theme</small></span></Link>
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
            <label className="customer-form-wide">
              Delivery address from profile
              <input value={orderForm.deliveryAddress} onChange={(e) => updateOrder('deliveryAddress', e.target.value)} required />
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
              <button type="submit" className="customer-btn" disabled={submitting}>{submitting ? 'Sending...' : 'Place order'}</button>
            </div>
          </form>
        </section>

        <section className="customer-portal-card">
          <div className="customer-card-heading">
            <span>Notifications</span>
            <h2>{unread} unread updates</h2>
          </div>
          <div className="customer-btn-row customer-btn-row--start">
            <button type="button" className="customer-link-button" onClick={markRead}>Mark all as read</button>
          </div>
          <div className="customer-notification-list">
            {notifications.slice(0, 5).map((item) => (
              <article key={item.id} className={item.read ? 'is-read' : ''}>
                <i />
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
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
          <div className="customer-invoice-list">
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
                    Download PDF
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
