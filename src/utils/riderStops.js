const ACTIVE_STATUSES = new Set(['assigned', 'picked_up', 'en_route', 'nearby']);
const STATUS_RANK = {
  assigned: 0,
  picked_up: 1,
  en_route: 2,
  nearby: 2,
  delivered: 3,
};

function normalizeText(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function riderStopKey(order) {
  const customer = order.customer || {};
  const customerKey = order.customerId
    || customer.id
    || normalizeText(customer.phone)
    || normalizeText(customer.name)
    || 'unknown-customer';
  const address = normalizeText(order.deliveryAddress || customer.address) || 'unknown-address';
  return `${customerKey}::${address}`;
}

export function aggregateStopItems(orders) {
  const values = new Map();
  orders.forEach((order) => {
    const items = Array.isArray(order.items) && order.items.length
      ? order.items
      : [{ bottleType: order.bottleType, quantity: order.quantity }];
    items.forEach((item) => {
      const key = normalizeText(item.bottleType);
      const current = values.get(key);
      values.set(key, current
        ? { ...current, quantity: current.quantity + Number(item.quantity || 0) }
        : { ...item, quantity: Number(item.quantity || 0) });
    });
  });
  return Array.from(values.values()).filter((item) => item.bottleType && item.quantity > 0);
}

export function groupRiderStops(orders) {
  const active = (orders || [])
    .filter((order) => ACTIVE_STATUSES.has(order.trackingStatus))
    .sort((left, right) => (
      new Date(left.assignedAt || left.createdAt) - new Date(right.assignedAt || right.createdAt)
    ));
  const groups = new Map();
  active.forEach((order) => {
    const key = riderStopKey(order);
    groups.set(key, [...(groups.get(key) || []), order]);
  });
  return Array.from(groups.entries()).map(([key, stopOrders]) => {
    const primaryOrder = stopOrders[0];
    const items = aggregateStopItems(stopOrders);
    const trackingStatus = stopOrders.reduce((least, order) => (
      (STATUS_RANK[order.trackingStatus] || 0) < (STATUS_RANK[least] || 0)
        ? order.trackingStatus
        : least
    ), primaryOrder.trackingStatus);
    return {
      key,
      orderIds: stopOrders.map((order) => order.id),
      orders: stopOrders,
      primaryOrder,
      customer: primaryOrder.customer || {},
      deliveryAddress: primaryOrder.deliveryAddress || (primaryOrder.customer && primaryOrder.customer.address) || '',
      items,
      notes: Array.from(new Set(stopOrders.map((order) => String(order.notes || '').trim()).filter(Boolean))),
      trackingStatus,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      bottlesCollected: stopOrders.reduce((sum, order) => sum + Number(order.bottlesCollected || 0), 0),
      bottlesDroppedOff: stopOrders.reduce((sum, order) => sum + Number(order.bottlesDroppedOff || 0), 0),
    };
  });
}
