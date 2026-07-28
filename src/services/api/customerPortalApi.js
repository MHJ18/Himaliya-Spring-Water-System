import {
  dbRequest,
  getStoredSession,
  isSupabaseConfigured,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  storeSession,
} from '../cloud/supabaseClient';
import { canonicalBottleType, resolveOrderPricing } from '../../utils/orderPricing';
import { resolveInvoiceTotals } from '../../utils/invoiceTotals';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';

const defaultCustomerPreferences = {
  browserNotifications: true,
  orderUpdates: true,
  invoiceAlerts: true,
  defaultBottleType: 'Gallon',
  defaultQuantity: 1,
};

export const ADMIN_NOTIFICATION_STATE_EVENT = 'himaliya:admin-notifications-changed';

const ADMIN_NOTIFICATIONS_CACHE_TTL = 30000;
let adminNotificationsCache = null;
let adminNotificationsRequest = null;
let adminNotificationsRequestUserId = '';

function updateAdminNotificationsCache(update) {
  if (!adminNotificationsCache || adminNotificationsCache.userId !== userId()) return;
  adminNotificationsCache = {
    items: update(adminNotificationsCache.items),
    fetchedAt: Date.now(),
    userId: adminNotificationsCache.userId,
  };
}

function emitAdminNotificationStateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATION_STATE_EVENT));
  }
}

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
    preferences: { ...defaultCustomerPreferences, ...(row.preferences || {}) },
    createdAt: row.created_at,
  };
}

function toOrder(row, prices) {
  const rowItems = Array.isArray(row.items) ? row.items : [];
  const items = rowItems
    .map((item) => {
      const bottleType = canonicalBottleType(item && item.bottleType);
      const quantity = Math.max(0, Number(item && item.quantity) || 0);
      const unitPrice = Number((item && item.unitPrice) || prices[bottleType] || 0);
      return { bottleType, quantity, unitPrice, totalAmount: unitPrice * quantity };
    })
    .filter((item) => item.bottleType && item.quantity > 0);
  const fallbackQuantity = Number(row.quantity || 0);
  const fallbackType = canonicalBottleType(row.bottle_type);
  const normalizedItems = items.length ? items : [{
    bottleType: fallbackType,
    quantity: fallbackQuantity,
    unitPrice: Number(row.unit_price || prices[fallbackType] || 0),
    totalAmount: Number(row.total_amount || 0) || (fallbackQuantity * Number(row.unit_price || prices[fallbackType] || 0)),
  }];
  const quantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const base = {
    id: row.id,
    customerProfileId: row.customer_id,
    linkedCustomerId: row.customer_id,
    quantity,
    bottleType: normalizedItems[0].bottleType,
    items: normalizedItems,
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
    updatedAt: row.updated_at,
    trackingToken: row.tracking_token,
    trackingStatus: row.tracking_status || 'unassigned',
    assignedRiderId: row.assigned_rider_id || null,
    assignedAt: row.assigned_at || null,
    bottlesCollected: Number(row.bottles_collected || 0),
    bottlesDroppedOff: Number(row.bottles_dropped_off || 0),
    riderName: row.rider_name || '',
    riderPhone: row.rider_phone || '',
    riderLat: row.rider_lat === null || row.rider_lat === undefined ? null : Number(row.rider_lat),
    riderLng: row.rider_lng === null || row.rider_lng === undefined ? null : Number(row.rider_lng),
    riderHeading: row.rider_heading === null || row.rider_heading === undefined ? null : Number(row.rider_heading),
    locationUpdatedAt: row.location_updated_at,
    assignedRider: row.assignedRider ? {
      id: row.assignedRider.id,
      authUserId: row.assignedRider.auth_user_id,
      name: row.assignedRider.name || 'Rider',
      email: row.assignedRider.email || '',
      phone: row.assignedRider.phone || '',
      active: row.assignedRider.active !== false,
    } : null,
    profile: row.customers ? toProfile(row.customers) : null,
  };
  const pricing = resolveOrderPricing(base, prices);
  const itemsTotal = normalizedItems.reduce((sum, item) => sum + item.totalAmount, 0);
  return {
    ...base,
    ...pricing,
    unitPrice: normalizedItems.length === 1 ? normalizedItems[0].unitPrice : 0,
    totalAmount: Number(row.total_amount || 0) || itemsTotal || pricing.totalAmount,
  };
}

