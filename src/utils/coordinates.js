// Coordinates utility for resolving Pakistani addresses to stable map coordinates.

const DEFAULT_COORDINATES = { lat: 32.4945, lng: 74.5229 };
const addressCoordinateCache = new Map();
const pendingAddressLookups = new Map();
const routeCoordinateCache = new Map();
let addressLookupQueue = Promise.resolve();

const CITIES = [
  { keywords: ['sialkot'], lat: 32.4945, lng: 74.5229, id: 'sialkot' },
  { keywords: ['karachi'], lat: 24.8607, lng: 67.0011, id: 'karachi' },
  { keywords: ['lahore'], lat: 31.5204, lng: 74.3587, id: 'lahore' },
  { keywords: ['islamabad'], lat: 33.6844, lng: 73.0479, id: 'islamabad' },
  { keywords: ['rawalpindi'], lat: 33.5971, lng: 73.0479, id: 'rawalpindi' },
  { keywords: ['faisalabad'], lat: 31.4187, lng: 73.0790, id: 'faisalabad' },
  { keywords: ['multan'], lat: 30.1575, lng: 71.5249, id: 'multan' },
  { keywords: ['peshawar'], lat: 34.0150, lng: 71.5249, id: 'peshawar' },
  { keywords: ['quetta'], lat: 30.1798, lng: 66.9750, id: 'quetta' },
  { keywords: ['gujranwala'], lat: 32.1877, lng: 74.1942, id: 'gujranwala' },
  { keywords: ['hyderabad'], lat: 25.3960, lng: 68.3578, id: 'hyderabad' },
];

const KARACHI_AREAS = [
  { keywords: ['clifton'], lat: 24.8138, lng: 67.0299 },
  { keywords: ['dha', 'defence'], lat: 24.8048, lng: 67.0755 },
  { keywords: ['saddar'], lat: 24.8546, lng: 67.0209 },
  { keywords: ['gulshan', 'johar', 'jauhar'], lat: 24.9207, lng: 67.0885 },
  { keywords: ['nazimabad'], lat: 24.9368, lng: 67.0314 },
  { keywords: ['north nazimabad', 'north'], lat: 24.9487, lng: 67.0455 },
  { keywords: ['korangi'], lat: 24.8264, lng: 67.1448 },
  { keywords: ['malir'], lat: 24.9024, lng: 67.1924 },
  { keywords: ['lyari'], lat: 24.8615, lng: 66.9956 },
  { keywords: ['pechs'], lat: 24.8712, lng: 67.0598 },
  { keywords: ['scheme 33', 'scheme33'], lat: 24.9678, lng: 67.1211 },
  { keywords: ['orangi'], lat: 24.9461, lng: 66.9911 },
  { keywords: ['bahria'], lat: 25.0251, lng: 67.3078 },
];

