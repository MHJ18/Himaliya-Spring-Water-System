jest.mock('../../cloud/supabaseClient', () => ({
  dbRequest: jest.fn(),
  getStoredSession: jest.fn(() => ({ user: { id: 'rider-user' } })),
  isSupabaseConfigured: jest.fn(() => true),
  signOut: jest.fn(),
}));

const { dbRequest } = require('../../cloud/supabaseClient');
const {
  resetRiderRpcCompatibilityCache,
  updateRiderStop,
  updateRiderStopLocation,
} = require('../riderApi');

const missingRpc = (name) => Object.assign(
  new Error(`Could not find the function public.${name}(...) in the schema cache`),
  { code: 'PGRST202' },
);

const order = (id, items) => ({
  id,
  items,
  customer: { id: `customer-${id}`, name: `Customer ${id}` },
  riderLat: null,
  riderLng: null,
  riderHeading: null,
});

describe('riderApi grouped-stop compatibility', () => {
  beforeEach(() => {
    dbRequest.mockReset();
    resetRiderRpcCompatibilityCache();
  });

  it('falls back to per-order delivery updates and allocates grouped items', async () => {
    const first = order('order-1', [
      { bottleType: '19L Gallon', quantity: 2 },
      { bottleType: '1.5L Bottle', quantity: 1 },
    ]);
    const second = order('order-2', [
      { bottleType: '19L Gallon', quantity: 3 },
    ]);
    dbRequest
      .mockRejectedValueOnce(missingRpc('update_rider_delivery_stop'))
      .mockResolvedValueOnce({
        id: first.id,
        items: first.items,
        delivered_items: first.items,
        tracking_status: 'delivered',
      })
      .mockResolvedValueOnce({
        id: second.id,
        items: second.items,
        delivered_items: [{ bottleType: '19L Gallon', quantity: 2 }],
        tracking_status: 'delivered',
      });

    const result = await updateRiderStop({
      orderIds: [first.id, second.id],
      orders: [first, second],
      primaryOrder: first,
      trackingStatus: 'picked_up',
      bottlesCollected: 0,
    }, {
      trackingStatus: 'delivered',
      bottlesCollected: 7,
      deliveredItems: [
        { bottleType: '19L Gallon', quantity: 4 },
        { bottleType: '1.5L Bottle', quantity: 1 },
      ],
    });

    expect(result).toHaveLength(2);
    expect(dbRequest).toHaveBeenCalledTimes(3);
    expect(JSON.parse(dbRequest.mock.calls[1][1].body)).toMatchObject({
      p_order_id: 'order-1',
      p_bottles_collected: 7,
      p_bottles_dropped_off: 3,
      p_delivered_items: [
        { bottleType: 'Gallon', quantity: 2 },
        { bottleType: '1.5L Bottle', quantity: 1 },
      ],
    });
    expect(JSON.parse(dbRequest.mock.calls[2][1].body)).toMatchObject({
      p_order_id: 'order-2',
      p_bottles_collected: 0,
      p_bottles_dropped_off: 2,
      p_delivered_items: [
        { bottleType: 'Gallon', quantity: 2 },
      ],
    });
  });

  it('falls back to the installed per-order location function', async () => {
    dbRequest
      .mockRejectedValueOnce(missingRpc('update_rider_stop_location'))
      .mockResolvedValueOnce('2026-07-26T12:00:00Z')
      .mockResolvedValueOnce('2026-07-26T12:00:00Z');

    await updateRiderStopLocation({
      orderIds: ['order-1', 'order-2'],
    }, {
      riderLat: 33.6844,
      riderLng: 73.0479,
      riderHeading: 90,
    });

    expect(dbRequest).toHaveBeenCalledTimes(3);
    expect(dbRequest.mock.calls[1][0]).toBe('/rpc/update_rider_location');
    expect(dbRequest.mock.calls[2][0]).toBe('/rpc/update_rider_location');
  });

  it('uses the delivery function when both location functions are missing', async () => {
    const first = {
      ...order('order-1', [{ bottleType: '19L Gallon', quantity: 2 }]),
      trackingStatus: 'picked_up',
      bottlesCollected: 4,
      bottlesDroppedOff: 2,
      deliveredItems: [{ bottleType: 'Gallon', quantity: 2 }],
    };
    dbRequest
      .mockRejectedValueOnce(missingRpc('update_rider_stop_location'))
      .mockRejectedValueOnce(missingRpc('update_rider_location'))
      .mockResolvedValueOnce({ id: first.id });

    await updateRiderStopLocation({
      orderIds: [first.id],
      orders: [first],
      primaryOrder: first,
      trackingStatus: first.trackingStatus,
    }, {
      riderLat: 33.6844,
      riderLng: 73.0479,
      riderHeading: 90,
    });

    expect(dbRequest).toHaveBeenCalledTimes(3);
    expect(dbRequest.mock.calls[2][0]).toBe('/rpc/update_rider_delivery');
    expect(JSON.parse(dbRequest.mock.calls[2][1].body)).toMatchObject({
      p_order_id: 'order-1',
      p_tracking_status: 'picked_up',
      p_bottles_collected: 4,
      p_bottles_dropped_off: 2,
      p_rider_lat: 33.6844,
      p_rider_lng: 73.0479,
      p_rider_heading: 90,
      p_delivered_items: [{ bottleType: 'Gallon', quantity: 2 }],
    });

    dbRequest.mockResolvedValueOnce({ id: first.id });
    await updateRiderStopLocation({
      orderIds: [first.id],
      orders: [first],
      primaryOrder: first,
      trackingStatus: first.trackingStatus,
    }, {
      riderLat: 33.6845,
      riderLng: 73.048,
      riderHeading: 92,
    });

    expect(dbRequest).toHaveBeenCalledTimes(4);
    expect(dbRequest.mock.calls[3][0]).toBe('/rpc/update_rider_delivery');
  });

  it('supports the older delivery function without delivered_items', async () => {
    const first = order('order-1', [{ bottleType: '19L Gallon', quantity: 2 }]);
    dbRequest
      .mockRejectedValueOnce(missingRpc('update_rider_delivery_stop'))
      .mockRejectedValueOnce(missingRpc('update_rider_delivery'))
      .mockResolvedValueOnce({
        id: first.id,
        items: first.items,
        tracking_status: 'picked_up',
      });

    await updateRiderStop({
      orderIds: [first.id],
      orders: [first],
      primaryOrder: first,
      trackingStatus: 'assigned',
      bottlesCollected: 0,
    }, {
      trackingStatus: 'picked_up',
    });

    expect(dbRequest).toHaveBeenCalledTimes(3);
    const oldestPayload = JSON.parse(dbRequest.mock.calls[2][1].body);
    expect(oldestPayload.p_order_id).toBe('order-1');
    expect(oldestPayload.p_tracking_status).toBe('picked_up');
    expect(oldestPayload).not.toHaveProperty('p_delivered_items');
  });

  it('does not hide non-schema errors', async () => {
    const denied = Object.assign(new Error('permission denied'), { code: '42501' });
    dbRequest.mockRejectedValueOnce(denied);

    await expect(updateRiderStopLocation({
      orderIds: ['order-1'],
    }, {
      riderLat: 33.6844,
      riderLng: 73.0479,
      riderHeading: 90,
    })).rejects.toBe(denied);
    expect(dbRequest).toHaveBeenCalledTimes(1);
  });
});
