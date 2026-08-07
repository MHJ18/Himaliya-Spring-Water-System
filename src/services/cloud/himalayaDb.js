import { dbRequest, isSupabaseConfigured } from './supabaseClient';
import { DEFAULT_SETTINGS } from '../../data/constants';

function requireCloud() {
  if (!isSupabaseConfigured()) throw new Error('Supabase configuration is required.');
}

const BILLABLE_ORDER_STATUSES = new Set(['delivered', 'fulfilled', 'completed']);

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function paymentSchedule(value) {
  return value === 'on_delivery' ? 'on_delivery' : 'monthly';
}

export function toCustomerOrderHistory(
  order,
  allocationsBySource = new Map(),
  customerPaymentSchedule = 'monthly',
) {
  if (!order || !BILLABLE_ORDER_STATUSES.has(order.status)) return [];

  const orderedItems = Array.isArray(order.items) ? order.items : [];
  const deliveredItems = Array.isArray(order.delivered_items) ? order.delivered_items : [];
  const usesDeliveredAllocation = deliveredItems.length > 0;
  const savedItems = usesDeliveredAllocation
    ? deliveredItems.map((item) => {
        const bottleType = item && (item.bottleType || item.bottle_type);
        const orderedItem = orderedItems.find((candidate) => (
          (candidate && (candidate.bottleType || candidate.bottle_type)) === bottleType
        ));
        return {
          ...item,
          unitPrice: item && (
            item.unitPrice !== undefined ? item.unitPrice : item.unit_price
          ),
          fallbackUnitPrice: orderedItem && (
            orderedItem.unitPrice !== undefined ? orderedItem.unitPrice : orderedItem.unit_price
          ),
        };
      })
    : orderedItems;
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
      )) || number(item && item.fallbackUnitPrice)
        || (items.length === 1 ? number(order.unit_price) : 0);
      const savedTotal = number(item && (
        item.totalAmount !== undefined ? item.totalAmount : item.total_amount
      ));
      const totalAmount = savedTotal
        || (quantity * pricePerBottle)
        || (!usesDeliveredAllocation && items.length === 1 ? number(order.total_amount) : 0);
      const bottleType = String(
        (item && (item.bottleType || item.bottle_type)) || order.bottle_type || ''
      ).trim();

      if (!bottleType || quantity <= 0) return null;
      const sourceKey = `customer-order:${order.id}:${index}`;
      const amountPaid = Math.min(
        totalAmount,
        Math.max(0, Number(allocationsBySource.get(sourceKey)) || 0),
      );
      return {
        id: sourceKey,
        orderId: order.id,
        recordType: 'customer_order',
        readOnly: true,
        status: order.status || 'pending',
        date: order.delivered_at || order.updated_at || order.created_at,
        bottleType,
        quantity,
        pricePerBottle,
        totalAmount,
        amountPaid,
        amountDue: Math.max(0, totalAmount - amountPaid),
        paymentSchedule: paymentSchedule(
          order.payment_schedule || customerPaymentSchedule,
        ),
        notes: order.notes || '',
      };
    })
    .filter(Boolean);
}

