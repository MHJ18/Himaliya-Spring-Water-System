import {
  buildDeliveryDirectionsUrl,
  getDrivingRouteCoordinates,
  getCustomerCoordinates,
  getStableCustomerCoordinates,
  resolveDeliveryAddressCoordinates,
} from '../coordinates';

describe('customer coordinate estimates', () => {
  test('defaults local addresses to the Sialkot service area', () => {
    expect(getCustomerCoordinates('Street 5, Cantt')).toEqual({
      lat: 32.4945,
      lng: 74.5229,
    });
  });

  test('matches explicit cities before ambiguous neighborhood names', () => {
    expect(getCustomerCoordinates('DHA Lahore')).toEqual({
      lat: 31.5204,
      lng: 74.3587,
    });
    expect(getCustomerCoordinates('Saddar Rawalpindi')).toEqual({
      lat: 33.5971,
      lng: 73.0479,
    });
  });

  test('uses Karachi neighborhood detail only when Karachi is explicit', () => {
    expect(getCustomerCoordinates('DHA Phase 6, Karachi')).toEqual({
      lat: 24.8048,
      lng: 67.0755,
    });
  });

  test('keeps stable local estimates near Sialkot', () => {
    const coordinates = getStableCustomerCoordinates({
      id: 'customer-42',
      address: 'Street 5, Cantt',
    });
    expect(Math.abs(coordinates.lat - 32.4945)).toBeLessThan(0.01);
    expect(Math.abs(coordinates.lng - 74.5229)).toBeLessThan(0.01);
  });

  test('builds road directions from rider GPS to a saved address', () => {
    const url = buildDeliveryDirectionsUrl({
      destinationAddress: 'House 4, Kashmir Road, Sialkot',
      riderLat: 32.5,
      riderLng: 74.52,
    });

    expect(url).toContain('https://www.google.com/maps/dir/?api=1');
    expect(url).toContain('destination=House%204%2C%20Kashmir%20Road%2C%20Sialkot');
    expect(url).toContain('origin=32.5%2C74.52');
    expect(url).toContain('travelmode=driving');
  });

  test('prefers exact destination coordinates and skips an empty destination', () => {
    expect(buildDeliveryDirectionsUrl({
      destinationAddress: 'Approximate address',
      destinationLat: 32.493,
      destinationLng: 74.524,
    })).toContain('destination=32.493%2C74.524');
    expect(buildDeliveryDirectionsUrl({})).toBe('');
  });

  test('resolves a saved address to map coordinates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [{ geometry: { coordinates: [74.5242, 32.513] } }],
      }),
    });

    await expect(resolveDeliveryAddressCoordinates('Unique Cantt address')).resolves.toEqual({
      lat: 32.513,
      lng: 74.5242,
    });
    expect(global.fetch.mock.calls[0][0]).toContain('photon.komoot.io');
    expect(global.fetch.mock.calls[0][0]).toContain('countrycode=PK');
    expect(global.fetch.mock.calls[0][0]).toContain('zoom=9');
  });

  test('loads road geometry between rider and destination', async () => {
    const coordinates = [[74.52, 32.49], [74.53, 32.51]];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ routes: [{ geometry: { coordinates } }] }),
    });

    await expect(getDrivingRouteCoordinates({
      originLat: 32.49,
      originLng: 74.52,
      destinationLat: 32.51,
      destinationLng: 74.53,
    })).resolves.toEqual(coordinates);
    expect(global.fetch.mock.calls[0][0]).toContain('router.project-osrm.org');
  });
});
