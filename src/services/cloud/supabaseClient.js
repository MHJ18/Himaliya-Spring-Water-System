const SESSION_KEY = 'hs_supabase_session';
const SESSION_TYPE_KEY = 'hs_supabase_session_type';
const SESSION_EXPIRED_EVENT = 'hs:session-expired';
const SESSION_READY_EVENT = 'hs:session-ready';
const SESSION_EXPIRED_NOTICE_KEY = 'hs_session_expired_notice';
let sessionExpiryNotified = false;

function notifySessionExpired() {
  if (sessionExpiryNotified) return;
  sessionExpiryNotified = true;
  clearStoredSession();
  sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1');
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export function getSessionExpiredEventName() {
  return SESSION_EXPIRED_EVENT;
}

export function getSessionReadyEventName() {
  return SESSION_READY_EVENT;
}

export function hasSessionExpiredNotice() {
  return sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === '1';
}

export function consumeSessionExpiredNotice() {
  const hasNotice = hasSessionExpiredNotice();
  if (hasNotice) sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  return hasNotice;
}

function getConfig() {
  return {
    url: process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured() {
  const config = getConfig();
  return Boolean(config.url && config.anonKey);
}

function baseUrl(path) {
  const config = getConfig();
  return `${config.url.replace(/\/$/, '')}${path}`;
}

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function storeSession(session, sessionType = 'admin') {
  sessionExpiryNotified = false;
  sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(SESSION_TYPE_KEY, sessionType);
  window.dispatchEvent(new CustomEvent(SESSION_READY_EVENT));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TYPE_KEY);
}

export function getAccessToken() {
  const session = getStoredSession();
  return session && session.access_token;
}

export function hasStoredSession() {
  const session = getStoredSession();
  return Boolean(session && session.access_token && session.refresh_token);
}

export function getStoredSessionType() {
  return localStorage.getItem(SESSION_TYPE_KEY);
}

export function hasStoredSessionType(sessionType) {
  if (!hasStoredSession()) return false;
  const storedType = getStoredSessionType();
  return storedType ? storedType === sessionType : sessionType === 'admin';
}

async function getFreshSession() {
  const session = getStoredSession();
  const sessionType = getStoredSessionType() || 'admin';
  if (!session || !session.refresh_token) {
    notifySessionExpired();
    throw new Error('Your session has expired. Please sign in again.');
  }
  const expiresAt = Number(session.expires_at || 0) * 1000;
  if (!expiresAt || expiresAt - Date.now() > 60000) return session;
  try {
    const refreshed = await authRequest('/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    storeSession(refreshed, sessionType);
    return refreshed;
  } catch {
    notifySessionExpired();
    throw new Error('Your session has expired. Please sign in again.');
  }
}

async function getHeaders(useUserToken = true) {
  const config = getConfig();
  const session = useUserToken ? await getFreshSession() : null;
  const token = session && session.access_token;
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${token || config.anonKey}`,
    'Content-Type': 'application/json',
  };
}

async function parseResponse(response) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const description = body && (body.msg || body.message || body.error_description || body.error);
    const error = new Error(description || 'Supabase request failed');
    error.status = response.status;
    error.code = body && (body.code || body.error_code || body.error);
    throw error;
  }
  return body;
}

export async function authRequest(path, options = {}) {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
  const config = getConfig();
  const response = await fetch(baseUrl(`/auth/v1${path}`), {
    ...options,
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return parseResponse(response);
}

export async function dbRequest(path, options = {}) {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
  try {
    const response = await fetch(baseUrl(`/rest/v1${path}`), {
      ...options,
      headers: {
        ...(await getHeaders(options.useUserToken !== false)),
        Prefer: options.prefer || 'return=representation',
        ...(options.headers || {}),
      },
    });
    return await parseResponse(response);
  } catch (error) {
    if (error.status === 401 && options.useUserToken !== false) notifySessionExpired();
    throw error;
  }
}

export async function signInWithPassword(email, password, sessionType = 'admin') {
  const session = await authRequest('/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  storeSession(session, sessionType);
  return session;
}

export async function signUpWithPassword(email, password) {
  return authRequest('/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyPassword(email, password) {
  return authRequest('/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function requestPasswordReset(email, redirectTo) {
  const redirect = encodeURIComponent(redirectTo || `${window.location.origin}/reset-password`);
  await authRequest(`/recover?redirect_to=${redirect}`, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  return true;
}

export async function updatePasswordWithToken(accessToken, newPassword) {
  return authRequest('/user', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password: newPassword }),
  });
}

export async function changeSignedInPassword(email, currentPassword, newPassword) {
  const sessionType = getStoredSessionType() || 'admin';
  const verifiedSession = await verifyPassword(email.trim().toLowerCase(), currentPassword);
  storeSession(verifiedSession, sessionType);
  await updatePasswordWithToken(verifiedSession.access_token, newPassword);
  return true;
}

export async function adminResetCustomerPassword(customerId, newPassword, ownerPassword) {
  const session = await getFreshSession();
  const response = await fetch('/.netlify/functions/admin-reset-user-password', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerId, password: newPassword, ownerPassword }),
  });
  return parseResponse(response);
}

export async function adminCreateUser(admin) {
  const session = await getFreshSession();
  const response = await fetch('/.netlify/functions/admin-create-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(admin),
  });
  return parseResponse(response);
}

export async function signOut() {
  const token = getAccessToken();
  // Clear local auth first so the UI cannot remain on a protected screen while
  // the remote session revocation is slow or unavailable.
  clearStoredSession();
  sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  if (token) {
    try {
      await authRequest('/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Local sign-out should still succeed if the session is already expired.
    }
  }
}
