import {
  dbRequest,
  getStoredSession,
  isSupabaseConfigured,
  signInWithPassword,
  signUpWithPassword,
  storeSession,
} from '../cloud/supabaseClient';
import { canonicalBottleType, resolveOrderPricing } from '../../utils/orderPricing';

function requireCloud() {
  if (!isSupabaseConfigured()) throw new Error('Supabase configuration is required.');
}

function userId() {
  const session = getStoredSession();
  return session && session.user && session.user.id;
}

function toProfile(row) {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    linkedCustomerId: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    companyName: row.company_name || 'Himaliya Spring Water',
    contractLabel: row.contract_label || 'Monthly water delivery contract',
    active: row.active !== false,
    createdAt: row.created_at,
  };
}

function toOrder(row, prices) {
  const quantity = Number(row.quantity || 0);
  const base = {
    id: row.id,
    customerProfileId: row.customer_id,
    linkedCustomerId: row.customer_id,
    quantity,
    bottleType: canonicalBottleType(row.bottle_type),
    unitPrice: Number(row.unit_price || 0),
    totalAmount: Number(row.total_amount || 0),
    deliveryAddress: row.delivery_address,
    deliveryDate: row.delivery_date,
    notes: row.notes,
    status: row.status,
    adminNote: row.admin_note,
    acceptedAt: row.accepted_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    profile: row.customers ? toProfile(row.customers) : null,
  };
  const pricing = resolveOrderPricing(base, prices);
  return { ...base, ...pricing };
}

function toNotification(row) {
  return {
    id: row.id,
    audience: row.audience,
    type: row.type,
    title: row.title,
    detail: row.detail,
    orderId: row.order_id,
    read: row.read,
    createdAt: row.created_at,
  };
}

function toInvoice(row) {
  const payload = row.payload || {};
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    totalAmount: Number(row.total_amount || 0),
    totalQty: Number(row.total_qty || 0),
    paymentStatus: row.payment_status || 'unpaid',
    validated: row.validated === true,
    payload,
    company: payload.company || {},
    customer: payload.customer || {},
    preparedBy: payload.preparedBy || {},
    history: payload.history || [],
    summary: payload.summary || {},
  };
}

export async function signInCustomer(email, password) {
  requireCloud();
  await signInWithPassword(email.trim().toLowerCase(), password, 'customer');
  return getCustomerProfile();
}

export async function registerCustomer(form) {
  requireCloud();
  const email = form.email.trim().toLowerCase();
  const result = await signUpWithPassword(email, form.password);
  if (result.session) {
    storeSession(result.session, 'customer');
  } else {
    await signInWithPassword(email, form.password, 'customer');
  }

  return saveCustomerProfile({
    name: form.name,
    email,
    phone: form.phone,
    address: form.address,
  });
}

export async function getCustomerProfile() {
  requireCloud();
  const authUserId = userId();
  if (!authUserId) throw new Error('Your session has expired. Please sign in again.');
  const rows = await dbRequest(`/customers?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=*&limit=1`);
  return rows && rows[0] ? toProfile(rows[0]) : null;
}

export async function saveCustomerProfile(form) {
  requireCloud();
  const authUserId = userId();
  if (!authUserId) throw new Error('Your session has expired. Please sign in again.');

  const existing = await dbRequest(`/customers?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=id&limit=1`);
  const body = {
      auth_user_id: authUserId,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      source: 'portal',
      updated_at: new Date().toISOString(),
  };
  const rows = existing.length
    ? await dbRequest(`/customers?id=eq.${encodeURIComponent(existing[0].id)}&select=*`, {
      method: 'PATCH', body: JSON.stringify(body),
    })
    : await dbRequest('/customers?select=*', { method: 'POST', body: JSON.stringify(body) });
  return toProfile(rows[0]);
}

export async function getCustomerOrders(prices) {
  requireCloud();
  const rows = await dbRequest('/customer_orders?select=*&order=created_at.desc');
  return rows.map((row) => toOrder(row, prices));
}

export async function getCustomerOrderControls() {
  try {
    const rows = await dbRequest('/rpc/get_customer_order_controls', { method: 'POST', body: '{}' });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      allowCancellation: row ? row.allow_cancellation !== false : true,
      orderCutoffTime: (row && row.order_cutoff_time) || '18:00',
      orderingOpen: row ? row.ordering_open !== false : true,
    };
  } catch {
    return { allowCancellation: true, orderCutoffTime: '18:00', orderingOpen: true };
  }
}

export async function cancelCustomerOrder(orderId) {
  const rows = await dbRequest(`/customer_orders?id=eq.${encodeURIComponent(orderId)}&status=eq.pending&select=*`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'canceled', updated_at: new Date().toISOString() }),
  });
  if (!rows || !rows[0]) throw new Error('This order can no longer be canceled.');
  return toOrder(rows[0], {});
}

