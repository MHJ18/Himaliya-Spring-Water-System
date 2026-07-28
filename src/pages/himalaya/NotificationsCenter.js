import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellRing,
  CreditCard,
  MessageCircle,
  Package,
  Route,
  TriangleAlert,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import {
  clearAdminNotifications,
  getCachedAdminNotifications,
  getAdminNotifications,
  markAdminNotificationRead,
  markAdminNotificationsRead,
} from '../../services/api/customerPortalApi';
import LoadingState from '../../components/LoadingState/LoadingState';
import './UtilityPages.css';

function timeLabel(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString();
}

function groupLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
}

function notificationIcon(type) {
  if (type === 'payment') return CreditCard;
  if (type === 'stock') return TriangleAlert;
  if (type === 'tracking') return Route;
  if (type === 'message') return MessageCircle;
  if (type === 'order') return Package;
  if (type === 'account') return UserPlus;
  return BellRing;
}

function notificationTypeLabel(type) {
  if (type === 'payment') return 'Payment';
  if (type === 'stock') return 'Stock';
  if (type === 'tracking') return 'Delivery';
  if (type === 'message') return 'Message';
  if (type === 'order') return 'Order';
  if (type === 'account') return 'Account';
  return 'Alert';
}

function notificationDestination(item) {
  if (item.type === 'order') return { pathname: '/app/customer-orders', state: { focusOrderId: item.orderId } };
  if (item.type === 'tracking' || item.type === 'delivery') return { pathname: '/app/rider-tracking', state: { focusOrderId: item.orderId } };
  if (item.type === 'message') return { pathname: '/messages' };
  if (item.type === 'stock') return { pathname: '/app/settings' };
  if (item.type === 'account') return { pathname: '/app/users' };
  if (item.type === 'payment') return { pathname: '/app/invoice' };
  return null;
}

function NotificationsCenter({ history }) {
  const initialItems = React.useMemo(() => getCachedAdminNotifications(), []);
  const [items, setItems] = useState(initialItems || []);
  const [loading, setLoading] = useState(initialItems === null);
  const [marking, setMarking] = useState('');

  useEffect(() => {
    let active = true;
    getAdminNotifications({ forceRefresh: initialItems !== null })
      .then((nextItems) => { if (active) setItems(nextItems); })
      .catch((error) => { if (active) toast.error(error.message || 'Could not load notifications.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialItems]);

  const unread = items.filter((item) => !item.read).length;
  const markRead = async (item) => {
    if (item.read || marking) return true;
    setMarking(item.id);
    try {
      await markAdminNotificationRead(item.id);
      setItems((current) => current.map((currentItem) => (
        currentItem.id === item.id ? { ...currentItem, read: true } : currentItem
      )));
      return true;
    } catch (error) {
      toast.error(error.message || 'Could not mark this notification as read.');
      return false;
    } finally {
      setMarking('');
    }
  };

  const openNotification = async (item) => {
    const destination = notificationDestination(item);
    await markRead(item);
    if (destination) history.push(destination.pathname, destination.state);
  };

  const markAllRead = async () => {
    if (!unread || marking) return;
    setMarking('all');
    try {
      await markAdminNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
    } catch (error) {
      toast.error(error.message || 'Could not mark notifications as read.');
    } finally {
      setMarking('');
    }
  };

  const clearAll = async () => {
    if (!items.length || marking) return;
    const confirmed = window.confirm('Clear all admin notifications? This cannot be undone.');
    if (!confirmed) return;
    setMarking('clear');
    try {
      await clearAdminNotifications();
      setItems([]);
      toast.success('All notifications cleared.');
    } catch (error) {
      toast.error(error.message || 'Could not clear notifications.');
    } finally {
      setMarking('');
    }
  };

  return (
    <PageShell title="Notifications" subtitle="Customer portal orders, delivery, payment, and stock alerts">
      <motion.section className="water-page-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="water-page-card__header">
          <div>
            <span>Notification center</span>
            <h2>
              Updates
              {unread > 0 && (
                <span className="notification-count-badge">{unread} unread</span>
              )}
            </h2>
          </div>
          <div className="notification-actions">
            <button
              type="button"
              className="water-action"
              onClick={markAllRead}
              disabled={unread === 0 || Boolean(marking)}
              aria-busy={marking === 'all'}
            >
              {marking === 'all' ? 'Marking…' : 'Mark all as read'}
            </button>
            <button
              type="button"
              className="water-action water-action--danger water-action--icon"
              onClick={clearAll}
              disabled={items.length === 0 || Boolean(marking)}
              aria-busy={marking === 'clear'}
              aria-label={marking === 'clear' ? 'Clearing notifications' : 'Clear all notifications'}
              title="Clear all notifications"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="notification-list">
          {loading && <LoadingState label="Loading notifications..." variant="table" compact />}
          {!loading && !items.length && <p style={{ margin: 0, padding: '1.5rem' }}>No notifications yet. New customer orders will appear here.</p>}
          {['Today', 'Yesterday', 'Earlier'].map((group) => {
            const groupedItems = items.filter((item) => groupLabel(item.createdAt) === group);
            if (!groupedItems.length) return null;
            return (
              <section className="notification-group" key={group} aria-labelledby={`notifications-${group.toLowerCase()}`}>
                <h3 id={`notifications-${group.toLowerCase()}`} className="notification-group__title">{group}</h3>
                <div className="notification-group__card">
                  {groupedItems.map((item) => {
                    const Icon = notificationIcon(item.type);
                    return (
                      <article
                        key={item.id}
                        className={`notification-item notification-item--${item.type} ${item.read ? 'is-read' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${item.read ? 'Read' : 'Unread'} notification: ${item.title}`}
                        onClick={() => openNotification(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openNotification(item);
                          }
                        }}
                      >
                        <span className={`notification-icon notification-icon--${item.type}`}>
                          <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        <div className="notification-item__copy">
                          <div className="notification-item__title-row">
                            <h3>{item.title}</h3>
                            <span className={`notification-type-badge notification-type-badge--${item.type}`}>
                              {notificationTypeLabel(item.type)}
                            </span>
                          </div>
                          <p>{item.detail}</p>
                          <time>{timeLabel(item.createdAt)}</time>
                        </div>
                        {!item.read && <span className="notification-unread" aria-label="Unread" />}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </motion.section>
    </PageShell>
  );
}

NotificationsCenter.propTypes = {
  history: PropTypes.shape({ push: PropTypes.func.isRequired }).isRequired,
};

export default withRouter(NotificationsCenter);
