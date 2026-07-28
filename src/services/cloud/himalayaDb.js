import { dbRequest, isSupabaseConfigured } from './supabaseClient';
import { DEFAULT_SETTINGS } from '../../data/constants';

function requireCloud() {
  if (!isSupabaseConfigured()) throw new Error('Supabase configuration is required.');
}

const NON_BILLABLE_ORDER_STATUSES = new Set(['canceled', 'rejected']);

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function toCustomerOrderHistory(order) {
  if (!order || NON_BILLABLE_ORDER_STATUSES.has(order.status)) return [];

  const savedItems = Array.isArray(order.items) ? order.items : [];
  const items = savedItems.length ? savedItems : [{
    bottleType: order.bottle_type,
    quantity: order.quantity,
    unitPrice: order.unit_price,
  }];

  return items
    .map((item, index) => {
      const quantity = number(item && (item.quantity !== undefined ? item.quantity : item.qty));
      const pricePerBottle = number(item && (
        item.unitPrice !== undefined ? item.unitPrice : item.unit_price
      )) || (items.length === 1 ? number(order.unit_price) : 0);
      const savedTotal = number(item && (
        item.totalAmount !== undefined ? item.totalAmount : item.total_amount
      ));
      const totalAmount = savedTotal
        || (quantity * pricePerBottle)
        || (items.length === 1 ? number(order.total_amount) : 0);
      const bottleType = String(
        (item && (item.bottleType || item.bottle_type)) || order.bottle_type || ''
      ).trim();

      if (!bottleType || quantity <= 0) return null;
      return {
        id: `customer-order:${order.id}:${index}`,
        orderId: order.id,
        recordType: 'customer_order',
        readOnly: true,
        status: order.status || 'pending',
        date: order.created_at,
        bottleType,
        quantity,
        pricePerBottle,
        totalAmount,
        notes: order.notes || '',
      };
    })
    .filter(Boolean);
}

function toCustomer(row, sales, orders) {
  const customerSales = sales
    .filter((sale) => sale.customer_id === row.id)
    .map((sale) => ({
      id: sale.id,
      recordType: 'sale',
      date: sale.created_at,
      bottleType: sale.bottle_type,
      quantity: Number(sale.quantity) || 0,
      pricePerBottle: Number(sale.price_per_bottle) || 0,
      totalAmount: Number(sale.total_amount) || 0,
      notes: sale.notes || '',
    }));
  const customerOrders = orders.filter((order) => (
    order.customer_id === row.id && !NON_BILLABLE_ORDER_STATUSES.has(order.status)
  ));
  const orderHistory = customerOrders.flatMap(toCustomerOrderHistory);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address || '',
    email: row.email || '',
    photo: row.photo || '',
    bottlesHeld: Number(row.bottles_held) || 0,
    source: row.source || 'admin',
    authUserId: row.auth_user_id || null,
    active: row.active !== false,
    createdAt: row.created_at,
    orderCount: customerSales.length + customerOrders.length,
    purchaseHistory: [...customerSales, ...orderHistory]
      .sort((left, right) => new Date(left.date) - new Date(right.date)),
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
    bottles_held: Number(customer.bottlesHeld) || 0,
    source: customer.source || 'admin',
    auth_user_id: customer.authUserId || null,
    active: customer.active !== false,
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

function isAdministratorIdentity(customer, adminRows) {
  const email = String(customer.email || '').trim().toLowerCase();
  return (adminRows || []).some((admin) => (
    (customer.authUserId && admin.auth_user_id === customer.authUserId)
      || (email && String(admin.email || '').trim().toLowerCase() === email)
  ));
}

export async function getCloudCustomers() {
  requireCloud();
  const [customers, sales, orders, adminRows] = await Promise.all([
    dbRequest('/customers?select=*&order=created_at.asc'),
    dbRequest('/sales?select=*&order=created_at.asc'),
    dbRequest('/customer_orders?select=*&order=created_at.asc'),
    dbRequest('/admin_profiles?select=auth_user_id,email'),
  ]);
  return customers
    .filter((customer) => !isAdministratorIdentity(customer, adminRows))
    .map((customer) => toCustomer(customer, sales, orders));
}

export async function saveCloudCustomers(customers) {
  requireCloud();
  const customerRows = customers.map(toCustomerRow);
  const saleRows = customers.flatMap((customer) =>
    (customer.purchaseHistory || [])
      .filter((sale) => sale.recordType !== 'customer_order')
      .map((sale) => toSaleRow(customer, sale))
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

export async function deleteCloudSale(saleId) {
  requireCloud();
  const deleted = await dbRequest(`/sales?id=eq.${encodeURIComponent(saleId)}&select=id`, {
    method: 'DELETE',
    prefer: 'return=representation',
  });
  if (!Array.isArray(deleted) || deleted.length !== 1) {
    throw new Error('Sale entry could not be deleted or you do not have permission.');
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
