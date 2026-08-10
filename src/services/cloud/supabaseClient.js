const SESSION_KEY = 'hs_supabase_session';
const SESSION_TYPE_KEY = 'hs_supabase_session_type';
const PASSWORD_CHANGE_REQUIRED_KEY = 'hs_staff_password_change_required';
const SESSION_EXPIRED_EVENT = 'hs:session-expired';
const SESSION_READY_EVENT = 'hs:session-ready';
const SESSION_EXPIRED_NOTICE_KEY = 'hs_session_expired_notice';
const PENDING_CUSTOMER_PROFILE_KEY = 'hs_pending_customer_profile';
const PENDING_CUSTOMER_PROFILE_MAX_AGE = 24 * 60 * 60 * 1000;
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
  localStorage.removeItem(PASSWORD_CHANGE_REQUIRED_KEY);
}

export function storePendingCustomerProfile(profile) {
  const pendingProfile = {
    name: String((profile && profile.name) || '').trim(),
    email: String((profile && profile.email) || '').trim().toLowerCase(),
    phone: String((profile && profile.phone) || '').trim(),
    address: String((profile && profile.address) || '').trim(),
    createdAt: Date.now(),
  };
  localStorage.setItem(PENDING_CUSTOMER_PROFILE_KEY, JSON.stringify(pendingProfile));
  return pendingProfile;
}

export function getPendingCustomerProfile() {
  try {
    const pendingProfile = JSON.parse(localStorage.getItem(PENDING_CUSTOMER_PROFILE_KEY));
    const createdAt = Number(pendingProfile && pendingProfile.createdAt);
    if (!pendingProfile || !createdAt || Date.now() - createdAt > PENDING_CUSTOMER_PROFILE_MAX_AGE) {
      localStorage.removeItem(PENDING_CUSTOMER_PROFILE_KEY);
      return null;
    }
    return pendingProfile;
  } catch {
    localStorage.removeItem(PENDING_CUSTOMER_PROFILE_KEY);
    return null;
  }
}

export function clearPendingCustomerProfile() {
  localStorage.removeItem(PENDING_CUSTOMER_PROFILE_KEY);
}

export function setPasswordChangeRequired(required) {
  if (required) localStorage.setItem(PASSWORD_CHANGE_REQUIRED_KEY, '1');
  else localStorage.removeItem(PASSWORD_CHANGE_REQUIRED_KEY);
}

export function isPasswordChangeRequired() {
  return localStorage.getItem(PASSWORD_CHANGE_REQUIRED_KEY) === '1';
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
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const isHtmlFallback = /^\s*</i.test(text || '');
    const description = body && (body.msg || body.message || body.error_description || body.error);
    const error = new Error(description || 'Supabase request failed');
    if (isHtmlFallback) {
      error.message = 'Administrator service is unavailable on this deployment. Configure the server function before creating admin accounts.';
    }
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

export async function ensureEmailConfirmationEnabled() {
  let settings;
  try {
    settings = await authRequest('/settings', { method: 'GET' });
  } catch {
    throw new Error(
      'Customer registration is paused because secure email confirmation could not be verified. Check the Supabase Auth service and try again.'
    );
  }
  if (!settings || settings.mailer_autoconfirm !== false) {
    throw new Error(
      'Secure email confirmation is required before customer history can be linked. Enable Confirm Email in Supabase Authentication settings.'
    );
  }
  return true;
}

export async function ensurePhoneVerificationEnabled() {
  let settings;
  try {
    settings = await authRequest('/settings', { method: 'GET' });
  } catch {
    throw new Error(
      'Phone verification is temporarily unavailable because Supabase Auth settings could not be checked.'
    );
  }
  const phoneEnabled = Boolean(settings && settings.external && settings.external.phone);
  const providerConfigured = Boolean(settings && String(settings.sms_provider || '').trim());
  if (!phoneEnabled || settings.phone_autoconfirm !== false || !providerConfigured) {
    throw new Error(
      'SMS verification is not configured. Enable the Supabase Phone provider, require phone confirmation, and configure an SMS provider before linking by phone.'
    );
  }
  return true;
}

function normalizeAuthPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.indexOf('0092') === 0) digits = digits.slice(2);
  if (digits.indexOf('92') === 0) return digits;
  if (digits.indexOf('0') === 0) return `92${digits.slice(1)}`;
  return digits.length === 10 ? `92${digits}` : digits;
}

