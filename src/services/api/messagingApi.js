import {
  dbRequest,
  getStoredSession,
  isSupabaseConfigured,
} from '../cloud/supabaseClient';

function requireCloud() {
  if (!isSupabaseConfigured()) throw new Error('Supabase configuration is required.');
}

function currentUserId() {
  const session = getStoredSession();
  return session && session.user && session.user.id;
}

function toConversation(row) {
  if (!row) return null;
  const customer = row.customers || null;
  return {
    id: row.id,
    customerId: row.customer_id,
    authUserId: row.auth_user_id,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview || '',
    lastSenderRole: row.last_sender_role || 'customer',
    adminUnreadCount: Number(row.admin_unread_count || 0),
    customerUnreadCount: Number(row.customer_unread_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customer: customer ? {
      id: customer.id,
      name: customer.name || 'Customer',
      phone: customer.phone || '',
      email: customer.email || '',
      photo: customer.photo || '',
      address: customer.address || '',
    } : null,
  };
}

function toMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderRole: row.sender_role,
    senderAuthUserId: row.sender_auth_user_id,
    body: row.body,
    createdAt: row.created_at,
    mine: row.sender_auth_user_id === currentUserId(),
  };
}

function unwrapRow(result) {
  if (Array.isArray(result)) return result[0] || null;
  return result || null;
}

export async function getAdminConversations() {
  requireCloud();
  const rows = await dbRequest(
    '/customer_conversations?select=*,customers(id,name,phone,email,photo,address)&order=last_message_at.desc.nullslast,created_at.desc',
  );
  return (rows || []).map(toConversation);
}

export async function getAdminMessageableCustomers() {
  requireCloud();
  const rows = await dbRequest(
    '/customers?auth_user_id=not.is.null&active=eq.true&select=id,name,phone,email,photo,address&order=name.asc',
  );
  return (rows || []).map((row) => ({
    id: row.id,
    name: row.name || 'Customer',
    phone: row.phone || '',
    email: row.email || '',
    photo: row.photo || '',
    address: row.address || '',
  }));
}

export async function openAdminConversation(customerId) {
  requireCloud();
  const result = await dbRequest('/rpc/open_admin_customer_conversation', {
    method: 'POST',
    body: JSON.stringify({ p_customer_id: customerId }),
  });
  const row = unwrapRow(result);
  if (!row) throw new Error('Could not open this conversation.');
  const enriched = await dbRequest(
    `/customer_conversations?id=eq.${encodeURIComponent(row.id)}&select=*,customers(id,name,phone,email,photo,address)&limit=1`,
  );
  return toConversation((enriched && enriched[0]) || row);
}

export async function getCustomerConversation() {
  requireCloud();
  const result = await dbRequest('/rpc/open_customer_conversation', {
    method: 'POST',
    body: '{}',
  });
  const row = unwrapRow(result);
  if (!row) throw new Error('Could not open your support conversation.');
  return toConversation(row);
}

export async function getConversationMessages(conversationId) {
  requireCloud();
  if (!conversationId) return [];
  const rows = await dbRequest(
    `/customer_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.asc`,
  );
  return (rows || []).map(toMessage);
}

export async function sendConversationMessage(conversationId, body, senderRole) {
  requireCloud();
  const text = String(body || '').trim();
  if (!text) throw new Error('Write a message before sending.');
  if (text.length > 2000) throw new Error('Messages can be up to 2,000 characters.');

  const rows = await dbRequest('/customer_messages?select=*', {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_role: senderRole,
      sender_auth_user_id: currentUserId(),
      body: text,
    }),
  });
  if (!rows || !rows[0]) throw new Error('Message could not be sent.');
  return toMessage(rows[0]);
}

export async function markConversationRead(conversationId, readerRole) {
  requireCloud();
  const result = await dbRequest('/rpc/mark_conversation_read', {
    method: 'POST',
    body: JSON.stringify({
      p_conversation_id: conversationId,
      p_reader_role: readerRole,
    }),
  });
  return toConversation(unwrapRow(result));
}

export async function getAdminUnreadMessageCount() {
  requireCloud();
  const rows = await dbRequest(
    '/customer_conversations?admin_unread_count=gt.0&select=admin_unread_count',
  );
  return (rows || []).reduce((sum, row) => sum + Number(row.admin_unread_count || 0), 0);
}

export async function getCustomerUnreadMessageCount() {
  requireCloud();
  const rows = await dbRequest(
    '/customer_conversations?select=customer_unread_count&limit=1',
  );
  return Number((rows && rows[0] && rows[0].customer_unread_count) || 0);
}
