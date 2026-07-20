const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
  },
  body: JSON.stringify(body),
});

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const ALLOWED_ROLES = new Set(['Admin', 'Manager', 'Owner']);

const clientAddress = (event) => (
  event.headers['x-nf-client-connection-ip']
  || String(event.headers['x-forwarded-for'] || '').split(',')[0].trim()
  || 'unknown'
);

const isRateLimited = (key) => {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  attempts.set(key, current);
  return current.count > MAX_ATTEMPTS;
};

async function supabaseRequest(url, serviceKey, path, options = {}) {
  const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body && (body.message || body.msg || body.error_description || body.error);
    throw Object.assign(new Error(message || 'Supabase request failed.'), {
      status: response.status,
      code: body && (body.code || body.error_code),
    });
  }
  return body;
}

async function deleteAuthUser(url, serviceKey, userId) {
  if (!userId) return;
  try {
    await supabaseRequest(
      url,
      serviceKey,
      `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
  } catch {
    // The primary error is returned to the caller; cleanup is best effort.
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' });
  if (Buffer.byteLength(event.body || '', 'utf8') > 8192) {
    return json(413, { message: 'Request is too large.' });
  }
  if (isRateLimited(clientAddress(event))) {
    return json(429, { message: 'Too many administrator creation attempts. Please wait and try again.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json(503, { message: 'Secure administrator management is not configured.' });
  }

  const authorization = event.headers.authorization || event.headers.Authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return json(401, { message: 'Authentication required.' });
  }

  let createdAuthUserId = '';
  try {
    const caller = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      '/auth/v1/user',
      { headers: { Authorization: authorization } },
    );
    const payload = JSON.parse(event.body || '{}');
    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const role = String(payload.role || 'Admin');

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return json(400, {
        message: 'Name, a valid email, and a password with at least 8 characters are required.',
      });
    }
    if (!ALLOWED_ROLES.has(role)) {
      return json(400, { message: 'Select a valid administrator role.' });
    }

    const callerProfiles = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      `/rest/v1/admin_profiles?auth_user_id=eq.${encodeURIComponent(caller.id)}&active=eq.true&role=eq.Owner&select=owner_id&limit=1`,
    );
    const ownerId = callerProfiles && callerProfiles[0] && callerProfiles[0].owner_id;
    if (!ownerId) {
      return json(403, { message: 'Only an active owner can create administrator accounts.' });
    }

    const customerMatches = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      `/rest/v1/customers?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`,
    );
    if (customerMatches && customerMatches.length) {
      return json(409, {
        message: 'This email belongs to a customer account and cannot be granted administrator access.',
      });
    }

    const adminMatches = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      `/rest/v1/admin_profiles?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`,
    );
    if (adminMatches && adminMatches.length) {
      return json(409, { message: 'An administrator already uses this email address.' });
    }

    const createdAuthUser = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      '/auth/v1/admin/users',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          app_metadata: { account_type: 'admin' },
        }),
      },
    );
    createdAuthUserId = (createdAuthUser && createdAuthUser.id)
      || (createdAuthUser && createdAuthUser.user && createdAuthUser.user.id)
      || '';
    if (!createdAuthUserId) throw new Error('Supabase did not return the new administrator identity.');

    const profiles = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      '/rest/v1/admin_profiles?select=id,auth_user_id,name,email,role,active,created_at',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          owner_id: ownerId,
          auth_user_id: createdAuthUserId,
          name,
          email,
          role,
          active: true,
        }),
      },
    );
    const profile = profiles && profiles[0];
    if (!profile) throw new Error('The administrator profile could not be created.');

    return json(201, {
      admin: {
        id: profile.id,
        authUserId: profile.auth_user_id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        active: profile.active !== false,
        createdAt: profile.created_at,
      },
    });
  } catch (error) {
    if (createdAuthUserId) await deleteAuthUser(supabaseUrl, serviceKey, createdAuthUserId);
    if ([400, 409, 422].includes(error.status)) {
      return json(409, {
        message: /already|registered|exists|duplicate/i.test(error.message || '')
          ? 'This email is already registered and cannot be reused for administrator access.'
          : error.message,
      });
    }
    if (error.status === 401 || error.status === 403) {
      return json(error.status, { message: 'Your owner session is not authorized for this action.' });
    }
    return json(500, {
      message: error.message === 'Supabase did not return the new administrator identity.'
        ? error.message
        : 'Administrator creation failed. No dashboard access was granted.',
    });
  }
};
