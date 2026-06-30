import { getCloudBottlePrices, saveCloudBottlePrices } from '../cloud/himalayaDb';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';

function normalizePriceKeys(prices = {}) {
  const next = { ...prices };
  Object.entries(BOTTLE_TYPE_LABELS).forEach(([key, label]) => {
    if ((next[key] === undefined || next[key] === '') && next[label] !== undefined) {
      next[key] = next[label];
    }
    if ((next[label] === undefined || next[label] === '') && next[key] !== undefined) {
      next[label] = next[key];
    }
  });
  return next;
}

export async function getBottlePrices(fallback) {
  const cloudPrices = await getCloudBottlePrices();
  let legacyPrices = null;
  try { legacyPrices = JSON.parse(localStorage.getItem('ws_daily_sale_price_defaults') || 'null'); } catch { legacyPrices = null; }
  if (legacyPrices) {
    const merged = normalizePriceKeys({ ...fallback, ...(cloudPrices || {}), ...legacyPrices });
    await saveCloudBottlePrices(merged);
    localStorage.removeItem('ws_daily_sale_price_defaults');
    return merged;
  }
  return normalizePriceKeys({ ...fallback, ...(cloudPrices || {}) });
}

export async function saveBottlePrices(prices) {
  const normalized = normalizePriceKeys(prices);
  await saveCloudBottlePrices(normalized);
  return normalized;
}
