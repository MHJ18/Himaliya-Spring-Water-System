export const DELIVERY_STAGE = {
  accepted: 'accepted',
  ready: 'ready',
  inTransit: 'in_transit',
  delivered: 'delivered',
};

const ACTIVE_TRACKING_STATUSES = ['picked_up', 'en_route', 'nearby'];

export function isDeliveryRouteOrder(order) {
  return Boolean(order && ['accepted', 'delivered'].includes(order.status));
}

export function isActiveDeliveryRouteOrder(order) {
  return Boolean(order && order.status === 'accepted');
}

export function deliveryStage(order) {
  if (!order) return DELIVERY_STAGE.accepted;
  if (order.status === 'delivered' || order.trackingStatus === 'delivered') {
    return DELIVERY_STAGE.delivered;
  }
  if (ACTIVE_TRACKING_STATUSES.includes(order.trackingStatus)) {
    return DELIVERY_STAGE.inTransit;
  }
  if (order.trackingStatus === 'assigned') {
    return DELIVERY_STAGE.ready;
  }
  return DELIVERY_STAGE.accepted;
}

export function filterDeliveryRouteOrders(orders) {
  return (Array.isArray(orders) ? orders : []).filter(isDeliveryRouteOrder);
}

export function trackingStatusForLocation(order) {
  const status = order && order.trackingStatus;
  if (status === 'picked_up') return 'en_route';
  if (['assigned', 'en_route', 'nearby'].includes(status)) return status;
  return 'assigned';
}

