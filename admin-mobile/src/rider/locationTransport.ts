import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import type { RiderLocationMode } from './model';

const PENDING_LOCATION_KEY = 'himaliya:rider:pending-location:v2';

export const RIDER_LOCATION_POLICIES = {
  balanced: {
    minimumIntervalMs: 30_000,
    minimumDistanceMeters: 50,
    heartbeatMs: 120_000,
  },
  data_saver: {
    minimumIntervalMs: 60_000,
    minimumDistanceMeters: 100,
    heartbeatMs: 300_000,
  },
} as const;

type RiderLocationPoint = {
  orderIds: string[];
  locationMode: RiderLocationMode;
  latitude: number;
  longitude: number;
  heading: number | null;
  recordedAt: number;
};

type PublishedLocation = RiderLocationPoint & {
  sentAt: number;
};

let lastPublished: PublishedLocation | null = null;
let groupedLocationRpcMissing = false;
let perOrderLocationRpcMissing = false;
let deliveredItemsRpcMissing = false;

function distanceMeters(left: RiderLocationPoint, right: RiderLocationPoint) {
  const earthRadius = 6_371_000;
  const latitudeDelta = (right.latitude - left.latitude) * Math.PI / 180;
  const longitudeDelta = (right.longitude - left.longitude) * Math.PI / 180;
  const leftLatitude = left.latitude * Math.PI / 180;
  const rightLatitude = right.latitude * Math.PI / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shouldPublish(point: RiderLocationPoint, force: boolean) {
  const pointKey = [...point.orderIds].sort().join(',');
  const publishedKey = lastPublished ? [...lastPublished.orderIds].sort().join(',') : '';
  if (force || !lastPublished || publishedKey !== pointKey) return true;
  const policy = RIDER_LOCATION_POLICIES[point.locationMode];
  const elapsed = Date.now() - lastPublished.sentAt;
  if (elapsed >= policy.heartbeatMs) return true;
  return elapsed >= policy.minimumIntervalMs
    && distanceMeters(lastPublished, point) >= policy.minimumDistanceMeters;
}

function isNetworkError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message || '')
    : String(error || '');
  return /network|fetch|connection|timeout|offline/i.test(message);
}

function isMissingRpc(error: unknown, functionName: string) {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message || '')
    : String(error || '');
  return code === 'PGRST202'
    || (message.toLocaleLowerCase().includes(functionName.toLocaleLowerCase())
      && /schema cache|could not find the function|function .* does not exist/i.test(message));
}

async function savePending(point: RiderLocationPoint) {
  await AsyncStorage.setItem(PENDING_LOCATION_KEY, JSON.stringify(point));
}

async function sendLocationViaDelivery(point: RiderLocationPoint) {
  const { data: orders, error: ordersError } = await supabase
    .from('customer_orders')
    .select('id,tracking_status,bottles_collected,bottles_dropped_off,delivered_items')
    .in('id', point.orderIds);
  if (ordersError) throw ordersError;

  const orderById = new Map((orders || []).map((order) => [order.id, order]));
  for (const orderId of point.orderIds) {
    const order = orderById.get(orderId);
    if (!order) throw new Error('The assigned delivery could not be found.');
    const payload = {
      p_order_id: orderId,
      p_tracking_status: order.tracking_status || 'assigned',
      p_bottles_collected: Math.max(0, Number(order.bottles_collected || 0)),
      p_bottles_dropped_off: Math.max(0, Number(order.bottles_dropped_off || 0)),
      p_rider_lat: point.latitude,
      p_rider_lng: point.longitude,
      p_rider_heading: point.heading,
    };
    if (!deliveredItemsRpcMissing) {
      const current = await supabase.rpc('update_rider_delivery', {
        ...payload,
        p_delivered_items: Array.isArray(order.delivered_items)
          ? order.delivered_items
          : null,
      });
      if (!current.error) continue;
      if (!isMissingRpc(current.error, 'update_rider_delivery')) throw current.error;
      deliveredItemsRpcMissing = true;
    }
    const oldest = await supabase.rpc('update_rider_delivery', payload);
    if (oldest.error) throw oldest.error;
  }
}

async function send(point: RiderLocationPoint) {
  let updatedAt: string | null = null;
  if (!groupedLocationRpcMissing) {
    const grouped = await supabase.rpc('update_rider_stop_location', {
      p_order_ids: point.orderIds,
      p_rider_lat: point.latitude,
      p_rider_lng: point.longitude,
      p_rider_heading: point.heading,
    });
    if (grouped.error) {
      if (!isMissingRpc(grouped.error, 'update_rider_stop_location')) throw grouped.error;
      groupedLocationRpcMissing = true;
    } else {
      updatedAt = typeof grouped.data === 'string' ? grouped.data : null;
    }
  }

  if (groupedLocationRpcMissing) {
    let useDeliveryFallback = perOrderLocationRpcMissing;
    if (!useDeliveryFallback) {
      for (const orderId of point.orderIds) {
        const legacy = await supabase.rpc('update_rider_location', {
          p_order_id: orderId,
          p_rider_lat: point.latitude,
          p_rider_lng: point.longitude,
          p_rider_heading: point.heading,
        });
        if (legacy.error) {
          if (!isMissingRpc(legacy.error, 'update_rider_location')) throw legacy.error;
          perOrderLocationRpcMissing = true;
          useDeliveryFallback = true;
          break;
        }
        if (typeof legacy.data === 'string') updatedAt = legacy.data;
      }
    }
    if (useDeliveryFallback) {
      await sendLocationViaDelivery(point);
      updatedAt = new Date().toISOString();
    }
  }
  lastPublished = { ...point, sentAt: Date.now() };
  await AsyncStorage.removeItem(PENDING_LOCATION_KEY);
  return updatedAt;
}

export async function submitRiderLocation(
  orderIds: string[],
  location: Location.LocationObject,
  locationMode: RiderLocationMode = 'balanced',
  force = false,
) {
  const point: RiderLocationPoint = {
    orderIds,
    locationMode,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    heading: location.coords.heading,
    recordedAt: location.timestamp || Date.now(),
  };
  if (!shouldPublish(point, force)) return { published: false, queued: false, updatedAt: null };

  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) {
    await savePending(point);
    return { published: false, queued: true, updatedAt: null };
  }

  try {
    const updatedAt = await send(point);
    return { published: true, queued: false, updatedAt };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await savePending(point);
    return { published: false, queued: true, updatedAt: null };
  }
}

export async function flushPendingRiderLocation() {
  const raw = await AsyncStorage.getItem(PENDING_LOCATION_KEY);
  if (!raw) return false;
  const point = JSON.parse(raw) as RiderLocationPoint;
  await send(point);
  return true;
}

export async function clearPendingRiderLocation() {
  lastPublished = null;
  await AsyncStorage.removeItem(PENDING_LOCATION_KEY);
}
