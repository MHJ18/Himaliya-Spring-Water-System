/* send-push — the Web Push sender.
 *
 * Why this exists: the browser client already subscribes every admin, rider and
 * customer device to the W3C Push API and stores each subscription in
 * public.push_subscriptions. That machinery delivers nothing on its own. A push
 * only reaches a *closed* browser when a server signs a request with the VAPID
 * private key, encrypts the payload for that specific subscription, and POSTs it
 * to the endpoint's push service. That server is this function.
 *
 * It is invoked once per public.customer_notifications row by the database
 * trigger customer_notifications_dispatch_push (see the migration), which passes
 * { notificationId }. The function then:
 *   1. loads the notification with the service role,
 *   2. resolves the target subscriptions from its audience,
 *   3. encrypts + signs one message per subscription (via web-push, which does
 *      the RFC 8291 aes128gcm crypto), and sends it with fetch,
 *   4. deactivates any endpoint the push service reports as gone (404/410).
 *
 * The VAPID key pair is the trust anchor: the public key ships to the browser in
 * REACT_APP_VAPID_PUBLIC_KEY and pins every subscription; the private key lives
 * only here as the VAPID_PRIVATE_KEY secret and must never reach the client.
 */

import webpush from 'web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/* Mirror admin-create-user: prefer the classic service-role key, fall back to
 * the newer JSON secret-key bundle so the function works on either project era. */
function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '';
  } catch {
    return '';
  }
}

async function rest<T>(url: string, key: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = (body as Record<string, unknown> | null)?.message
      || (body as Record<string, unknown> | null)?.error
      || 'Supabase request failed.';
    const error = new Error(String(message)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

type NotificationRow = {
  id: string;
  owner_id: string;
  auth_user_id: string | null;
  audience: 'admin' | 'customer';
  type: string;
  title: string;
  detail: string;
  order_id: string | null;
};

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/* Deep-link a tapped notification to a page that actually exists. The service
 * worker and client both re-sanitise this to a same-origin path, so an unknown
 * value degrades to "/" rather than breaking. */
function targetPath(notification: NotificationRow): string {
  const orderPath = notification.order_id ? '/app/customer-orders' : '/notifications';
  if (notification.audience === 'customer') {
    if (notification.type === 'message') return '/customer/messages';
    return '/customer/app';
  }
  switch (notification.type) {
    case 'tracking':
      return '/app/rider-tracking';
    case 'order':
      return orderPath;
    case 'message':
      return '/messages';
    default:
      return '/notifications';
  }
}

async function resolveSubscriptions(
  url: string,
  key: string,
  notification: NotificationRow,
): Promise<SubscriptionRow[]> {
  const select = 'select=endpoint,p256dh,auth';

  // A notification aimed at one identity (any customer notification, or an admin
  // note pinned to a single admin) goes only to that user's devices.
  if (notification.audience === 'customer' || notification.auth_user_id) {
    const userId = notification.auth_user_id;
    if (!userId) return [];
    return rest<SubscriptionRow[]>(
      url,
      key,
      `/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}`
        + `&active=eq.true&${select}`,
    );
  }

  // A broadcast admin notification reaches every active staff device for the
  // business. push_subscriptions.owner_id alone is not enough — customers of the
  // same business share that owner_id — so restrict to admin_profiles identities.
  const admins = await rest<Array<{ auth_user_id: string | null }>>(
    url,
    key,
    `/rest/v1/admin_profiles?owner_id=eq.${encodeURIComponent(notification.owner_id)}`
      + '&active=eq.true&select=auth_user_id',
  );
  const ids = admins.map((row) => row.auth_user_id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const inList = ids.map((id) => `"${id}"`).join(',');
  return rest<SubscriptionRow[]>(
    url,
    key,
    `/rest/v1/push_subscriptions?owner_id=eq.${encodeURIComponent(notification.owner_id)}`
      + `&active=eq.true&user_id=in.(${encodeURIComponent(inList)})&${select}`,
  );
}

/* One Web Push delivery. web-push builds the encrypted body and VAPID headers;
 * fetch is the transport so the function never depends on node:https. Returns
 * the endpoint's HTTP status (or 0 on a network error) so the caller can prune. */
async function deliver(subscription: SubscriptionRow, payload: string): Promise<number> {
  try {
    const details = webpush.generateRequestDetails(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payload,
      { TTL: 3600 },
    );
    const headers = { ...details.headers } as Record<string, string>;
    // fetch derives Content-Length from the body; a manual one triggers a mismatch.
    delete headers['Content-Length'];
    delete headers['content-length'];
    const response = await fetch(details.endpoint, {
      method: details.method,
      headers,
      body: details.body as unknown as BodyInit,
    });
    // Drain so the connection can be reused/closed cleanly.
    await response.arrayBuffer().catch(() => undefined);
    return response.status;
  } catch {
    // A malformed key or a transport error — count it as failed but leave the
    // row active; only the push service's 404/410 is proof an endpoint is dead.
    return 0;
  }
}

async function deactivateEndpoint(url: string, key: string, endpoint: string) {
  await rest(
    url,
    key,
    `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
    },
  ).catch(() => {
    // Pruning is best-effort; a stale row only costs one wasted send next time.
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { message: 'Method not allowed.' });

  const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET') || '';
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = (Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@himaliya.app').trim();
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = serviceKey();

  if (!dispatchSecret || !vapidPublic || !vapidPrivate || !url || !key) {
    // Missing config must not look like a delivery failure to the trigger.
    return json(503, { message: 'Push sending is not configured.' });
  }

  // Constant work regardless of match would be ideal, but a plain compare is
  // acceptable here: the secret is high-entropy and never surfaced to clients.
  if ((request.headers.get('x-push-secret') || '') !== dispatchSecret) {
    return json(401, { message: 'Not authorized to send push notifications.' });
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch {
    return json(503, { message: 'The VAPID key pair is invalid.' });
  }

  let requestBody: { notificationId?: string };
  try {
    requestBody = await request.json();
  } catch {
    return json(400, { message: 'A JSON body with notificationId is required.' });
  }

  const notificationId = String(requestBody.notificationId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(notificationId)) {
    return json(400, { message: 'A valid notificationId is required.' });
  }

  try {
    const rows = await rest<NotificationRow[]>(
      url,
      key,
      `/rest/v1/customer_notifications?id=eq.${encodeURIComponent(notificationId)}`
        + '&select=id,owner_id,auth_user_id,audience,type,title,detail,order_id&limit=1',
    );
    const notification = rows?.[0];
    if (!notification) return json(404, { message: 'Notification not found.' });

    const subscriptions = await resolveSubscriptions(url, key, notification);
    if (subscriptions.length === 0) {
      return json(200, { sent: 0, failed: 0, pruned: 0, recipients: 0 });
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.detail,
      url: targetPath(notification),
      type: notification.type,
      id: notification.id,
      tag: `himaliya-${notification.type}-${notification.order_id || notification.id}`,
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;
    let pruned = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      const status = await deliver(subscription, payload);
      if (status >= 200 && status < 300) {
        sent += 1;
        return;
      }
      failed += 1;
      // 404 Not Found / 410 Gone are the push service telling us the endpoint is
      // permanently dead; anything else may be transient, so leave it active.
      if (status === 404 || status === 410) {
        pruned += 1;
        await deactivateEndpoint(url, key, subscription.endpoint);
      }
    }));

    return json(200, { sent, failed, pruned, recipients: subscriptions.length });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 401 || status === 403) {
      return json(500, { message: 'The service role key is not authorized to read notifications.' });
    }
    return json(500, { message: 'Push dispatch failed.' });
  }
});