function toNotification(row) {
  const relatedOrder = row.customer_orders || null;
  const relatedCustomer = relatedOrder && relatedOrder.customers
    ? (Array.isArray(relatedOrder.customers) ? relatedOrder.customers[0] : relatedOrder.customers)
    : null;
  const customerName = relatedCustomer && relatedCustomer.name;
  const shouldEnrichOrder = row.audience === 'admin' && row.type === 'order' && customerName;
  const bottleType = relatedOrder && canonicalBottleType(relatedOrder.bottle_type);
  const relatedItems = relatedOrder && Array.isArray(relatedOrder.items) && relatedOrder.items.length
    ? relatedOrder.items
    : relatedOrder ? [{ bottleType, quantity: relatedOrder.quantity }] : [];
  const relatedSummary = relatedItems
    .map((item) => `${Number(item.quantity || 0)} × ${BOTTLE_TYPE_LABELS[canonicalBottleType(item.bottleType)] || canonicalBottleType(item.bottleType)}`)
    .join(' + ');
  return {
    id: row.id,
    audience: row.audience,
    type: row.type,
    title: shouldEnrichOrder ? `New order from ${customerName}` : row.title,
    detail: shouldEnrichOrder
      ? `${customerName} ordered ${relatedSummary}.`
      : row.detail,
    orderId: row.order_id,
    read: row.read,
    createdAt: row.created_at,
  };
}

function toInvoice(row) {
  const payload = row.payload || {};
  const totals = resolveInvoiceTotals(row);
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    totalAmount: totals.totalAmount,
    totalQty: totals.totalQty,
    paymentStatus: row.payment_status || 'unpaid',
    validated: row.validated === true,
    payload,
    company: payload.company || {},
    customer: payload.customer || {},
    preparedBy: payload.preparedBy || {},
    history: totals.history,
    summary: payload.summary || {},
  };
}

