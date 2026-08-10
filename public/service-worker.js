/* Himaliya Spring Water - notification service worker.
 *
 * This worker exists for one reason: notifications. Android Chrome refuses to
 * construct `new Notification(...)` from a page and throws "Illegal
 * constructor", so every mobile notification has to be raised from a service
 * worker through registration.showNotification(). That is the whole job.
 *
 * It deliberately has NO fetch handler and NO caching. An earlier offline
 * worker served stale HTML to phones that restore tabs from memory, which is
 * why src/serviceWorker.js still carries cleanup code. Adding a fetch handler
 * here would bring that failure back.
 */

const NOTIFICATION_TAG_PREFIX = 'himaliya';
const DEFAULT_ICON = '/icon-192.png';
const DEFAULT_BADGE = '/notification-badge.png';

function resolveNotificationTarget(value) {
  const fallback = new URL('/', self.location.origin);
  try {
    const target = new URL(String(value || '/'), self.location.origin);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== self.location.origin) {
      return fallback;
    }
    return target;
  } catch {
    return fallback;
  }
}

self.addEventListener('install', () => {
  // Take over immediately: a user who just granted permission should not have
  // to close every tab before the first notification can be shown.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function buildOptions(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const targetUrl = resolveNotificationTarget(data.url);
  return {
    body: data.body || '',
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,
    // Renotify needs a tag, and a stable tag also collapses repeat alerts for
    // the same invoice or order instead of stacking duplicates.
    tag: data.tag || `${NOTIFICATION_TAG_PREFIX}-general`,
    renotify: data.renotify !== false,
    requireInteraction: Boolean(data.requireInteraction),
    silent: Boolean(data.silent),
    timestamp: Number(data.timestamp) || Date.now(),
    // Short buzz. Android ignores this when the channel is set to silent, and
    // desktop ignores it entirely, so it is safe to always send.
    vibrate: data.silent ? undefined : (data.vibrate || [110, 60, 110]),
    data: {
      url: `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`,
      type: data.type || 'general',
      id: data.id || '',
    },
  };
}

function showNotification(payload) {
  const title = (payload && payload.title) || 'Himaliya Spring Water';
  return self.registration.showNotification(title, buildOptions(payload));
}

/* Real Web Push delivery. Fires even when the browser is closed, provided the
 * subscription was created with a VAPID key and a server actually sends. */
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'Himaliya Spring Water', body: event.data.text() };
    }
  }
  event.waitUntil(showNotification(payload));
});

/* Page-driven notifications. The app posts here while it is open, because the
 * page itself cannot construct a Notification on Android. */
self.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type !== 'SHOW_NOTIFICATION') return;
  event.waitUntil(showNotification(message.payload));
});

/* A notification that does not open anything when tapped reads as broken, so
 * focus an existing tab where possible and fall back to opening one. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = resolveNotificationTarget(
    event.notification.data && event.notification.data.url,
  );

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    const sameOrigin = windows.filter((client) => (
      new URL(client.url).origin === target.origin
    ));
    const exact = sameOrigin.find((client) => new URL(client.url).pathname === target.pathname);
    const reusable = exact || sameOrigin[0];

    if (reusable) {
      await reusable.focus();
      // The SPA owns routing, so hand the path over instead of reloading it.
      if (!exact && 'navigate' in reusable) {
        await reusable.navigate(target.href).catch(() => {});
      }
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});

/* Chrome rotates push subscriptions. Without this the endpoint silently dies
 * and the user is left thinking notifications are still on. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const applicationServerKey = event.oldSubscription
      && event.oldSubscription.options
      && event.oldSubscription.options.applicationServerKey;
    if (!applicationServerKey) return;

    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({
      type: 'PUSH_SUBSCRIPTION_CHANGED',
      subscription: subscription.toJSON(),
    }));
  })());
});