function hashString(input = '') {
  return input.split('').reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function stableOffset(seed, scale = 0.012) {
  const hash = hashString(String(seed));
  return {
    lat: ((hash % 1000) / 1000 - 0.5) * scale,
    lng: ((Math.floor(hash / 1000) % 1000) / 1000 - 0.5) * scale,
  };
}

export function getCustomerCoordinates(address = '') {
  const lower = address.toLowerCase();
  const city = CITIES.find((candidate) => (
    candidate.keywords.some((keyword) => lower.includes(keyword))
  ));

  if (city && city.id === 'karachi') {
    const area = KARACHI_AREAS.find((candidate) => (
      candidate.keywords.some((keyword) => lower.includes(keyword))
    ));
    if (area) return { lat: area.lat, lng: area.lng };
  }

  if (city) return { lat: city.lat, lng: city.lng };
  return { ...DEFAULT_COORDINATES };
}

export function getStableCustomerCoordinates(customer = {}) {
  const base = getCustomerCoordinates(customer.address || customer.name || '');
  const offset = stableOffset(customer.id || customer.name || customer.address || 'sialkot-cantt');
  return {
    lat: base.lat + offset.lat,
    lng: base.lng + offset.lng,
  };
}

function validCoordinate(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function buildDeliveryDirectionsUrl({
  destinationAddress,
  destinationLat,
  destinationLng,
  riderLat,
  riderLng,
} = {}) {
  const hasExactDestination = validCoordinate(destinationLat) && validCoordinate(destinationLng);
  const destination = hasExactDestination
    ? `${Number(destinationLat)},${Number(destinationLng)}`
    : String(destinationAddress || '').trim();
  if (!destination) return '';

  const params = [`api=1`, `destination=${encodeURIComponent(destination)}`];
  if (validCoordinate(riderLat) && validCoordinate(riderLng)) {
    params.push(`origin=${encodeURIComponent(`${Number(riderLat)},${Number(riderLng)}`)}`);
  }
  params.push('travelmode=driving');
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

async function geocodeWithPhoton(query, signal) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en&countrycode=PK&lon=${DEFAULT_COORDINATES.lng}&lat=${DEFAULT_COORDINATES.lat}&zoom=9`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const payload = await response.json();
  const coordinates = payload
    && payload.features
    && payload.features[0]
    && payload.features[0].geometry
    && payload.features[0].geometry.coordinates;
  if (!Array.isArray(coordinates) || !validCoordinate(coordinates[0]) || !validCoordinate(coordinates[1])) return null;
  return { lat: Number(coordinates[1]), lng: Number(coordinates[0]) };
}

// Photon's free tier has thin coverage for small Pakistani towns and
// neighborhood-level addresses, so many delivery addresses never resolve and
// silently fall back to an approximate, deterministically-offset pin near the
// city center. Nominatim indexes the same OpenStreetMap data with a
// different search strategy and picks up a meaningful share of the addresses
// Photon misses, so it runs as a second attempt rather than the only source.
async function geocodeWithNominatim(query, signal) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=pk&addressdetails=0&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const first = Array.isArray(payload) ? payload[0] : null;
  if (!first || !validCoordinate(first.lon) || !validCoordinate(first.lat)) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}

export async function resolveDeliveryAddressCoordinates(address, { signal } = {}) {
  const normalizedAddress = String(address || '').trim();
  if (!normalizedAddress) return null;
  const cacheKey = normalizedAddress.toLowerCase();
  if (addressCoordinateCache.has(cacheKey)) return addressCoordinateCache.get(cacheKey);
  if (pendingAddressLookups.has(cacheKey)) return pendingAddressLookups.get(cacheKey);

  const query = /pakistan/i.test(normalizedAddress)
    ? normalizedAddress
    : `${normalizedAddress}, Pakistan`;
  const lookup = addressLookupQueue
    .catch(() => undefined)
    .then(async () => {
      let result = null;
      try {
        result = await geocodeWithPhoton(query, signal);
      } catch (error) {
        if (error && error.name === 'AbortError') throw error;
        result = null;
      }
      if (!result) {
        try {
          result = await geocodeWithNominatim(query, signal);
        } catch (error) {
          if (error && error.name === 'AbortError') throw error;
          result = null;
        }
      }
      if (!result) return null;
      addressCoordinateCache.set(cacheKey, result);
      return result;
    });
  addressLookupQueue = lookup;
  pendingAddressLookups.set(cacheKey, lookup);
  try {
    return await lookup;
  } finally {
    pendingAddressLookups.delete(cacheKey);
  }
}

export async function getDrivingRouteCoordinates({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  signal,
} = {}) {
  if (![originLat, originLng, destinationLat, destinationLng].every(validCoordinate)) return null;
  const values = [originLng, originLat, destinationLng, destinationLat].map((value) => Number(value).toFixed(5));
  const cacheKey = values.join(',');
  if (routeCoordinateCache.has(cacheKey)) return routeCoordinateCache.get(cacheKey);

  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${values[0]},${values[1]};${values[2]},${values[3]}?overview=full&geometries=geojson`,
    { signal },
  );
  if (!response.ok) throw new Error('Road routing is unavailable.');
  const payload = await response.json();
  const coordinates = payload
    && payload.routes
    && payload.routes[0]
    && payload.routes[0].geometry
    && payload.routes[0].geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  routeCoordinateCache.set(cacheKey, coordinates);
  return coordinates;
}