export async function requestPhoneChange(phone) {
  const session = await getFreshSession();
  const response = await authRequest('/user', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ phone }),
  });
  const user = response && response.user ? response.user : response;
  if (!user || !user.id || user.id !== (session.user && session.user.id)) {
    throw new Error('Phone verification could not be started for this customer session.');
  }
  storeSession({ ...session, user }, getStoredSessionType() || 'customer');
  return user;
}

async function revokeAccessToken(accessToken) {
  if (!accessToken) return;
  try {
    await authRequest('/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Revocation is best effort; local credentials are never accepted afterward.
  }
}

export async function verifyPhoneChangeOtp(phone, token) {
  const originalSession = await getFreshSession();
  const originalUserId = originalSession.user && originalSession.user.id;
  const response = await authRequest('/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, token, type: 'phone_change' }),
  });
  const data = response && response.data ? response.data : response;
  const verificationSession = data && (data.session || (
    data.access_token && data.refresh_token ? data : null
  ));
  const accessToken = (verificationSession && verificationSession.access_token)
    || originalSession.access_token;
  const userResponse = await authRequest('/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const verifiedUser = userResponse && userResponse.user ? userResponse.user : userResponse;

  if (!verifiedUser || !verifiedUser.id || verifiedUser.id !== originalUserId) {
    if (verificationSession) await revokeAccessToken(verificationSession.access_token);
    await discardAuthSession(originalSession);
    throw new Error(
      'Phone verification returned a different Auth identity. Both sessions were revoked; contact Himaliya Spring Water before retrying.'
    );
  }
  if (
    normalizeAuthPhone(verifiedUser.phone) !== normalizeAuthPhone(phone)
    || !verifiedUser.phone_confirmed_at
  ) {
    throw new Error('The SMS code did not verify this phone number. Request a new code and try again.');
  }

  const nextSession = verificationSession
    ? { ...verificationSession, user: verifiedUser }
    : { ...originalSession, user: verifiedUser };
  storeSession(nextSession, 'customer');
  return nextSession;
}

export async function requestCustomerLinkEmailOtp(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error('Enter a valid email address before requesting a verification code.');
  }

  await authRequest('/otp', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizedEmail,
      create_user: false,
    }),
  });
  return true;
}

export async function verifyCustomerLinkEmailOtp(email, token) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedToken = String(token || '').trim();
  const originalSession = await getFreshSession();
  const originalUserId = originalSession.user && originalSession.user.id;

  const response = await authRequest('/verify', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email',
    }),
  });
  const data = response && response.data ? response.data : response;
  const verificationSession = data && (data.session || (
    data.access_token && data.refresh_token ? data : null
  ));
  if (!verificationSession || !verificationSession.access_token) {
    throw new Error('The email verification code did not create a valid session. Request a new code.');
  }

  const userResponse = verificationSession.user || await authRequest('/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${verificationSession.access_token}` },
  });
  const verifiedUser = userResponse && userResponse.user ? userResponse.user : userResponse;
  const verifiedEmail = String((verifiedUser && verifiedUser.email) || '').trim().toLowerCase();

  if (!verifiedUser || verifiedUser.id !== originalUserId || verifiedEmail !== normalizedEmail) {
    await revokeAccessToken(verificationSession.access_token);
    await discardAuthSession(originalSession);
    throw new Error(
      'Email verification returned a different account. Both sessions were revoked; contact Himaliya Spring Water before retrying.'
    );
  }

  const nextSession = { ...verificationSession, user: verifiedUser };
  storeSession(nextSession, 'customer');
  return nextSession;
}

