import { groupRiderStops } from '../riderStops';

function order(id, customerId, address, quantity = 1, bottleType = 'Gallon') {
  return {
    id,
    customerId,
    deliveryAddress: address,
    trackingStatus: 'assigned',
    assignedAt: `2026-07-26T10:0${id}:00Z`,
    quantity,
    bottleType,
    items: [{ bottleType, quantity }],
    customer: { id: customerId, name: `Customer ${customerId}`, address },
  };
}

describe('rider stop grouping', () => {
  test('combines repeat orders for the same customer and address', () => {
    const stops = groupRiderStops([
      order('1', 'customer-a', 'House 4, Main Road', 2),
      order('2', 'customer-a', '  house 4,   MAIN road ', 3),
    ]);

    expect(stops).toHaveLength(1);
    expect(stops[0].orderIds).toEqual(['1', '2']);
    expect(stops[0].totalQuantity).toBe(5);
    expect(stops[0].items).toEqual([{ bottleType: 'Gallon', quantity: 5 }]);
  });

  test('keeps different delivery addresses as separate stops', () => {
    const stops = groupRiderStops([
      order('1', 'customer-a', 'Home'),
      order('2', 'customer-a', 'Office'),
    ]);

    expect(stops).toHaveLength(2);
  });

  test('aggregates multiple bottle types without merging the orders themselves', () => {
    const stops = groupRiderStops([
      order('1', 'customer-a', 'Home', 2, 'Gallon'),
      order('2', 'customer-a', 'Home', 6, 'Small Bottle'),
    ]);

    expect(stops[0].orders).toHaveLength(2);
    expect(stops[0].items).toEqual([
      { bottleType: 'Gallon', quantity: 2 },
      { bottleType: 'Small Bottle', quantity: 6 },
    ]);
  });
});
