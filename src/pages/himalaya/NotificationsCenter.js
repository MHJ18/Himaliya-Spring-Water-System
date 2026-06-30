import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import {
  getAdminNotifications,
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

export default function NotificationsCenter() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminNotifications()
      .then(async (nextItems) => {
        setItems(nextItems);
        if (nextItems.some((item) => !item.read)) {
          await markAdminNotificationsRead();
          setItems((current) => current.map((item) => ({ ...item, read: true })));
        }
      })
      .catch((error) => toast.error(error.message || 'Could not load notifications.'))
      .finally(() => setLoading(false));
  }, []);

  const unread = items.filter((item) => !item.read).length;
  const markRead = (id) => setItems((current) => current.map((item) => (
    item.id === id ? { ...item, read: true } : item
  )));

  const markAllRead = async () => {
    await markAdminNotificationsRead();
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  };

  return (
    <PageShell title="Notifications" subtitle="Customer portal orders, delivery, payment, and stock alerts">
      <motion.section className="water-page-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="water-page-card__header">
          <div><span>Notification center</span><h2>{unread} unread</h2></div>
          <button type="button" className="water-action" onClick={markAllRead}>Mark all as read</button>
        </div>
        <div className="notification-list">
          {loading && <LoadingState label="Loading notifications..." variant="table" compact />}
          {!loading && !items.length && <p className="p-4 mb-0">No notifications yet. New customer orders will appear here.</p>}
          {['Today', 'Yesterday', 'Earlier'].map((group) => {
            const groupedItems = items.filter((item) => groupLabel(item.createdAt) === group);
            if (!groupedItems.length) return null;
            return <section className="notification-group" key={group} aria-labelledby={`notifications-${group.toLowerCase()}`}>
              <h3 id={`notifications-${group.toLowerCase()}`} className="notification-group__title">{group}</h3>
              <div className="notification-group__card">
                {groupedItems.map((item) => (
                  <article
                    key={item.id}
                    className={`notification-item ${item.read ? 'is-read' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => markRead(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') markRead(item.id);
                    }}
                  >
                    <span className={`notification-icon notification-icon--${item.type}`}>{item.type === 'order' ? 'OR' : 'NT'}</span>
                    <div><h3>{item.title}</h3><p>{item.detail}</p><time>{timeLabel(item.createdAt)}</time></div>
                    {!item.read && <span className="notification-unread" aria-label="Unread" />}
                  </article>
                ))}
              </div>
            </section>;
          })}
        </div>
      </motion.section>
    </PageShell>
  );
}