export async function createCustomerOrder(profile, form) {
  requireCloud();
  const unitPrice = Number(form.unitPrice || 0);
  const quantity = Number(form.quantity || 1);
  const totalAmount = Number(form.totalAmount || 0) || (unitPrice * quantity);
  const payload = {
    customer_id: profile.id,
    quantity,
    bottle_type: canonicalBottleType(form.bottleType || 'Gallon'),
    unit_price: unitPrice,
    total_amount: totalAmount,
    delivery_address: form.deliveryAddress || profile.address,
    delivery_date: form.deliveryDate || null,
    notes: form.notes || '',
  };

  const createOrder = (body) => dbRequest('/customer_orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  let rows;
  try {
    rows = await createOrder(payload);
  } catch (error) {
    const schemaCacheMiss = error.code === 'PGRST204' ||
      /schema cache|total_amount|unit_price/i.test(error.message || '');
    if (!schemaCacheMiss) throw error;
    const { unit_price: unitPrice, total_amount: totalAmount, ...legacyPayload } = payload;
    rows = await createOrder(legacyPayload);
  }
  const created = toOrder(rows[0], {
    [canonicalBottleType(form.bottleType)]: unitPrice,
  });
  if (created.totalAmount > 0) return created;
  return {
    ...created,
    unitPrice: unitPrice || created.unitPrice,
    totalAmount: totalAmount || created.totalAmount,
  };
}

export async function getCustomerNotifications() {
  requireCloud();
  const rows = await dbRequest('/customer_notifications?audience=eq.customer&select=*&order=created_at.desc');
  return rows.map(toNotification);
}

export async function markCustomerNotificationsRead() {
  requireCloud();
  await dbRequest('/customer_notifications?audience=eq.customer&read=eq.false', {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ read: true }),
  });
}

export async function getCustomerInvoices() {
  requireCloud();
  const rows = await dbRequest('/customer_invoices?select=*&order=invoice_date.desc');
  return rows.map(toInvoice);
}

export async function getCustomerPaidInvoices() {
  return getCustomerInvoices();
}

export async function getAdminCustomerOrders(prices) {
  requireCloud();
  const rows = await dbRequest('/customer_orders?select=*,customers(*)&order=created_at.desc');
  return rows.map((row) => toOrder(row, prices));
}

export async function getAdminCustomerProfiles() {
  requireCloud();
  const rows = await dbRequest('/customers?auth_user_id=not.is.null&select=*&order=created_at.desc');
  return rows.map(toProfile);
}

export async function updateAdminCustomerProfile(profileId, form) {
  requireCloud();
  const rows = await dbRequest(`/customers?id=eq.${encodeURIComponent(profileId)}&select=*`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: form.name.trim(),
      email: (form.email || '').trim().toLowerCase(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      updated_at: new Date().toISOString(),
    }),
  });
  return rows && rows[0] ? toProfile(rows[0]) : null;
}

export async function deleteAdminCustomerProfile(profileId) {
  requireCloud();
  const rows = await dbRequest(`/customers?id=eq.${encodeURIComponent(profileId)}&select=id,name,email`, {
    method: 'DELETE',
    prefer: 'return=representation',
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Customer profile could not be deleted or you do not have permission.');
  }
  return rows[0];
}

export async function updateAdminCustomerOrder(orderOrId, status, adminNote = '', pricing = {}) {
  requireCloud();
  const orderId = typeof orderOrId === 'object' ? orderOrId.id : orderOrId;
  const order = typeof orderOrId === 'object' ? orderOrId : null;
  const quantity = Number((order && order.quantity) || 0);
  const unitPrice = Number(pricing.unitPrice || (order && order.unitPrice) || 0);
  const totalAmount = Number(pricing.totalAmount || (unitPrice * quantity) || (order && order.totalAmount) || 0);
  const payload = {
    status,
    admin_note: adminNote,
    updated_at: new Date().toISOString(),
  };
  if (unitPrice > 0) payload.unit_price = unitPrice;
  if (totalAmount > 0) payload.total_amount = totalAmount;
  if (status === 'accepted') payload.accepted_at = new Date().toISOString();
  if (status === 'delivered') payload.delivered_at = new Date().toISOString();

  const updateOrder = (body) => dbRequest(`/customer_orders?id=eq.${encodeURIComponent(orderId)}&select=*,customers(*)`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  let rows;
  try {
    rows = await updateOrder(payload);
  } catch (error) {
    const schemaCacheMiss = error.code === 'PGRST204' ||
      /schema cache|total_amount|unit_price/i.test(error.message || '');
    if (!schemaCacheMiss) throw error;
    const { unit_price: unitPriceForRetry, total_amount: totalAmountForRetry, ...legacyPayload } = payload;
    rows = await updateOrder(legacyPayload);
  }
  const priceMap = order && order.bottleType ? { [canonicalBottleType(order.bottleType)]: unitPrice } : {};
  return toOrder(rows[0], priceMap);
}

export async function getAdminCustomerPortalStats() {
  requireCloud();
  const [profiles, orders, notifications] = await Promise.all([
    dbRequest('/customers?auth_user_id=not.is.null&select=id'),
    dbRequest('/customer_orders?select=status'),
    dbRequest('/customer_notifications?audience=eq.admin&read=eq.false&select=id'),
  ]);
  return {
    signedUpCustomers: profiles.length,
    pendingOrders: orders.filter((order) => order.status === 'pending').length,
    unreadAdminNotifications: notifications.length,
  };
}

export async function getAdminNotifications() {
  requireCloud();
  const rows = await dbRequest('/customer_notifications?audience=eq.admin&select=*&order=created_at.desc');
  return rows.map(toNotification);
}

export async function markAdminNotificationsRead() {
  requireCloud();
  await dbRequest('/customer_notifications?audience=eq.admin&read=eq.false', {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ read: true }),
  });
}
