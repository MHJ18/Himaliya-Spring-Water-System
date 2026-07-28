import {
  dbRequest,
  getStoredSession,
  isSupabaseConfigured,
  signOut,
} from '../cloud/supabaseClient';
import { canonicalBottleType } from '../../utils/orderPricing';

let groupedLocationRpcMissing = false;
let perOrderLocationRpcMissing = false;
let deliveredItemsRpcMissing = false;

export function resetRiderRpcCompatibilityCache() {
  groupedLocationRpcMissing = false;
  perOrderLocationRpcMissing = false;
  deliveredItemsRpcMissing = false;
}

function requireCloud() {
  if (!isSupabaseConfigured()) throw new Error('Supabase configuration is required.');
}

function currentUserId() {
  const session = getStoredSession();
  return session && session.user && session.user.id;
}

function isMissingRpc(error, functionName) {
  const code = error && error.code ? String(error.code) : '';
  const message = error && error.message ? String(error.message) : String(error || '');
  return code === 'PGRST202'
    || (
      message.toLocaleLowerCase().includes(functionName.toLocaleLowerCase())
      && /schema cache|could not find the function|function .* does not exist/i.test(message)
    );
}

function deliveredItemsByOrder(stop, deliveredItems) {
  const remaining = new Map();
  (Array.isArray(deliveredItems) ? deliveredItems : []).forEach((item) => {
    const bottleType = canonicalBottleType(item && item.bottleType);
    if (!bottleType) return;
    const quantity = Math.max(0, Number(item && item.quantity) || 0);
    const key = bottleType.toLocaleLowerCase();
    remaining.set(key, (remaining.get(key) || 0) + quantity);
  });

  const allocations = new Map();
  (stop.orders || []).forEach((order) => {
    const delivered = (order.items || []).map((item) => {
      const bottleType = canonicalBottleType(item && item.bottleType);
      const key = bottleType.toLocaleLowerCase();
      const quantity = Math.min(
        Math.max(0, Number(item && item.quantity) || 0),
        remaining.get(key) || 0,
      );
      remaining.set(key, Math.max(0, (remaining.get(key) || 0) - quantity));
      return { bottleType, quantity };
    }).filter((item) => item.bottleType && item.quantity > 0);
    allocations.set(order.id, delivered);
  });

  if (!(stop.orders || []).length && stop.orderIds && stop.orderIds[0]) {
    allocations.set(stop.orderIds[0], deliveredItems || []);
  }
  return allocations;
}

async function callLegacyRiderDelivery(payload, deliveredItems) {
  if (!deliveredItemsRpcMissing) {
    try {
      return await dbRequest('/rpc/update_rider_delivery', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          p_delivered_items: deliveredItems,
        }),
      });
    } catch (error) {
      if (!isMissingRpc(error, 'update_rider_delivery')) throw error;
      deliveredItemsRpcMissing = true;
    }
  }
  return dbRequest('/rpc/update_rider_delivery', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function toRider(row) {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    name: row.name || 'Rider',
    email: row.email || '',
    phone: row.phone || '',
    photo: row.photo || '',
    preferences: row.preferences || { theme: 'light' },
    active: row.active !== false,
    mustChangePassword: row.must_change_password === true,
  };
}

export function toRiderOrder(row) {
  const customer = row.customers || null;
  const items = (Array.isArray(row.items) ? row.items : [])
    .map((item) => ({
      bottleType: canonicalBottleType(item && item.bottleType),
      quantity: Math.max(0, Number(item && item.quantity) || 0),
    }))
    .filter((item) => item.bottleType && item.quantity > 0);
  return {
    id: row.id,
    customerId: row.customer_id,
    quantity: Number(row.quantity || 0),
    bottleType: canonicalBottleType(row.bottle_type),
    items: items.length ? items : [{
      bottleType: canonicalBottleType(row.bottle_type),
      quantity: Number(row.quantity || 0),
    }],
    deliveredItems: Array.isArray(row.delivered_items) ? row.delivered_items : [],
    deliveryAddress: row.delivery_address || (customer && customer.address) || '',
    deliveryDate: row.delivery_date,
    notes: row.notes || '',
    status: row.status,
    trackingStatus: row.tracking_status || 'assigned',
    trackingToken: row.tracking_token,
    bottlesCollected: Number(row.bottles_collected || 0),
    bottlesDroppedOff: Number(row.bottles_dropped_off || 0),
    riderLat: row.rider_lat == null ? null : Number(row.rider_lat),
    riderLng: row.rider_lng == null ? null : Number(row.rider_lng),
    riderHeading: row.rider_heading == null ? null : Number(row.rider_heading),
    assignedAt: row.assigned_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    customer: customer ? {
      id: customer.id,
      name: customer.name || 'Customer',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
    } : null,
  };
}

