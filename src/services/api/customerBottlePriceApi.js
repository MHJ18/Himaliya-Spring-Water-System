import { dbRequest } from '../cloud/supabaseClient';
import { BOTTLE_TYPES } from '../../data/constants';

function toPriceMap(rows = []) {
  return rows.reduce((prices, row) => ({ ...prices, [row.bottle_type]: Number(row.price) || 0 }), {});
}

export async function getCustomerBottlePrices(customerId) {
  try {
    const rows = await dbRequest('/rpc/get_customer_bottle_prices', {
      method: 'POST',
      body: JSON.stringify({ p_customer_id: customerId || null }),
    });
    return toPriceMap(rows);
  } catch (error) {
    const missingRpc = error.code === 'PGRST202' ||
      /get_customer_bottle_prices|schema cache|could not find/i.test(error.message || '');
    if (!missingRpc) throw error;
    const rows = await dbRequest(
      `/customer_bottle_prices?customer_id=eq.${encodeURIComponent(customerId)}&select=bottle_type,price`,
    );
    return toPriceMap(rows);
  }
}

export async function getOwnCustomerBottlePrices() {
  const rows = await dbRequest('/rpc/get_customer_bottle_prices', {
    method: 'POST',
    body: JSON.stringify({ p_customer_id: null }),
  });
  return toPriceMap(rows);
}

export async function saveCustomerBottlePrices(customerId, prices) {
  const normalizedPrices = Object.entries(prices)
    .filter(([bottleType]) => BOTTLE_TYPES.includes(bottleType))
    .reduce((next, [bottleType, price]) => ({
      ...next,
      [bottleType]: Math.max(0, Number(price) || 0),
    }), {});
  if (!Object.keys(normalizedPrices).length) return {};
  try {
    const saved = await dbRequest('/rpc/set_customer_bottle_prices', {
      method: 'POST',
      body: JSON.stringify({
        p_customer_id: customerId,
        p_prices: normalizedPrices,
      }),
    });
    return toPriceMap(saved);
  } catch (error) {
    const missingRpc = error.code === 'PGRST202' ||
      /set_customer_bottle_prices|schema cache|could not find/i.test(error.message || '');
    if (!missingRpc) throw error;
    const rows = Object.entries(normalizedPrices).map(([bottle_type, price]) => ({
      customer_id: customerId,
      bottle_type,
      price,
      updated_at: new Date().toISOString(),
    }));
    const saved = await dbRequest('/customer_bottle_prices?on_conflict=owner_id,customer_id,bottle_type&select=bottle_type,price', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: JSON.stringify(rows),
    });
    return toPriceMap(saved);
  }
}
