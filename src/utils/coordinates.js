// Coordinates utility for resolving Pakistani addresses to stable map coordinates.

const CITIES = [
  { keywords: ['karachi'], lat: 24.8607, lng: 67.0011 },
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
  { keywords: ['lahore'], lat: 31.5204, lng: 74.3587 },
  { keywords: ['islamabad'], lat: 33.6844, lng: 73.0479 },
  { keywords: ['rawalpindi'], lat: 33.5971, lng: 73.0479 },
  { keywords: ['faisalabad'], lat: 31.4187, lng: 73.0790 },
  { keywords: ['multan'], lat: 30.1575, lng: 71.5249 },
  { keywords: ['peshawar'], lat: 34.0150, lng: 71.5249 },
  { keywords: ['quetta'], lat: 30.1798, lng: 66.9750 },
  { keywords: ['sialkot'], lat: 32.4945, lng: 74.5229 },
  { keywords: ['gujranwala'], lat: 32.1877, lng: 74.1942 },
  { keywords: ['hyderabad'], lat: 25.3960, lng: 68.3578 },
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
  for (const city of CITIES) {
    if (city.keywords.some((keyword) => lower.includes(keyword))) {
      return { lat: city.lat, lng: city.lng };
    }
  }
  return { lat: 24.8607, lng: 67.0011 };
}

export function getStableCustomerCoordinates(customer = {}) {
  const base = getCustomerCoordinates(customer.address || customer.name || '');
  const offset = stableOffset(customer.id || customer.name || customer.address || 'sialkot-cantt');
  return {
    lat: base.lat + offset.lat,
    lng: base.lng + offset.lng,
  };
}
