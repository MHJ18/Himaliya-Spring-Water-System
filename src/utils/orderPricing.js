import { BOTTLE_TYPE_LABELS, BOTTLE_TYPES } from '../data/constants';

export function canonicalBottleType(type) {
  if (!type) return BOTTLE_TYPES.includes('Gallon') ? 'Gallon' : BOTTLE_TYPES[0];
  if (BOTTLE_TYPES.includes(type)) return type;
  const byLabel = Object.entries(BOTTLE_TYPE_LABELS).find(([, label]) => label === type);
  if (byLabel) return byLabel[0];
  return type;
}

export function lookupBottlePrice(prices = {}, bottleType) {
  const canonical = canonicalBottleType(bottleType);
  const label = BOTTLE_TYPE_LABELS[canonical];
  const fromCanonical = prices[canonical];
  const fromLabel = label ? prices[label] : undefined;
  const fromType = prices[bottleType];
  return Number(
    (fromCanonical !== undefined && fromCanonical !== '' ? fromCanonical : null) ||
    (fromLabel !== undefined && fromLabel !== '' ? fromLabel : null) ||
    (fromType !== undefined && fromType !== '' ? fromType : null) ||
    0,
  );
}

export function resolveOrderPricing(order, prices = {}) {
  const quantity = Math.max(1, Number(order.quantity || 1));
  const storedUnit = Number(order.unitPrice || 0);
  const storedTotal = Number(order.totalAmount || 0);
  const unitPrice = storedUnit > 0 ? storedUnit : lookupBottlePrice(prices, order.bottleType);
  const totalAmount = storedTotal > 0 ? storedTotal : unitPrice * quantity;
  return { unitPrice, totalAmount, quantity };
}