function isEmailIdentifier(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function signInCustomerWithPhone(phone, password) {
  const response = await fetch('/.netlify/functions/customer-phone-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone.trim(), password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || 'Incorrect phone number or password.');
  }
  storeSession(body, 'customer');
}

export async function signInCustomer(identifier, password) {
  requireCloud();
  const value = String(identifier || '').trim();
  try {
    if (isEmailIdentifier(value)) {
      await signInWithPassword(value.toLowerCase(), password, 'customer');
    } else {
      await signInCustomerWithPhone(value, password);
    }
    return await getCustomerProfile();
  } catch (error) {
    await signOut().catch(() => {});
    throw error;
  }
}

export async function registerCustomer(form) {
  requireCloud();
  const email = form.email.trim().toLowerCase();
  const result = await signUpWithPassword(email, form.password);
  const session = result && (result.session || (
    result.access_token && result.refresh_token ? result : null
  ));
  const user = result && result.user;
  if (session) {
    storeSession(session, 'customer');
  } else if (user && Array.isArray(user.identities) && user.identities.length === 0) {
    throw new Error('An account with this email already exists. Sign in instead or use Forgot password.');
  } else if (user && !user.email_confirmed_at && !user.confirmed_at) {
    throw new Error('Email not confirmed. Turn off Confirm Email in Supabase Authentication settings before signing up.');
  } else if (!user) {
    throw new Error('Account creation did not complete. Please try again.');
  } else {
    await signInWithPassword(email, form.password, 'customer');
  }

  const profile = await saveCustomerProfile({
    name: form.name,
    email,
    phone: form.phone,
    address: form.address,
  });
  await signOut();
  if (!profile.active) {
    throw new Error('This customer account has been deactivated. Contact Himaliya Spring Water.');
  }
  return profile;
}

export async function getCustomerProfile() {
  requireCloud();
  const authUserId = userId();
  if (!authUserId) throw new Error('Your session has expired. Please sign in again.');
  const rows = await dbRequest(`/customers?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=*&limit=1`);
  if (rows && rows[0]) return toProfile(rows[0]);

  const statusResult = await dbRequest('/rpc/get_customer_account_status', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const status = Array.isArray(statusResult) ? statusResult[0] : statusResult;
  if (status && status.exists && status.active === false) {
    throw new Error('This customer account has been deactivated. Contact Himaliya Spring Water.');
  }
  return null;
}

export async function saveCustomerProfile(form) {
  requireCloud();
  const authUserId = userId();
  if (!authUserId) throw new Error('Your session has expired. Please sign in again.');

  const deviceIndependentPreferences = {
    ...(form.preferences && typeof form.preferences === 'object' ? form.preferences : {}),
  };
  delete deviceIndependentPreferences.theme;
  const result = await dbRequest('/rpc/claim_customer_account', {
    method: 'POST',
    body: JSON.stringify({
      p_name: form.name.trim(),
      p_email: form.email.trim().toLowerCase(),
      p_phone: form.phone.trim(),
      p_address: form.address.trim(),
      p_preferences: form.preferences && typeof form.preferences === 'object'
        ? { ...defaultCustomerPreferences, ...deviceIndependentPreferences }
        : null,
      p_customer_id: form.customerId || null,
    }),
  });
  const row = Array.isArray(result) ? result[0] : result;
  if (!row) throw new Error('Customer account creation could not be completed.');
  return toProfile(row);
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
  const items = (Array.isArray(form.items) ? form.items : [{
    bottleType: form.bottleType || 'Gallon',
    quantity: form.quantity || 1,
    unitPrice: form.unitPrice || 0,
  }])
    .map((item) => ({
      bottleType: canonicalBottleType(item.bottleType),
      quantity: Math.max(0, Number(item.quantity || 0)),
      unitPrice: Math.max(0, Number(item.unitPrice || 0)),
    }))
    .filter((item) => item.bottleType && item.quantity > 0);
  if (!items.length) throw new Error('Choose at least one bottle before placing the order.');
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const firstItem = items[0];
  const deliveryAddress = String(profile.address || '').trim();
  if (!deliveryAddress) {
    throw new Error('Add a delivery address to your profile before placing an order.');
  }
  const payload = {
    customer_id: profile.id,
    quantity,
    bottle_type: firstItem.bottleType,
    items,
    unit_price: items.length === 1 ? firstItem.unitPrice : 0,
    total_amount: totalAmount,
    delivery_address: deliveryAddress,
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
    const legacyPayload = { ...payload };
    delete legacyPayload.unit_price;
    delete legacyPayload.total_amount;
    rows = await createOrder(legacyPayload);
  }
  const created = toOrder(rows[0], Object.fromEntries(items.map((item) => [item.bottleType, item.unitPrice])));
  if (created.totalAmount > 0) return created;
  return {
    ...created,
    items: items.map((item) => ({ ...item, totalAmount: item.quantity * item.unitPrice })),
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
  const rows = await dbRequest('/customer_orders?select=*,customers(*),assignedRider:admin_profiles!customer_orders_assigned_rider_fkey(id,auth_user_id,name,email,phone,active)&order=created_at.desc');
  return rows.map((row) => toOrder(row, prices));
}

export async function getActiveRiders() {
  requireCloud();
  const rows = await dbRequest('/admin_profiles?role=eq.Rider&active=eq.true&select=id,auth_user_id,name,email,phone,active,created_at&order=name.asc');
  return (rows || []).map((row) => ({
    id: row.id,
    authUserId: row.auth_user_id,
    name: row.name || 'Rider',
    email: row.email || '',
    phone: row.phone || '',
    active: row.active !== false,
    createdAt: row.created_at,
  }));
}

export async function assignOrderToRider(order, riderId) {
  requireCloud();
  if (!order || !order.id) throw new Error('Select an order before assigning a rider.');
  const rows = await dbRequest(
    `/customer_orders?id=eq.${encodeURIComponent(order.id)}&select=*,customers(*),assignedRider:admin_profiles!customer_orders_assigned_rider_fkey(id,auth_user_id,name,email,phone,active)`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        assigned_rider_id: riderId || null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!rows || !rows[0]) throw new Error('The rider assignment could not be saved.');
  return toOrder(rows[0], order.bottleType ? { [canonicalBottleType(order.bottleType)]: order.unitPrice } : {});
}

export async function getAdminCustomerProfiles() {
  requireCloud();
  const [rows, adminRows] = await Promise.all([
    dbRequest('/customers?auth_user_id=not.is.null&select=*&order=created_at.desc'),
    dbRequest('/admin_profiles?select=auth_user_id,email'),
  ]);
  const adminIds = new Set((adminRows || []).map((admin) => admin.auth_user_id).filter(Boolean));
  const adminEmails = new Set((adminRows || [])
    .map((admin) => String(admin.email || '').trim().toLowerCase())
    .filter(Boolean));
  return rows
    .filter((row) => (
      !adminIds.has(row.auth_user_id)
      && !adminEmails.has(String(row.email || '').trim().toLowerCase())
    ))
    .map(toProfile);
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

export async function setAdminCustomerActive(customerId, active) {
  requireCloud();
  const rows = await dbRequest(`/customers?id=eq.${encodeURIComponent(customerId)}&select=*`, {
    method: 'PATCH',
    body: JSON.stringify({
      active: Boolean(active),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!rows || !rows[0]) throw new Error('Customer account status could not be updated.');
  return toProfile(rows[0]);
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

export async function updateAdminRiderTracking(order, tracking) {
  requireCloud();
  if (!order || !order.id) throw new Error('Select an order before updating rider tracking.');

  const payload = {
    rider_name: String(tracking.riderName || '').trim(),
    rider_phone: String(tracking.riderPhone || '').trim(),
    tracking_status: tracking.trackingStatus || 'unassigned',
    rider_lat: tracking.riderLat === '' || tracking.riderLat === null
      ? null
      : Number(tracking.riderLat),
    rider_lng: tracking.riderLng === '' || tracking.riderLng === null
      ? null
      : Number(tracking.riderLng),
    rider_heading: tracking.riderHeading === '' || tracking.riderHeading === null
      ? null
      : Number(tracking.riderHeading),
    bottles_collected: Math.max(0, Number(
      tracking.bottlesCollected !== undefined && tracking.bottlesCollected !== null
        ? tracking.bottlesCollected : order.bottlesCollected
    ) || 0),
    bottles_dropped_off: Math.max(0, Number(
      tracking.bottlesDroppedOff !== undefined && tracking.bottlesDroppedOff !== null
        ? tracking.bottlesDroppedOff : order.bottlesDroppedOff
    ) || 0),
    updated_at: new Date().toISOString(),
  };

  const rows = await dbRequest(
    `/customer_orders?id=eq.${encodeURIComponent(order.id)}&select=*,customers(*)`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );

  if (!rows || !rows[0]) throw new Error('The delivery could not be updated.');
  const priceMap = order.bottleType ? {
    [canonicalBottleType(order.bottleType)]: Number(order.unitPrice || 0),
  } : {};
  return toOrder(rows[0], priceMap);
}

export async function getPublicRiderTracking(trackingToken) {
  requireCloud();
  const token = String(trackingToken || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    throw new Error('This tracking link is not valid.');
  }

  const result = await dbRequest('/rpc/get_delivery_tracking', {
    method: 'POST',
    body: JSON.stringify({ p_tracking_token: token }),
    useUserToken: false,
  });
  const row = Array.isArray(result) ? result[0] : result;
  if (!row) throw new Error('This tracking link is no longer available.');

  return {
    orderId: row.order_id,
    trackingToken: row.tracking_token,
    customerName: row.customer_name || 'Customer',
    quantity: Number(row.quantity || 0),
    bottleType: canonicalBottleType(row.bottle_type),
    items: (Array.isArray(row.items) && row.items.length ? row.items : [{
      bottleType: row.bottle_type,
      quantity: row.quantity,
    }]).map((item) => ({
      bottleType: canonicalBottleType(item.bottleType),
      quantity: Number(item.quantity || 0),
    })),
    deliveryAddress: row.delivery_address || '',
    deliveryDate: row.delivery_date,
    orderStatus: row.order_status,
    trackingStatus: row.tracking_status || 'unassigned',
    riderName: row.rider_name || '',
    riderPhone: row.rider_phone || '',
    riderLat: row.rider_lat === null || row.rider_lat === undefined ? null : Number(row.rider_lat),
    riderLng: row.rider_lng === null || row.rider_lng === undefined ? null : Number(row.rider_lng),
    riderHeading: row.rider_heading === null || row.rider_heading === undefined ? null : Number(row.rider_heading),
    locationUpdatedAt: row.location_updated_at,
    acceptedAt: row.accepted_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
  };
}

export async function getAdminCustomerPortalStats() {
  requireCloud();
  const [profiles, orders, notifications, inventory] = await Promise.all([
    dbRequest('/customers?select=id,auth_user_id,bottles_held'),
    dbRequest('/customer_orders?select=status'),
    dbRequest('/customer_notifications?audience=eq.admin&read=eq.false&select=id'),
    dbRequest('/inventory_stock?select=quantity'),
  ]);
  return {
    signedUpCustomers: profiles.filter((profile) => profile.auth_user_id).length,
    pendingOrders: orders.filter((order) => order.status === 'pending').length,
    unreadAdminNotifications: notifications.length,
    bottlesWithCustomers: profiles.reduce((sum, profile) => sum + (Number(profile.bottles_held) || 0), 0),
    companyBottleStock: inventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
  };
}

export function getCachedAdminNotifications() {
  return adminNotificationsCache && adminNotificationsCache.userId === userId()
    ? adminNotificationsCache.items
    : null;
}

export async function getAdminNotifications({ forceRefresh = false } = {}) {
  requireCloud();
  const currentUserId = userId();
  const cacheFresh = adminNotificationsCache &&
    adminNotificationsCache.userId === currentUserId &&
    (Date.now() - adminNotificationsCache.fetchedAt) < ADMIN_NOTIFICATIONS_CACHE_TTL;
  if (!forceRefresh && cacheFresh) return adminNotificationsCache.items;
  if (adminNotificationsRequest && adminNotificationsRequestUserId === currentUserId) {
    return adminNotificationsRequest;
  }

  const request = dbRequest('/customer_notifications?audience=eq.admin&select=*,customer_orders(quantity,bottle_type,items,customers(name))&order=created_at.desc')
    .then((rows) => {
      const items = rows.map(toNotification);
      adminNotificationsCache = { items, fetchedAt: Date.now(), userId: currentUserId };
      return items;
    })
    .finally(() => {
      if (adminNotificationsRequest === request) {
        adminNotificationsRequest = null;
        adminNotificationsRequestUserId = '';
      }
    });
  adminNotificationsRequest = request;
  adminNotificationsRequestUserId = currentUserId;
  return adminNotificationsRequest;
}

export function prefetchAdminNotifications() {
  return getAdminNotifications().catch(() => getCachedAdminNotifications() || []);
}

export async function getAdminNavigationBadges() {
  requireCloud();
  const rows = await dbRequest('/customer_notifications?audience=eq.admin&read=eq.false&type=in.(order,tracking,delivery,account)&select=type');
  const types = new Set((rows || []).map((row) => row.type));
  return {
    orders: types.has('order'),
    tracking: types.has('tracking') || types.has('delivery'),
    accounts: types.has('account'),
  };
}

export async function markAdminNotificationRead(notificationId) {
  requireCloud();
  await dbRequest(`/customer_notifications?id=eq.${encodeURIComponent(notificationId)}&audience=eq.admin&read=eq.false`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ read: true }),
  });
  updateAdminNotificationsCache((items) => items.map((item) => (
    item.id === notificationId ? { ...item, read: true } : item
  )));
  emitAdminNotificationStateChanged();
}

export async function markAdminNotificationsRead() {
  requireCloud();
  await dbRequest('/customer_notifications?audience=eq.admin&read=eq.false', {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ read: true }),
  });
  updateAdminNotificationsCache((items) => items.map((item) => ({ ...item, read: true })));
  emitAdminNotificationStateChanged();
}

export async function clearAdminNotifications() {
  requireCloud();
  await dbRequest('/customer_notifications?audience=eq.admin', {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
  adminNotificationsCache = {
    items: [],
    fetchedAt: Date.now(),
    userId: userId(),
  };
  emitAdminNotificationStateChanged();
}

export async function markAdminNotificationsByTypesRead(types) {
  requireCloud();
  const allowed = ['account', 'delivery', 'order', 'tracking'];
  const selected = [...new Set((types || []).filter((type) => allowed.includes(type)))];
  if (!selected.length) return;
  await dbRequest(`/customer_notifications?audience=eq.admin&read=eq.false&type=in.(${selected.join(',')})`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ read: true }),
  });
  updateAdminNotificationsCache((items) => items.map((item) => (
    selected.includes(item.type) ? { ...item, read: true } : item
  )));
  emitAdminNotificationStateChanged();
}
