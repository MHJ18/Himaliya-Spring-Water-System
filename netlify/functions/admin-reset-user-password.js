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
const MAX_ATTEMPTS = 5;

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
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw Object.assign(new Error((body && (body.message || body.msg)) || 'Supabase request failed.'), { status: response.status });
  return body;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' });
  if (Buffer.byteLength(event.body || '', 'utf8') > 4096) return json(413, { message: 'Request is too large.' });
  if (isRateLimited(clientAddress(event))) {
    return json(429, { message: 'Too many password reset attempts. Please wait 15 minutes and try again.' });
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json(503, { message: 'Secure password administration is not configured.' });

  const authorization = event.headers.authorization || event.headers.Authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) return json(401, { message: 'Authentication required.' });

  try {
    const caller = await supabaseRequest(supabaseUrl, serviceKey, '/auth/v1/user', { headers: { Authorization: authorization } });
    const payload = JSON.parse(event.body || '{}');
    const customerId = String(payload.customerId || '').trim();
    const password = String(payload.password || '');
    const ownerPassword = String(payload.ownerPassword || '');
    if (!customerId || password.length < 8 || !ownerPassword) return json(400, { message: 'Customer, owner password, and an 8-character temporary password are required.' });

    const admins = await supabaseRequest(supabaseUrl, serviceKey, `/rest/v1/admin_profiles?auth_user_id=eq.${encodeURIComponent(caller.id)}&active=eq.true&role=eq.Owner&select=owner_id&limit=1`);
    const ownerId = admins && admins[0] && admins[0].owner_id;
    if (!ownerId) return json(403, { message: 'Only an active owner can reset customer passwords.' });

    await supabaseRequest(supabaseUrl, serviceKey, '/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: caller.email, password: ownerPassword }),
    });

    const customers = await supabaseRequest(supabaseUrl, serviceKey, `/rest/v1/customers?id=eq.${encodeURIComponent(customerId)}&owner_id=eq.${encodeURIComponent(ownerId)}&auth_user_id=not.is.null&select=id,auth_user_id,name&limit=1`);
    const customer = customers && customers[0];
    if (!customer || !customer.auth_user_id) return json(404, { message: 'This customer does not have an app login.' });

    await supabaseRequest(supabaseUrl, serviceKey, `/auth/v1/admin/users/${encodeURIComponent(customer.auth_user_id)}`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
    return json(200, { success: true, customerName: customer.name });
  } catch (error) {
    if (error.status === 400 || error.status === 401) {
      return json(401, { message: 'Owner password is incorrect.' });
    }
    if (error.status === 403 || error.status === 404) {
      return json(error.status, { message: error.message });
    }
    return json(500, { message: 'Password reset failed. Please try again.' });
  }
};
