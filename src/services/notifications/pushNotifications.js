/* Browser and mobile notification delivery.
 *
 * Why this module exists: the portal used to call `new Notification(...)`
 * directly. That works on desktop and throws "Illegal constructor" on Android
 * Chrome, where the only supported path is
 * ServiceWorkerRegistration.showNotification(). The throw was swallowed by a
 * try/catch, so phones reported notifications as "enabled" and then never
 * showed a single one.
 *
 * Everything here routes through the service worker first and only falls back
 * to the page-level constructor on desktop browsers that lack a worker.
 */

import { dbRequest, getStoredSession } from '../cloud/supabaseClient';

const SERVICE_WORKER_URL = '/service-worker.js';
const SUBSCRIPTION_SYNC_KEY = 'hs_push_subscription_endpoint';

let registrationPromise = null;

export function normalizeNotificationUrl(value, origin) {
  const fallback = '/';
  const baseOrigin = origin || (
    typeof window !== 'undefined' && window.location ? window.location.origin : ''
  );
  if (!baseOrigin) return fallback;

  try {
    const base = new URL(baseOrigin);
    const target = new URL(String(value || fallback), base);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== base.origin) {
      return fallback;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isServiceWorkerSupported() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export function isPushSupported() {
  return isServiceWorkerSupported() && typeof window !== 'undefined' && 'PushManager' in window;
}

export function getPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

/* iOS only allows web notifications for a home-screen install, and it fails
 * silently otherwise. Surfacing that is the difference between a user fixing
 * it in ten seconds and assuming the app is broken. */
export function getInstallRequirement() {
  if (typeof window === 'undefined') return null;
  const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  if (!isIos) return null;
  const installed = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (installed) return null;
  return 'On iPhone and iPad, notifications only work after you add this app to your Home Screen with Share → Add to Home Screen.';
}

export function getVapidPublicKey() {
  return (process.env.REACT_APP_VAPID_PUBLIC_KEY || '').trim();
}

export function isBackgroundPushConfigured() {
  return Boolean(getVapidPublicKey()) && isPushSupported();
}

export function registerNotificationWorker() {
  if (!isServiceWorkerSupported()) return Promise.resolve(null);
  if (registrationPromise) return registrationPromise;

  registrationPromise = navigator.serviceWorker
    .register(SERVICE_WORKER_URL)
    .then((registration) => navigator.serviceWorker.ready.then(() => registration))
    .catch((error) => {
      // A failed worker must never block the app; notifications degrade to the
      // desktop constructor and the UI reports the reduced capability.
      console.warn('Notification service worker could not be registered.', error);
      registrationPromise = null;
      return null;
    });

  return registrationPromise;
}

async function getRegistration() {
  if (!isServiceWorkerSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  if (existing) return existing;
  return registerNotificationWorker();
}

/* Show a notification now. Returns the transport that was actually used so
 * callers and tests can tell a real delivery from a silent no-op. */
export async function showNotification({
  title, body, url = '/', tag, type = 'general', id = '', requireInteraction = false, silent = false,
}) {
  if (!isNotificationSupported() || window.Notification.permission !== 'granted') return 'blocked';

  const safeUrl = normalizeNotificationUrl(url);

  const payload = {
    title,
    body,
    url: safeUrl,
    type,
    id,
    tag: tag || `himaliya-${type}`,
    requireInteraction,
    silent,
    timestamp: Date.now(),
  };

  const registration = await getRegistration();
  if (registration) {
    try {
      await registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/notification-badge.png',
        tag: payload.tag,
        renotify: true,
        requireInteraction,
        silent,
        timestamp: payload.timestamp,
        vibrate: silent ? undefined : [110, 60, 110],
        data: { url: safeUrl, type, id },
      });
      return 'service-worker';
    } catch (error) {
      console.warn('Service worker notification failed; trying the page fallback.', error);
    }
  }

  // Desktop-only fallback. This is exactly the call that throws on Android, so
  // it is reached last and its failure is reported rather than swallowed.
  try {
    const notification = new window.Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: payload.tag,
    });
    notification.onclick = () => {
      window.focus();
      if (safeUrl !== window.location.pathname) window.location.assign(safeUrl);
      notification.close();
    };
    return 'page';
  } catch (error) {
    console.warn('This browser cannot display notifications from the page.', error);
    return 'unsupported';
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function describeDevice() {
  const agent = window.navigator.userAgent;
  if (/Android/i.test(agent)) return 'android';
  if (/iPad|iPhone|iPod/.test(agent)) return 'ios';
  return 'desktop';
}

export async function saveSubscription(subscription) {
  const session = getStoredSession();
  if (!session || !subscription) return false;
  const payload = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
  if (!payload || !payload.endpoint) return false;

  await dbRequest('/push_subscriptions?on_conflict=endpoint', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({
      endpoint: payload.endpoint,
      p256dh: payload.keys && payload.keys.p256dh,
      auth: payload.keys && payload.keys.auth,
      platform: describeDevice(),
      user_agent: String(window.navigator.userAgent || '').slice(0, 400),
      active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  try {
    window.localStorage.setItem(SUBSCRIPTION_SYNC_KEY, payload.endpoint);
  } catch {
    // A stored endpoint is only an optimisation for the next visit.
  }
  return true;
}

/* Subscribe to real background push. Only possible once a VAPID key is
 * configured; without one the app still delivers notifications while open. */
export async function subscribeToBackgroundPush() {
  const applicationServerKey = getVapidPublicKey();
  if (!applicationServerKey || !isPushSupported()) return null;

  const registration = await getRegistration();
  if (!registration || !registration.pushManager) return null;

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
    });
    await saveSubscription(subscription).catch((error) => {
      // Losing the server copy means no background push, but the local
      // subscription still works for anything the page raises.
      console.warn('Push subscription could not be stored.', error);
    });
    return subscription;
  } catch (error) {
    console.warn('Background push subscription failed.', error);
    return null;
  }
}

/* Opportunistically register a background-push endpoint for a device that
 * already granted notification permission. This matters the moment a VAPID key
 * is first deployed: every previously-enabled device only has page-level
 * permission and no push subscription, and the "Enable" button is disabled once
 * permission is granted, so nothing else would ever create one. It never
 * prompts — subscribing is skipped unless permission is already 'granted' — and
 * reuses any existing subscription, so it is safe to call on every page load. */
export async function ensureBackgroundPushSubscribed() {
  if (!isBackgroundPushConfigured() || getPermission() !== 'granted') return null;
  return subscribeToBackgroundPush();
}

export async function unsubscribeFromBackgroundPush() {
  if (!isPushSupported()) return false;
  const registration = await getRegistration();
  if (!registration || !registration.pushManager) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => {});
  await dbRequest(`/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
  }).catch(() => {});

  try {
    window.localStorage.removeItem(SUBSCRIPTION_SYNC_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
  return true;
}

/* Ask for permission and wire up every transport the device supports. */
export async function enableNotifications() {
  if (!isNotificationSupported()) {
    return { permission: 'unsupported', pushEnabled: false, installHint: getInstallRequirement() };
  }

  await registerNotificationWorker();
  const permission = await window.Notification.requestPermission();
  if (permission !== 'granted') {
    return { permission, pushEnabled: false, installHint: getInstallRequirement() };
  }

  const subscription = await subscribeToBackgroundPush();
  const transport = await showNotification({
    title: 'Notifications are on',
    body: 'Order, delivery, and invoice updates will arrive here.',
    type: 'system',
    tag: 'himaliya-system',
    url: '/',
  });

  return {
    permission,
    pushEnabled: Boolean(subscription),
    transport,
    installHint: getInstallRequirement(),
  };
}

/* Keep the stored subscription current when Chrome rotates the endpoint. */
export function listenForSubscriptionChanges() {
  if (!isServiceWorkerSupported()) return () => {};
  const handleMessage = (event) => {
    const message = event.data || {};
    if (message.type !== 'PUSH_SUBSCRIPTION_CHANGED') return;
    saveSubscription(message.subscription).catch(() => {});
  };
  navigator.serviceWorker.addEventListener('message', handleMessage);
  return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
}
