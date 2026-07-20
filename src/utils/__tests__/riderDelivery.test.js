import {
  DELIVERY_STAGE,
  deliveryStage,
  filterDeliveryRouteOrders,
  isActiveDeliveryRouteOrder,
  isDeliveryRouteOrder,
  trackingStatusForLocation,
} from '../riderDelivery';

describe('rider delivery workflow', () => {
  test('only accepted and delivered orders belong to delivery routes', () => {
    const orders = [
      { id: 'pending', status: 'pending' },
      { id: 'accepted', status: 'accepted' },
      { id: 'delivered', status: 'delivered' },
      { id: 'rejected', status: 'rejected' },
      { id: 'canceled', status: 'canceled' },
    ];

    expect(filterDeliveryRouteOrders(orders).map((order) => order.id))
      .toEqual(['accepted', 'delivered']);
    expect(isDeliveryRouteOrder(orders[0])).toBe(false);
    expect(isDeliveryRouteOrder(orders[1])).toBe(true);
    expect(isActiveDeliveryRouteOrder(orders[1])).toBe(true);
    expect(isActiveDeliveryRouteOrder(orders[2])).toBe(false);
  });

  test('maps database tracking values to the dispatch stages', () => {
    expect(deliveryStage({ status: 'accepted', trackingStatus: 'unassigned' }))
      .toBe(DELIVERY_STAGE.accepted);
    expect(deliveryStage({ status: 'accepted', trackingStatus: 'assigned' }))
      .toBe(DELIVERY_STAGE.ready);
    expect(deliveryStage({ status: 'accepted', trackingStatus: 'en_route' }))
      .toBe(DELIVERY_STAGE.inTransit);
    expect(deliveryStage({ status: 'delivered', trackingStatus: 'delivered' }))
      .toBe(DELIVERY_STAGE.delivered);
  });

  test('sharing a location does not accidentally mark an assigned order picked up', () => {
    expect(trackingStatusForLocation({ trackingStatus: 'assigned' })).toBe('assigned');
    expect(trackingStatusForLocation({ trackingStatus: 'picked_up' })).toBe('en_route');
    expect(trackingStatusForLocation({ trackingStatus: 'nearby' })).toBe('nearby');
  });
});
