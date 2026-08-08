/* Decides which admin notifications become a device notification.
 *
 * The notification center always records everything. This layer only governs
 * what is allowed to interrupt someone on their phone, using the preferences on
 * Settings > Notifications.
 */

import { showNotification } from './pushNotifications';

const WATERMARK_KEY = 'hs_admin_alert_watermark';

// Notification type -> the setting that gates it. Types absent from this map
// are recorded in the app but never raise a device notification, so a new
// backend type cannot start buzzing phones until it is deliberately added.
const TYPE_SETTING = {
  order: 'notifyNewOrders',
  tracking: 'notifyDeliveryUpdates',
  delivery: 'notifyDeliveryUpdates',
  payment: 'notifyPayments',
  invoice_overdue: 'notifyOverdueInvoices',
  stock: 'notifyLowStock',
};

const TYPE_ROUTE = {
  order: '/app/customer-orders',
  tracking: '/app/rider-tracking',
  delivery: '/app/rider-tracking',
  payment: '/app/invoice',
  invoice_overdue: '/app/invoice',
  stock: '/app/settings',
  message: '/messages',
  account: '/app/users',
};

function toMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

/* Quiet hours normally wrap past midnight (22:00 -> 07:00), so a plain
 * start <= now <= end comparison would be false for the entire night. */
export function isWithinQuietHours(settings, now = new Date()) {
  if (!settings || !settings.quietHoursEnabled) return false;
  const start = toMinutes(settings.quietHoursStart);
  const end = toMinutes(settings.quietHoursEnd);
  if (start === null || end === null || start === end) return false;

  const current = (now.getHours() * 60) + now.getMinutes();
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function shouldNotify(type, settings, now = new Date()) {
  if (!settings || settings.pushNotificationsEnabled === false) return false;
  if (isWithinQuietHours(settings, now)) return false;
  const key = TYPE_SETTING[type];
  if (!key) return false;
  return settings[key] !== false;
}

function readWatermark() {
  try {
    return Number(window.localStorage.getItem(WATERMARK_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeWatermark(value) {
  try {
    window.localStorage.setItem(WATERMARK_KEY, String(value));
  } catch {
    // Without a watermark the worst case is a repeated alert, not a lost one.
  }
}

/* Raise device notifications for anything that arrived since the last check.
 *
 * The watermark is a timestamp rather than a list of seen ids: it survives a
 * reload, stays constant in size, and cannot re-announce the whole inbox the
 * first time the app opens on a new device.
 */
export function raiseAdminAlerts(items, settings, now = new Date()) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];

  const previous = readWatermark();
  const timestamps = list
    .map((item) => new Date(item.createdAt).getTime())
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return [];
  const newest = Math.max(...timestamps);

  // First run on this device: adopt the current position silently instead of
  // firing a notification for every historical row.
  if (!previous) {
    writeWatermark(newest);
    return [];
  }

  const fresh = list.filter((item) => {
    const created = new Date(item.createdAt).getTime();
    return Number.isFinite(created) && created > previous && !item.read;
  });

  writeWatermark(Math.max(previous, newest));

  const raised = fresh.filter((item) => shouldNotify(item.type, settings, now));
  raised.forEach((item) => {
    showNotification({
      title: item.title || 'Himaliya Spring Water',
      body: item.detail || '',
      type: item.type || 'general',
      id: item.id,
      url: TYPE_ROUTE[item.type] || '/app/notifications',
    });
  });
  return raised;
}
