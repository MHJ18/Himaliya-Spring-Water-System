const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

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
    return json(error.status === 400 || error.status === 401 ? 401 : 500, { message: error.status === 400 ? 'Owner password is incorrect.' : error.message || 'Password reset failed.' });
  }
};
