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

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0092')) return digits.slice(2);
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits.length === 10 ? `92${digits}` : digits;
};

async function request(url, key, path, options = {}) {
  const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const error = new Error((body && (body.message || body.msg || body.error_description)) || 'Authentication failed.');
    error.status = response.status;
    throw error;
  }
  return body;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' });
  if (Buffer.byteLength(event.body || '', 'utf8') > 4096) {
    return json(413, { message: 'Request is too large.' });
  }
  if (isRateLimited(clientAddress(event))) {
    return json(429, { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !authKey) {
    return json(503, { message: 'Phone sign-in is not configured.' });
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const phone = normalizePhone(payload.phone);
    const password = String(payload.password || '');
    if (phone.length < 11 || password.length < 1) {
      return json(401, { message: 'Incorrect phone number or password.' });
    }

    const customers = await request(
      supabaseUrl,
      serviceKey,
      '/rest/v1/customers?auth_user_id=not.is.null&phone=not.is.null&select=auth_user_id,phone&limit=1000',
    );
    const customer = (customers || []).find((row) => normalizePhone(row.phone) === phone);
    if (!customer || !customer.auth_user_id) {
      return json(401, { message: 'Incorrect phone number or password.' });
    }

    const authUser = await request(
      supabaseUrl,
      serviceKey,
      `/auth/v1/admin/users/${encodeURIComponent(customer.auth_user_id)}`,
    );
    if (!authUser || !authUser.email) {
      return json(401, { message: 'Incorrect phone number or password.' });
    }

    const session = await request(supabaseUrl, authKey, '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authKey}` },
      body: JSON.stringify({ email: authUser.email, password }),
    });
    return json(200, session);
  } catch (error) {
    if (error.status === 400 || error.status === 401) {
      return json(401, { message: 'Incorrect phone number or password.' });
    }
    return json(500, { message: 'Could not sign in right now. Please try again.' });
  }
};
