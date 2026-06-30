import { dbRequest, isSupabaseConfigured } from './supabaseClient';
import { DEFAULT_SETTINGS } from '../../data/constants';

function requireCloud() {
  if (!isSupabaseConfigured()) throw new Error('Supabase configuration is required.');
}

function toCustomer(row, sales) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address || '',
    email: row.email || '',
    photo: row.photo || '',
    source: row.source || 'admin',
    authUserId: row.auth_user_id || null,
    createdAt: row.created_at,
    purchaseHistory: sales
      .filter((sale) => sale.customer_id === row.id)
      .map((sale) => ({
        id: sale.id,
        date: sale.created_at,
        bottleType: sale.bottle_type,
        quantity: Number(sale.quantity) || 0,
        pricePerBottle: Number(sale.price_per_bottle) || 0,
        totalAmount: Number(sale.total_amount) || 0,
        notes: sale.notes || '',
      })),
  };
}

function toCustomerRow(customer) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address || '',
    email: customer.email || '',
    photo: customer.photo || '',
    source: customer.source || 'admin',
    auth_user_id: customer.authUserId || null,
    created_at: customer.createdAt || new Date().toISOString(),
  };
}

function toSaleRow(customer, sale) {
  return {
    id: sale.id,
    customer_id: customer.id,
    bottle_type: sale.bottleType,
    quantity: Number(sale.quantity) || 0,
    price_per_bottle: Number(sale.pricePerBottle) || 0,
    total_amount: Number(sale.totalAmount) || 0,
    notes: sale.notes || '',
    created_at: sale.date || new Date().toISOString(),
  };
}

export async function getCloudCustomers() {
  requireCloud();
  const customers = await dbRequest('/customers?select=*&order=created_at.asc');
  const sales = await dbRequest('/sales?select=*&order=created_at.asc');
  return customers.map((customer) => toCustomer(customer, sales));
}

export async function saveCloudCustomers(customers) {
  requireCloud();
  const customerRows = customers.map(toCustomerRow);
  const saleRows = customers.flatMap((customer) =>
    (customer.purchaseHistory || []).map((sale) => toSaleRow(customer, sale))
  );

  if (customerRows.length) {
    try {
      await dbRequest('/customers?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(customerRows),
      });
    } catch (error) {
      const sourceSchemaMiss = error.code === 'PGRST204' || /schema cache|source/i.test(error.message || '');
      if (!sourceSchemaMiss) throw error;
      await dbRequest('/customers?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(customerRows.map(({ source, ...row }) => row)),
      });
    }
  }

  if (saleRows.length) {
    await dbRequest('/sales?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify(saleRows),
    });
  }

  return true;
}

export async function deleteCloudCustomer(customerId) {
  requireCloud();
  const deleted = await dbRequest(`/customers?id=eq.${encodeURIComponent(customerId)}&select=id`, {
    method: 'DELETE',
    prefer: 'return=representation',
  });
  if (!Array.isArray(deleted) || deleted.length !== 1) {
    throw new Error('Customer could not be deleted or you do not have permission.');
  }
  return deleted[0];
}

export async function getCloudSettings() {
  requireCloud();
  const rows = await dbRequest('/app_settings?id=eq.main&select=payload&limit=1');
  return rows && rows[0] && rows[0].payload ? rows[0].payload : null;
}

export async function saveCloudSettings(settings) {
  requireCloud();
  await dbRequest('/app_settings?on_conflict=owner_id,id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({
      id: 'main',
      payload: { ...DEFAULT_SETTINGS, ...settings },
      updated_at: new Date().toISOString(),
    }),
  });
  return true;
}

export async function getCloudBottlePrices() {
  requireCloud();
  let rows = [];
  try {
    rows = await dbRequest('/rpc/get_business_bottle_prices', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch (error) {
    const missingRpc = /get_business_bottle_prices|schema cache|could not find/i.test(error.message || '');
    if (!missingRpc) throw error;
    rows = await dbRequest('/bottle_prices?select=bottle_type,price&order=bottle_type.asc');
  }
  return rows.reduce((acc, row) => ({ ...acc, [row.bottle_type]: row.price }), {});
}

export async function saveCloudBottlePrices(prices) {
  requireCloud();
  const rows = Object.keys(prices).map((type) => ({
    bottle_type: type,
    price: Number(prices[type]) || 0,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return true;
  await dbRequest('/bottle_prices?on_conflict=owner_id,bottle_type', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify(rows),
  });
  return true;
}
