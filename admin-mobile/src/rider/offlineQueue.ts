import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import type { BottleItem, RiderOrder } from './model';

const DELIVERY_QUEUE_KEY = 'himaliya:rider:delivery-queue:v2';

export type DeliveryUpdate = {
  orderIds: string[];
  orderItems?: Array<{ orderId: string; items: BottleItem[] }>;
  trackingStatus: string;
  bottlesCollected: number;
  riderLat: number | null;
  riderLng: number | null;
  riderHeading: number | null;
  deliveredItems?: BottleItem[] | null;
  queuedAt?: string;
};

export type DeliveryUpdateResult = {
  orders: RiderOrder[];
  queued: boolean;
};

let flushPromise: Promise<number> | null = null;

async function readQueue(): Promise<DeliveryUpdate[]> {
  try {
    const value = await AsyncStorage.getItem(DELIVERY_QUEUE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: DeliveryUpdate[]) {
  await AsyncStorage.setItem(DELIVERY_QUEUE_KEY, JSON.stringify(queue));
}

async function queueUpdate(update: DeliveryUpdate) {
  const queue = await readQueue();
  const queueKey = [...update.orderIds].sort().join(',');
  const previous = queue.find((item) => [...item.orderIds].sort().join(',') === queueKey);
  const next = {
    ...previous,
    ...update,
    deliveredItems: update.deliveredItems === undefined
      ? previous?.deliveredItems
      : update.deliveredItems,
    queuedAt: new Date().toISOString(),
  };
  await writeQueue([
    ...queue.filter((item) => [...item.orderIds].sort().join(',') !== queueKey),
    next,
  ]);
  return next;
}

function rpcPayload(update: DeliveryUpdate) {
  return {
    p_order_ids: update.orderIds,
    p_tracking_status: update.trackingStatus,
    p_bottles_collected: Math.max(0, Number(update.bottlesCollected || 0)),
    p_rider_lat: update.riderLat,
    p_rider_lng: update.riderLng,
    p_rider_heading: update.riderHeading,
    p_delivered_items: update.deliveredItems ?? null,
  };
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

function deliveredItemsByOrder(update: DeliveryUpdate) {
  const remaining = new Map((update.deliveredItems || []).map((item) => [
    item.bottleType.trim().toLocaleLowerCase(),
    Math.max(0, Number(item.quantity || 0)),
  ]));
  const allocation = new Map<string, BottleItem[]>();

  (update.orderItems || []).forEach(({ orderId, items }) => {
    const delivered = items.map((item) => {
      const key = item.bottleType.trim().toLocaleLowerCase();
      const quantity = Math.min(
        Math.max(0, Number(item.quantity || 0)),
        remaining.get(key) || 0,
      );
      remaining.set(key, Math.max(0, (remaining.get(key) || 0) - quantity));
      return { bottleType: item.bottleType, quantity };
    }).filter((item) => item.quantity > 0);
    allocation.set(orderId, delivered);
  });

  if (!update.orderItems?.length && update.orderIds[0]) {
    allocation.set(update.orderIds[0], update.deliveredItems || []);
  }
  return allocation;
}

async function sendLegacyUpdate(update: DeliveryUpdate): Promise<RiderOrder[]> {
  const allocations = deliveredItemsByOrder(update);
  const changed: RiderOrder[] = [];
  for (let index = 0; index < update.orderIds.length; index += 1) {
    const orderId = update.orderIds[index];
    const deliveredItems = update.trackingStatus === 'delivered'
      ? allocations.get(orderId) || []
      : [];
    const { data, error } = await supabase.rpc('update_rider_delivery', {
      p_order_id: orderId,
      p_tracking_status: update.trackingStatus,
      p_bottles_collected: update.trackingStatus === 'delivered' && index === 0
        ? Math.max(0, Number(update.bottlesCollected || 0))
        : 0,
      p_bottles_dropped_off: deliveredItems.reduce((sum, item) => sum + item.quantity, 0),
      p_rider_lat: update.riderLat,
      p_rider_lng: update.riderLng,
      p_rider_heading: update.riderHeading,
      p_delivered_items: update.trackingStatus === 'delivered' ? deliveredItems : null,
    });
    if (error) throw error;
    if (Array.isArray(data)) changed.push(...data as RiderOrder[]);
    else if (data) changed.push(data as RiderOrder);
  }
  return changed;
}

async function sendUpdate(update: DeliveryUpdate): Promise<RiderOrder[]> {
  const { data, error } = await supabase.rpc('update_rider_delivery_stop', rpcPayload(update));
  if (error) {
    if (isMissingRpc(error, 'update_rider_delivery_stop')) return sendLegacyUpdate(update);
    throw error;
  }
  return (Array.isArray(data) ? data : data ? [data] : []) as RiderOrder[];
}

export async function submitDeliveryUpdate(update: DeliveryUpdate): Promise<DeliveryUpdateResult> {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) {
    await queueUpdate(update);
    return { orders: [], queued: true };
  }
  try {
    return { orders: await sendUpdate(update), queued: false };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await queueUpdate(update);
    return { orders: [], queued: true };
  }
}

export async function flushDeliveryQueue() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    const network = await NetInfo.fetch();
    if (!network.isConnected || network.isInternetReachable === false) return (await readQueue()).length;
    const queue = await readQueue();
    const remaining: DeliveryUpdate[] = [];
    for (let index = 0; index < queue.length; index += 1) {
      const update = queue[index];
      try {
        await sendUpdate(update);
      } catch (error) {
        remaining.push(...queue.slice(index));
        if (!isNetworkError(error)) throw error;
        break;
      }
    }
    await writeQueue(remaining);
    return remaining.length;
  })().finally(() => { flushPromise = null; });
  return flushPromise;
}

export async function queuedDeliveryCount() {
  return (await readQueue()).length;
}
