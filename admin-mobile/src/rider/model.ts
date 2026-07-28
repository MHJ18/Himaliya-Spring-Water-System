export type BottleItem = {
  bottleType: string;
  quantity: number;
  unitPrice?: number;
};

export type RiderCustomer = {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export type RiderOrder = {
  id: string;
  customer_id?: string;
  assigned_rider_id?: string | null;
  quantity: number;
  bottle_type: string;
  items?: BottleItem[] | null;
  delivered_items?: BottleItem[] | null;
  delivery_address?: string;
  delivery_date?: string;
  notes?: string;
  status: string;
  tracking_status: string;
  bottles_collected: number;
  bottles_dropped_off: number;
  rider_lat?: number | null;
  rider_lng?: number | null;
  rider_heading?: number | null;
  assigned_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at?: string;
  customers?: RiderCustomer | RiderCustomer[] | null;
};

export type RiderMobileConfig = {
  businessName: string;
  pickupAddress: string;
  businessPhone: string;
  available: boolean;
  notificationTone: NotificationTone;
  notificationsEnabled: boolean;
  vibrationEnabled: boolean;
  locationMode: RiderLocationMode;
  reducedMotion: boolean;
};

export type NotificationTone = 'water_drop' | 'bright_chime' | 'soft_bell' | 'default';
export type RiderLocationMode = 'balanced' | 'data_saver';

export type RiderStop = {
  key: string;
  orderIds: string[];
  orders: RiderOrder[];
  primaryOrder: RiderOrder;
  customer: RiderCustomer;
  deliveryAddress: string;
  items: BottleItem[];
  notes: string[];
  trackingStatus: string;
  totalQuantity: number;
  bottlesCollected: number;
  bottlesDroppedOff: number;
  assignedAt: string | null;
};

export const ACTIVE_TRACKING_STATUSES = new Set(['assigned', 'picked_up', 'en_route', 'nearby']);
export const LIVE_LOCATION_STATUSES = new Set(['picked_up', 'en_route', 'nearby']);

const bottleNames: Record<string, string> = {
  small: 'Small bottle',
  medium: 'Medium bottle',
  large: 'Large bottle',
  gallon: '19L gallon',
  'small-bottle': 'Small bottle',
  'medium-bottle': 'Medium bottle',
  'large-bottle': 'Large bottle',
  'Small Bottle': 'Small bottle',
  'Medium Bottle': 'Medium bottle',
  'Large Bottle': 'Large bottle',
  Gallon: '19L gallon',
};

export function customerOf(order?: RiderOrder | null): RiderCustomer {
  if (!order?.customers) return {};
  return Array.isArray(order.customers) ? order.customers[0] || {} : order.customers;
}

export function bottleName(value: string) {
  return bottleNames[value] || value || 'Water bottle';
}

export function normalizeItems(order?: RiderOrder | null): BottleItem[] {
  if (!order) return [];
  const items = Array.isArray(order.items) ? order.items : [];
  const normalized = items
    .map((item) => ({
      bottleType: String(item?.bottleType || '').trim(),
      quantity: Math.max(0, Number(item?.quantity || 0)),
      ...(Number(item?.unitPrice || 0) > 0 ? { unitPrice: Number(item.unitPrice) } : {}),
    }))
    .filter((item) => item.bottleType && item.quantity > 0);
  if (normalized.length) return normalized;
  return [{ bottleType: order.bottle_type || 'Gallon', quantity: Math.max(1, Number(order.quantity || 1)) }];
}

export function itemSummary(order?: RiderOrder | null, separator = ' + ') {
  return normalizeItems(order)
    .map((item) => `${item.quantity} x ${bottleName(item.bottleType)}`)
    .join(separator);
}

export function trackingStatusName(value: string) {
  return ({
    assigned: 'Ready',
    picked_up: 'Picked up',
    en_route: 'On the way',
    nearby: 'On the way',
    delivered: 'Delivered',
  } as Record<string, string>)[value] || 'Ready';
}

export function formatOrderDate(value?: string | null) {
  if (!value) return 'Today';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function sortActiveOrders(orders: RiderOrder[]) {
  return orders
    .filter((order) => ACTIVE_TRACKING_STATUSES.has(order.tracking_status))
    .sort((left, right) => (
      +new Date(left.assigned_at || left.created_at) - +new Date(right.assigned_at || right.created_at)
    ));
}

const trackingRank: Record<string, number> = {
  assigned: 0,
  picked_up: 1,
  en_route: 2,
  nearby: 2,
  delivered: 3,
};

function normalizedStopText(value?: string | null) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function riderStopKey(order: RiderOrder) {
  const customer = customerOf(order);
  const customerKey = order.customer_id
    || customer.id
    || normalizedStopText(customer.phone)
    || normalizedStopText(customer.name)
    || 'unknown-customer';
  const address = normalizedStopText(order.delivery_address || customer.address) || 'unknown-address';
  return `${customerKey}::${address}`;
}

export function aggregateOrderItems(orders: RiderOrder[]) {
  const values = new Map<string, BottleItem>();
  orders.forEach((order) => {
    normalizeItems(order).forEach((item) => {
      const key = normalizedStopText(item.bottleType);
      const current = values.get(key);
      values.set(key, current
        ? { ...current, quantity: current.quantity + item.quantity }
        : { ...item });
    });
  });
  return Array.from(values.values());
}

export function groupRiderStops(orders: RiderOrder[]): RiderStop[] {
  const groups = new Map<string, RiderOrder[]>();
  sortActiveOrders(orders).forEach((order) => {
    const key = riderStopKey(order);
    groups.set(key, [...(groups.get(key) || []), order]);
  });
  return Array.from(groups.entries()).map(([key, stopOrders]) => {
    const primaryOrder = stopOrders[0];
    const customer = customerOf(primaryOrder);
    const statuses = stopOrders.map((order) => order.tracking_status);
    const trackingStatus = statuses.reduce((least, current) => (
      (trackingRank[current] ?? 0) < (trackingRank[least] ?? 0) ? current : least
    ), statuses[0] || 'assigned');
    const notes = Array.from(new Set(stopOrders
      .map((order) => String(order.notes || '').trim())
      .filter(Boolean)));
    const items = aggregateOrderItems(stopOrders);
    return {
      key,
      orderIds: stopOrders.map((order) => order.id),
      orders: stopOrders,
      primaryOrder,
      customer,
      deliveryAddress: String(primaryOrder.delivery_address || customer.address || '').trim(),
      items,
      notes,
      trackingStatus,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      bottlesCollected: stopOrders.reduce((sum, order) => sum + Number(order.bottles_collected || 0), 0),
      bottlesDroppedOff: stopOrders.reduce((sum, order) => sum + Number(order.bottles_dropped_off || 0), 0),
      assignedAt: primaryOrder.assigned_at || primaryOrder.created_at || null,
    };
  });
}
