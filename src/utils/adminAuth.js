import {
  adminCreateUser,
  clearStoredSession,
  dbRequest,
  getStoredSession,
  isSupabaseConfigured,
  signInWithPassword,
  signOut,
  storeSession,
  verifyPassword,
} from '../services/cloud/supabaseClient';

let currentAdmin = null;

function requireCloud() {
  if (!isSupabaseConfigured()) throw new Error('Supabase configuration is required.');
}

function toAdmin(row) {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    name: row.name,
    email: row.email,
    role: row.role || 'Admin',
    active: row.active !== false,
    createdAt: row.created_at,
  };
}

export async function getAdmins() {
  requireCloud();
  const rows = await dbRequest('/admin_profiles?select=*&order=created_at.asc');
  return rows.map(toAdmin);
}

export async function findAdminByCredentials(email, password) {
  requireCloud();

  const session = await signInWithPassword(email.trim().toLowerCase(), password, 'admin');
  const userId = session.user && session.user.id;
  const [rows, customerRows] = await Promise.all([
    dbRequest(`/admin_profiles?auth_user_id=eq.${userId}&active=eq.true&select=*&limit=1`),
    dbRequest(`/customers?auth_user_id=eq.${userId}&select=id&limit=1`),
  ]);
  const admin = rows && rows[0] ? toAdmin(rows[0]) : null;
  if (!admin || (customerRows && customerRows.length)) {
    await signOut();
    throw new Error(
      customerRows && customerRows.length
        ? 'Customer accounts cannot access the administrator dashboard.'
        : 'Your account is not allowed to access this dashboard.'
    );
  }
  setCurrentAdmin(admin);
  ['authenticated', 'hs_admin_users', 'hs_current_admin'].forEach((key) => localStorage.removeItem(key));
  return admin;
}

export async function createAdmin(admin) {
  requireCloud();
  const result = await adminCreateUser({
    name: admin.name.trim(),
    email: admin.email.trim().toLowerCase(),
    password: admin.password,
    role: admin.role || 'Admin',
  });
  return result.admin;
}

export async function deleteAdminWithOwnerPassword(adminId, ownerPassword) {
  requireCloud();

  const admins = await getAdmins();
  const adminToDelete = admins.find((admin) => admin.id === adminId);
  if (!adminToDelete) throw new Error('Admin not found.');
  if (admins.length <= 1) throw new Error('At least one admin must remain.');
  const owners = admins.filter((admin) => admin.role === 'Owner');
  if (adminToDelete.role === 'Owner' && owners.length <= 1) throw new Error('At least one owner must remain.');

  const owner = owners[0];
  const currentSession = getStoredSession();
  await verifyPassword(owner.email, ownerPassword);
  if (currentSession) storeSession(currentSession, 'admin');

  await dbRequest(`/admin_profiles?id=eq.${adminId}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
  return getAdmins();
}

export function setCurrentAdmin(admin) {
  currentAdmin = {
    id: admin.id,
    authUserId: admin.authUserId,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
}

export function getCurrentAdmin() {
  return currentAdmin;
}

export function clearCurrentAdmin() {
  currentAdmin = null;
  clearStoredSession();
}

export async function getCurrentAdminProfile() {
  requireCloud();
  const session = getStoredSession();
  const userId = session && session.user && session.user.id;
  if (!userId) throw new Error('Your session has expired. Please sign in again.');
  const [rows, customerRows] = await Promise.all([
    dbRequest(`/admin_profiles?auth_user_id=eq.${userId}&active=eq.true&select=*&limit=1`),
    dbRequest(`/customers?auth_user_id=eq.${userId}&select=id&limit=1`),
  ]);
  if (customerRows && customerRows.length) {
    await signOut();
    currentAdmin = null;
    throw new Error('Customer accounts cannot access the administrator dashboard.');
  }
  currentAdmin = rows && rows[0] ? toAdmin(rows[0]) : null;
  if (!currentAdmin) throw new Error('Your account is not allowed to access this dashboard.');
  return currentAdmin;
}
