const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: () => Promise.resolve(JSON.stringify(body)),
});

describe('admin-create-user function', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    jest.resetModules();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    delete global.fetch;
  });

  it('rejects a customer email before creating an administrator auth user', async () => {
    global.fetch
      .mockResolvedValueOnce(response({ id: 'owner-auth-id' }))
      .mockResolvedValueOnce(response([{ owner_id: 'owner-profile-id' }]))
      .mockResolvedValueOnce(response([{ id: 'customer-id' }]));

    const { handler } = require('../../../netlify/functions/admin-create-user');
    const result = await handler({
      httpMethod: 'POST',
      headers: {
        authorization: 'Bearer owner-session-token',
        'x-nf-client-connection-ip': '127.0.0.1',
      },
      body: JSON.stringify({
        name: 'Existing Customer',
        email: 'customer@example.com',
        password: 'temporary-password',
        role: 'Admin',
      }),
    });

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).message).toMatch(/belongs to a customer account/i);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls.some(([url]) => url.includes('/auth/v1/admin/users'))).toBe(false);
  });
});