function toCustomer(
  row,
  sales,
  orders,
  billingProfile,
  allocationsBySource,
  paymentEvents,
) {
  const customerPaymentSchedule = paymentSchedule(
    billingProfile && billingProfile.payment_schedule,
  );
  const customerSales = sales
    .filter((sale) => sale.customer_id === row.id)
    .map((sale) => {
      const totalAmount = Number(sale.total_amount) || 0;
      const directAmountPaid = Math.min(
        totalAmount,
        Math.max(0, Number(sale.amount_paid) || 0),
      );
      const allocatedAmount = Math.max(0, Number(allocationsBySource.get(String(sale.id))) || 0);
      const amountPaid = Math.min(totalAmount, directAmountPaid + allocatedAmount);
      return {
        id: sale.id,
        recordType: 'sale',
        date: sale.created_at,
        bottleType: sale.bottle_type,
        quantity: Number(sale.quantity) || 0,
        pricePerBottle: Number(sale.price_per_bottle) || 0,
        totalAmount,
        amountPaid,
        directAmountPaid,
        amountDue: Math.max(0, totalAmount - amountPaid),
        paymentSchedule: sale.payment_schedule === 'on_delivery' ? 'on_delivery' : (sale.payment_schedule === 'monthly' ? 'monthly' : undefined),
        notes: sale.notes || '',
      };
    });
  const customerOrders = orders.filter((order) => (
    order.customer_id === row.id && BILLABLE_ORDER_STATUSES.has(order.status)
  ));
  const orderHistory = customerOrders.flatMap((order) => (
    toCustomerOrderHistory(order, allocationsBySource, customerPaymentSchedule)
  ));

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
    paymentSchedule: customerPaymentSchedule,
    createdAt: row.created_at,
    orderCount: customerSales.length + customerOrders.length,
    collectionEvents: (paymentEvents || []).map((payment) => ({
      id: payment.id,
      amount: Math.max(0, Number(payment.amount) || 0),
      receivedAt: payment.received_at,
      paymentType: payment.payment_type === 'invoice' ? 'invoice' : 'monthly',
    })),
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

function toBillingProfileRow(customer) {
  return {
    customer_id: customer.id,
    payment_schedule: paymentSchedule(customer.paymentSchedule),
    updated_at: new Date().toISOString(),
  };
}

function toSaleRow(customer, sale) {
  const totalAmount = Number(sale.totalAmount) || 0;
  const amountPaid = Math.min(
    totalAmount,
    Math.max(0, Number(
      sale.directAmountPaid === undefined ? sale.amountPaid : sale.directAmountPaid
    ) || 0),
  );
  return {
    id: sale.id,
    customer_id: customer.id,
    bottle_type: sale.bottleType,
    quantity: Number(sale.quantity) || 0,
    price_per_bottle: Number(sale.pricePerBottle) || 0,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    payment_schedule: sale.paymentSchedule === 'on_delivery' ? 'on_delivery' : 'monthly',
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

function isMissingBillingProfilesError(error) {
  return ['PGRST204', 'PGRST205', '42P01'].includes(error && error.code)
    || /customer_billing_profiles|schema cache|could not find the table/i.test(
      String((error && error.message) || ''),
    );
}

async function getCustomerBillingProfiles() {
  try {
    return await dbRequest('/customer_billing_profiles?select=customer_id,payment_schedule');
  } catch (error) {
    // A frontend may briefly deploy before its database migration. Customer
    // records must remain visible while billing terms fall back to monthly.
    if (isMissingBillingProfilesError(error)) return [];
    throw error;
  }
}

async function getActivePaymentAllocations() {
  try {
    return await dbRequest('/customer_active_payment_allocations?select=source_key,amount');
  } catch (error) {
    const missingLedger = ['PGRST204', 'PGRST205', '42P01'].includes(error && error.code)
      || /customer_active_payment_allocations|schema cache|could not find the table/i.test(
        String((error && error.message) || ''),
      );
    if (missingLedger) return [];
    throw error;
  }
}

async function getAppliedCustomerPayments() {
  try {
    return await dbRequest(
      '/customer_payments?status=eq.applied&select=id,customer_id,payment_type,amount,received_at&order=received_at.asc',
    );
  } catch (error) {
    const missingLedger = ['PGRST204', 'PGRST205', '42P01'].includes(error && error.code)
      || /customer_payments|schema cache|could not find the table/i.test(
        String((error && error.message) || ''),
      );
    if (missingLedger) return [];
    throw error;
  }
}

export async function getCloudCustomers() {
  requireCloud();
  const [
    customers,
    sales,
    orders,
    adminRows,
    billingProfiles,
    paymentAllocations,
    paymentEvents,
  ] = await Promise.all([
    dbRequest('/customers?select=*&order=created_at.asc'),
    dbRequest('/sales?select=*&order=created_at.asc'),
    dbRequest('/customer_orders?select=*&order=created_at.asc'),
    dbRequest('/admin_profiles?select=auth_user_id,email'),
    getCustomerBillingProfiles(),
    getActivePaymentAllocations(),
    getAppliedCustomerPayments(),
  ]);
  const billingProfilesByCustomer = new Map(
    (billingProfiles || []).map((profile) => [profile.customer_id, profile]),
  );
  const allocationsBySource = new Map(
    (paymentAllocations || []).map((allocation) => [
      String(allocation.source_key || ''),
      Number(allocation.amount) || 0,
    ]),
  );
  const paymentEventsByCustomer = new Map();
  (paymentEvents || []).forEach((payment) => {
    const customerPayments = paymentEventsByCustomer.get(payment.customer_id) || [];
    customerPayments.push(payment);
    paymentEventsByCustomer.set(payment.customer_id, customerPayments);
  });
  return customers
    .filter((customer) => !isAdministratorIdentity(customer, adminRows))
    .map((customer) => toCustomer(
      customer,
      sales,
      orders,
      billingProfilesByCustomer.get(customer.id),
      allocationsBySource,
      paymentEventsByCustomer.get(customer.id),
    ));
}

export async function saveCloudCustomers(customers) {
  requireCloud();
  const customerRows = customers.map(toCustomerRow);
  const billingProfileRows = customers.map(toBillingProfileRow);
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

  if (billingProfileRows.length) {
    try {
      await dbRequest('/customer_billing_profiles?on_conflict=owner_id,customer_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(billingProfileRows),
      });
    } catch (error) {
      if (!isMissingBillingProfilesError(error)) throw error;
    }
  }

  if (saleRows.length) {
    try {
      await dbRequest('/sales?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(saleRows),
      });
    } catch (error) {
      if (error.code !== 'PGRST204' && !/payment_schedule|schema cache/i.test(error.message || '')) throw error;
      await dbRequest('/sales?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(saleRows.map(({ payment_schedule: _paymentSchedule, ...row }) => row)),
      });
    }
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