export async function getRiderProfile() {
  requireCloud();
  const userId = currentUserId();
  if (!userId) throw new Error('Your session has expired. Please sign in again.');
  const rows = await dbRequest(`/admin_profiles?auth_user_id=eq.${encodeURIComponent(userId)}&role=eq.Rider&active=eq.true&select=id,auth_user_id,name,email,phone,photo,preferences,active,must_change_password&limit=1`);
  if (!rows || !rows[0]) throw new Error('This account does not have active rider access.');
  return toRider(rows[0]);
}

export async function updateRiderProfile(profile) {
  requireCloud();
  const result = await dbRequest('/rpc/update_rider_profile', {
    method: 'POST',
    body: JSON.stringify({
      p_name: String(profile.name || '').trim(),
      p_phone: String(profile.phone || '').trim(),
      p_photo: profile.photo || '',
      p_theme: profile.theme === 'dark' ? 'dark' : 'light',
    }),
  });
  const row = Array.isArray(result) ? result[0] : result;
  if (!row) throw new Error('The rider profile could not be updated.');
  return toRider(row);
}

export async function getRiderOrders() {
  requireCloud();
  const columns = [
    'id',
    'customer_id',
    'quantity',
    'bottle_type',
    'items',
    'delivered_items',
    'delivery_address',
    'delivery_date',
    'notes',
    'status',
    'tracking_status',
    'tracking_token',
    'bottles_collected',
    'bottles_dropped_off',
    'rider_lat',
    'rider_lng',
    'rider_heading',
    'assigned_at',
    'delivered_at',
    'created_at',
    'customers(id,name,phone,email,address)',
  ].join(',');
  const rows = await dbRequest(`/customer_orders?select=${columns}&order=delivery_date.asc,created_at.desc`);
  return (rows || []).map(toRiderOrder);
}

export async function getRiderOrder(orderId) {
  requireCloud();
  const rows = await dbRequest(`/customer_orders?id=eq.${encodeURIComponent(orderId)}&select=*,customers(id,name,phone,email,address)&limit=1`);
  return rows && rows[0] ? toRiderOrder(rows[0]) : null;
}