export async function signUpWithPassword(email, password, redirectTo) {
  const redirectQuery = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  const response = await authRequest(`/signup${redirectQuery}`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = response && response.data ? response.data : response;
  if (!data) return { user: null, session: null };
  if (data.user || data.session) {
    return {
      user: data.user || (data.session && data.session.user) || null,
      session: data.session || (data.access_token && data.refresh_token ? data : null),
    };
  }
  // GoTrue returns the user itself when email confirmation is required.
  if (data.id) return { user: data, session: null };
  return { user: null, session: null };
}

function callbackParams(hash, search) {
  const hashParams = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const searchParams = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  return { hashParams, searchParams };
}

export function isCustomerEmailConfirmationCallback(hash, search) {
  const { hashParams, searchParams } = callbackParams(hash, search);
  const type = hashParams.get('type') || searchParams.get('type');
  return type === 'signup'
    || searchParams.get('confirmation') === '1'
    || Boolean(hashParams.get('error') || searchParams.get('error'));
}

function clearCustomerEmailConfirmationUrl() {
  if (typeof window === 'undefined' || !window.history || !window.location) return;
  const query = new URLSearchParams(window.location.search || '');
  ['confirmation', 'error', 'error_code', 'error_description', 'type'].forEach((key) => query.delete(key));
  const queryString = query.toString();
  const cleanUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
  window.history.replaceState(window.history.state, document.title, cleanUrl);
}

export async function consumeCustomerEmailConfirmation(hash, search) {
  const { hashParams, searchParams } = callbackParams(hash, search);
  if (!isCustomerEmailConfirmationCallback(hash, search)) return null;

  const errorDescription = hashParams.get('error_description')
    || searchParams.get('error_description')
    || hashParams.get('error')
    || searchParams.get('error');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  clearCustomerEmailConfirmationUrl();

  if (errorDescription) {
    throw new Error(errorDescription.replace(/\+/g, ' '));
  }
  if (!accessToken || !refreshToken) return null;

  const userResponse = await authRequest('/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const user = userResponse && userResponse.user ? userResponse.user : userResponse;
  if (!user || !user.id) throw new Error('Email confirmation could not be verified. Please sign in again.');

  const expiresIn = Number(hashParams.get('expires_in')) || 3600;
  const expiresAt = Number(hashParams.get('expires_at')) || Math.floor(Date.now() / 1000) + expiresIn;
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: expiresAt,
    token_type: hashParams.get('token_type') || 'bearer',
    user,
  };
  storeSession(session, 'customer');
  return session;
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

export async function completeTemporaryPasswordChange(newPassword) {
  const session = await getFreshSession();
  await updatePasswordWithToken(session.access_token, newPassword);
  await dbRequest('/rpc/complete_staff_password_change', {
    method: 'POST',
    body: '{}',
  });
  setPasswordChangeRequired(false);
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
  const endpoint = process.env.REACT_APP_ADMIN_CREATE_URL
    || `${getConfig().url.replace(/\/$/, '')}/functions/v1/admin-create-user`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: getConfig().anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(admin),
  });
  return parseResponse(response);
}

export async function adminDeleteUser(profileId) {
  const session = await getFreshSession();
  const endpoint = process.env.REACT_APP_ADMIN_CREATE_URL
    || `${getConfig().url.replace(/\/$/, '')}/functions/v1/admin-create-user`;
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: getConfig().anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profileId }),
  });
  return parseResponse(response);
}

export async function adminDeleteCustomerAccount(customerId) {
  const session = await getFreshSession();
  const endpoint = process.env.REACT_APP_ADMIN_CREATE_URL
    || `${getConfig().url.replace(/\/$/, '')}/functions/v1/admin-create-user`;
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: getConfig().anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerId }),
  });
  return parseResponse(response);
}

export async function discardAuthSession(session) {
  const token = session && session.access_token;
  // Clear local auth first so the UI cannot remain on a protected screen while
  // the remote session revocation is slow or unavailable.
  clearStoredSession();
  sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  await revokeAccessToken(token);
}

export async function signOut() {
  return discardAuthSession(getStoredSession());
}
