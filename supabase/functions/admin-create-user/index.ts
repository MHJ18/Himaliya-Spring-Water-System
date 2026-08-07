const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

const allowedRoles = new Set(['Admin', 'Manager', 'Owner', 'Rider']);
const attempts = new Map<string, { count: number; resetAt: number }>();
const windowMs = 15 * 60 * 1000;
const maxAttempts = 10;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function normalizeRole(value: unknown) {
  const requested = String(value || '').trim().toLowerCase();
  return Array.from(allowedRoles).find((role) => role.toLowerCase() === requested) || '';
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > maxAttempts;
}

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '';
  } catch {
    return '';
  }
}

async function supabaseRequest(url: string, key: string, path: string, options: RequestInit = {}) {
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
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = new Error(String(body?.message || body?.msg || body?.error_description || body?.error || 'Supabase request failed.')) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}

async function deleteAuthUser(url: string, key: string, userId: string) {
  try {
    await supabaseRequest(url, key, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  } catch {
    // Keep the original creation failure as the response.
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['POST', 'DELETE'].includes(request.method)) return json(405, { message: 'Method not allowed.' });

  const clientKey = request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(clientKey)) return json(429, { message: 'Too many administrator creation attempts. Please wait and try again.' });

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = serviceKey();
  if (!url || !key) return json(503, { message: 'Secure administrator management is not configured.' });

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json(401, { message: 'Authentication required.' });

  let createdUserId = '';
  try {
    const caller = await supabaseRequest(url, key, '/auth/v1/user', { headers: { Authorization: authorization } }) as { id?: string };
    const callerProfiles = await supabaseRequest(url, key, `/rest/v1/admin_profiles?auth_user_id=eq.${encodeURIComponent(caller.id || '')}&active=eq.true&must_change_password=eq.false&select=owner_id,role&limit=1`) as Array<{ owner_id?: string; role?: string }>;
    const callerProfile = callerProfiles?.[0];
    const ownerId = callerProfile?.owner_id;
    const callerRole = callerProfile?.role;
    if (!ownerId) return json(403, { message: 'Your administrator account is not authorized for this action.' });

    if (request.method === 'DELETE') {
      const payload = await request.json() as { profileId?: string; customerId?: string };
      const customerId = String(payload.customerId || '').trim();
      if (customerId) {
        if (callerRole === 'Rider') return json(403, { message: 'Rider accounts cannot remove customer accounts.' });
        if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(customerId)) {
          return json(400, { message: 'Select a valid customer account.' });
        }
        const customerMatches = await supabaseRequest(
          url,
          key,
          `/rest/v1/customers?id=eq.${encodeURIComponent(customerId)}&owner_id=eq.${encodeURIComponent(ownerId)}&select=id,auth_user_id,name,email&limit=1`,
        ) as Array<{ id?: string; auth_user_id?: string; name?: string; email?: string }>;
        const customer = customerMatches?.[0];
        if (!customer?.id) return json(404, { message: 'Customer account not found.' });

        if (customer.auth_user_id) {
          await supabaseRequest(
            url,
            key,
            `/auth/v1/admin/users/${encodeURIComponent(customer.auth_user_id)}`,
            { method: 'DELETE' },
          );
        }
        const deletedProfiles = await supabaseRequest(
          url,
          key,
          `/rest/v1/customers?id=eq.${encodeURIComponent(customer.id)}&owner_id=eq.${encodeURIComponent(ownerId)}&select=id`,
          { method: 'DELETE', headers: { Prefer: 'return=representation' } },
        ) as unknown[];
        if (!deletedProfiles || deletedProfiles.length !== 1) {
          throw new Error('Customer profile could not be removed after deleting its login identity.');
        }
        return json(200, {
          deleted: true,
          customerId: customer.id,
          name: customer.name || 'Customer',
          email: customer.email || '',
          authIdentityDeleted: Boolean(customer.auth_user_id),
        });
      }

      if (callerRole !== 'Owner') return json(403, { message: 'Only an active owner can manage team accounts.' });
      const profileId = String(payload.profileId || '').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(profileId)) {
        return json(400, { message: 'Select a valid rider account.' });
      }
      const targets = await supabaseRequest(
        url,
        key,
        `/rest/v1/admin_profiles?id=eq.${encodeURIComponent(profileId)}&owner_id=eq.${encodeURIComponent(ownerId)}&role=eq.Rider&select=id,auth_user_id,name&limit=1`,
      ) as Array<{ id?: string; auth_user_id?: string; name?: string }>;
      const target = targets?.[0];
      if (!target?.auth_user_id) return json(404, { message: 'Rider account not found.' });
      await supabaseRequest(url, key, `/auth/v1/admin/users/${encodeURIComponent(target.auth_user_id)}`, { method: 'DELETE' });
      return json(200, { deleted: true, profileId: target.id, name: target.name || 'Rider' });
    }

    if (callerRole !== 'Owner') return json(403, { message: 'Only an active owner can manage team accounts.' });

    const payload = await request.json() as { name?: string; email?: string; password?: string; role?: string; phone?: string };
    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const role = normalizeRole(payload.role || 'Admin');
    const phone = String(payload.phone || '').trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return json(400, { message: 'Name, a valid email, and a password with at least 8 characters are required.' });
    }
    if (!allowedRoles.has(role)) return json(400, { message: 'Select a valid team role.' });

    const customerMatches = await supabaseRequest(url, key, `/rest/v1/customers?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`) as unknown[];
    if (customerMatches?.length) return json(409, { message: 'This email belongs to a customer account and cannot be granted administrator access.' });
    const adminMatches = await supabaseRequest(url, key, `/rest/v1/admin_profiles?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`) as unknown[];
    if (adminMatches?.length) return json(409, { message: 'An administrator already uses this email address.' });

    const created = await supabaseRequest(url, key, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { account_type: role === 'Rider' ? 'rider' : 'admin' } }),
    }) as { id?: string; user?: { id?: string } };
    createdUserId = created?.id || created?.user?.id || '';
    if (!createdUserId) throw new Error('Supabase did not return the new administrator identity.');

    const profiles = await supabaseRequest(url, key, '/rest/v1/admin_profiles?select=id,auth_user_id,name,email,phone,role,active,must_change_password,created_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        owner_id: ownerId,
        auth_user_id: createdUserId,
        name,
        email,
        phone,
        role,
        active: true,
        must_change_password: true,
      }),
    }) as Array<Record<string, unknown>>;
    const profile = profiles?.[0];
    if (!profile) throw new Error('The administrator profile could not be created.');

    return json(201, {
      admin: {
        id: profile.id,
        authUserId: profile.auth_user_id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        active: profile.active !== false,
        mustChangePassword: profile.must_change_password === true,
        createdAt: profile.created_at,
      },
    });
  } catch (error) {
    if (createdUserId) await deleteAuthUser(url, key, createdUserId);
    const status = (error as Error & { status?: number }).status;
    if (/email not confirmed|confirmation/i.test(String((error as Error).message || ''))) {
      return json(409, { message: 'Please confirm the owner email address from the inbox before creating administrator accounts.' });
    }
    if ([400, 409, 422].includes(status || 0)) return json(409, { message: 'This email is already registered and cannot be reused for administrator access.' });
    if (status === 401 || status === 403) return json(status, { message: 'Your owner session is not authorized for this action.' });
    return json(500, { message: 'Administrator creation failed. No dashboard access was granted.' });
  }
});