export async function updateRiderStop(stop, update) {
  requireCloud();
  const valueOrCurrent = (value, current) => (
    value !== undefined && value !== null ? value : current
  );
  const primaryOrder = stop.primaryOrder || stop.orders[0];
  const trackingStatus = update.trackingStatus || stop.trackingStatus;
  const bottlesCollected = Number(
    valueOrCurrent(update.bottlesCollected, stop.bottlesCollected),
  ) || 0;
  const riderLat = valueOrCurrent(update.riderLat, primaryOrder.riderLat);
  const riderLng = valueOrCurrent(update.riderLng, primaryOrder.riderLng);
  const riderHeading = valueOrCurrent(update.riderHeading, primaryOrder.riderHeading);
  let result;
  try {
    result = await dbRequest('/rpc/update_rider_delivery_stop', {
      method: 'POST',
      body: JSON.stringify({
        p_order_ids: stop.orderIds,
        p_tracking_status: trackingStatus,
        p_bottles_collected: bottlesCollected,
        p_rider_lat: riderLat,
        p_rider_lng: riderLng,
        p_rider_heading: riderHeading,
        p_delivered_items: update.deliveredItems || null,
      }),
    });
  } catch (error) {
    if (!isMissingRpc(error, 'update_rider_delivery_stop')) throw error;
    const allocations = deliveredItemsByOrder(stop, update.deliveredItems);
    const changed = [];
    for (let index = 0; index < stop.orderIds.length; index += 1) {
      const orderId = stop.orderIds[index];
      const deliveredItems = trackingStatus === 'delivered'
        ? allocations.get(orderId) || []
        : [];
      const legacyPayload = {
        p_order_id: orderId,
        p_tracking_status: trackingStatus,
        p_bottles_collected: trackingStatus === 'delivered' && index === 0
          ? Math.max(0, bottlesCollected)
          : 0,
        p_bottles_dropped_off: deliveredItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
        p_rider_lat: riderLat,
        p_rider_lng: riderLng,
        p_rider_heading: riderHeading,
      };
      const legacyResult = await callLegacyRiderDelivery(
        legacyPayload,
        trackingStatus === 'delivered' ? deliveredItems : null,
      );
      if (Array.isArray(legacyResult)) changed.push(...legacyResult);
      else if (legacyResult) changed.push(legacyResult);
    }
    result = changed;
  }
  const rows = Array.isArray(result) ? result : (result ? [result] : []);
  if (!rows.length) throw new Error('The delivery update could not be saved.');
  return rows.map((row) => {
    const original = stop.orders.find((order) => order.id === row.id) || primaryOrder;
    return toRiderOrder({ ...row, customers: original.customer });
  });
}

export async function updateRiderStopLocation(stop, update) {
  requireCloud();
  if (!groupedLocationRpcMissing) {
    try {
      await dbRequest('/rpc/update_rider_stop_location', {
        method: 'POST',
        body: JSON.stringify({
          p_order_ids: stop.orderIds,
          p_rider_lat: update.riderLat,
          p_rider_lng: update.riderLng,
          p_rider_heading: update.riderHeading,
        }),
      });
    } catch (error) {
      if (!isMissingRpc(error, 'update_rider_stop_location')) throw error;
      groupedLocationRpcMissing = true;
    }
  }

  if (groupedLocationRpcMissing) {
    let locationRpcMissing = perOrderLocationRpcMissing;
    if (!locationRpcMissing) {
      for (let index = 0; index < stop.orderIds.length; index += 1) {
        try {
          await dbRequest('/rpc/update_rider_location', {
            method: 'POST',
            body: JSON.stringify({
              p_order_id: stop.orderIds[index],
              p_rider_lat: update.riderLat,
              p_rider_lng: update.riderLng,
              p_rider_heading: update.riderHeading,
            }),
          });
        } catch (locationError) {
          if (!isMissingRpc(locationError, 'update_rider_location')) throw locationError;
          perOrderLocationRpcMissing = true;
          locationRpcMissing = true;
          break;
        }
      }
    }

    if (locationRpcMissing) {
      for (let index = 0; index < stop.orderIds.length; index += 1) {
        const orderId = stop.orderIds[index];
        const order = (stop.orders || []).find((item) => item.id === orderId)
          || stop.primaryOrder
          || {};
        const deliveredItems = Array.isArray(order.deliveredItems)
          ? order.deliveredItems
          : null;
        await callLegacyRiderDelivery({
          p_order_id: orderId,
          p_tracking_status: order.trackingStatus || stop.trackingStatus || 'assigned',
          p_bottles_collected: Math.max(0, Number(order.bottlesCollected || 0)),
          p_bottles_dropped_off: Math.max(
            0,
            Number(order.bottlesDroppedOff || 0),
          ),
          p_rider_lat: update.riderLat,
          p_rider_lng: update.riderLng,
          p_rider_heading: update.riderHeading,
        }, deliveredItems);
      }
    }
  }
  return {
    orderIds: stop.orderIds,
    riderLat: update.riderLat,
    riderLng: update.riderLng,
    riderHeading: update.riderHeading,
  };
}

export async function updateRiderOrder(order, update) {
  const rows = await updateRiderStop({
    orderIds: [order.id],
    orders: [order],
    primaryOrder: order,
    trackingStatus: order.trackingStatus,
    bottlesCollected: order.bottlesCollected,
  }, update);
  return rows[0];
}

export { signOut as signOutRider };
