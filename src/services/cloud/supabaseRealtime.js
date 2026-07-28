import { createClient } from '@supabase/supabase-js';
import { getAccessToken, getSessionReadyEventName } from './supabaseClient';

let realtimeClient = null;
let realtimeUnavailable = false;

function getRealtimeClient() {
  if (realtimeClient || realtimeUnavailable) return realtimeClient;
  const url = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;
  try {
    realtimeClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    // The public tracking page continues with its 15-second polling fallback.
    // This protects customers from a broken optional Realtime bundle.
    realtimeUnavailable = true;
    console.warn('Live delivery updates are temporarily unavailable.', error);
  }
  return realtimeClient;
}

export function subscribeToPublicDeliveryTracking(trackingToken, onUpdate) {
  const client = getRealtimeClient();
  if (!client || !trackingToken) return () => {};

  const channel = client
    .channel(`delivery:${trackingToken}`, { config: { private: false } })
    .on('broadcast', { event: 'tracking_update' }, (message) => {
      onUpdate(message && message.payload ? message.payload : message || {});
    })
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeToRiderWorkspace(riderId, handlers = {}) {
  const client = getRealtimeClient();
  const token = getAccessToken();
  if (!client || !token || !riderId) return () => {};

  let cancelled = false;
  let channel = null;
  const setRealtimeToken = () => {
    const nextToken = getAccessToken();
    if (nextToken) client.realtime.setAuth(nextToken);
  };
  const sessionReadyEvent = getSessionReadyEventName();
  window.addEventListener(sessionReadyEvent, setRealtimeToken);

  Promise.resolve(client.realtime.setAuth(token)).then(() => {
    if (cancelled) return;
    let workspaceChannel = client
      .channel(`rider-workspace:${riderId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'customer_orders',
        filter: `assigned_rider_id=eq.${riderId}`,
      }, (payload) => {
        if (handlers.onOrderChange) handlers.onOrderChange(payload);
      });
    if (handlers.onDispatchChange) {
      workspaceChannel = workspaceChannel.on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rider_dispatch_messages',
        filter: `rider_id=eq.${riderId}`,
      }, (payload) => {
        handlers.onDispatchChange(payload);
      });
    }
    channel = workspaceChannel.subscribe();
  }).catch(() => {});

  return () => {
    cancelled = true;
    window.removeEventListener(sessionReadyEvent, setRealtimeToken);
    if (channel) client.removeChannel(channel);
  };
}
