const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedRoles = new Set(['Admin', 'Manager', 'Owner']);
const attempts = new Map<string, { count: number; resetAt: number }>();
const windowMs = 15 * 60 * 1000;
const maxAttempts = 10;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
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
  if (request.method !== 'POST') return json(405, { message: 'Method not allowed.' });

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
    const payload = await request.json() as { name?: string; email?: string; password?: string; role?: string };
    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const role = String(payload.role || 'Admin');
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return json(400, { message: 'Name, a valid email, and a password with at least 8 characters are required.' });
    }
    if (!allowedRoles.has(role)) return json(400, { message: 'Select a valid administrator role.' });

    const callerProfiles = await supabaseRequest(url, key, `/rest/v1/admin_profiles?auth_user_id=eq.${encodeURIComponent(caller.id || '')}&active=eq.true&role=eq.Owner&select=owner_id&limit=1`) as Array<{ owner_id?: string }>;
    const ownerId = callerProfiles?.[0]?.owner_id;
    if (!ownerId) return json(403, { message: 'Only an active owner can create administrator accounts.' });

    const customerMatches = await supabaseRequest(url, key, `/rest/v1/customers?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`) as unknown[];
    if (customerMatches?.length) return json(409, { message: 'This email belongs to a customer account and cannot be granted administrator access.' });
    const adminMatches = await supabaseRequest(url, key, `/rest/v1/admin_profiles?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`) as unknown[];
    if (adminMatches?.length) return json(409, { message: 'An administrator already uses this email address.' });

    const created = await supabaseRequest(url, key, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { account_type: 'admin' } }),
    }) as { id?: string; user?: { id?: string } };
    createdUserId = created?.id || created?.user?.id || '';
    if (!createdUserId) throw new Error('Supabase did not return the new administrator identity.');

    const profiles = await supabaseRequest(url, key, '/rest/v1/admin_profiles?select=id,auth_user_id,name,email,role,active,created_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ owner_id: ownerId, auth_user_id: createdUserId, name, email, role, active: true }),
    }) as Array<Record<string, unknown>>;
    const profile = profiles?.[0];
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
