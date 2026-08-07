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
      .mockResolvedValueOnce(response([{ owner_id: 'owner-profile-id', role: 'Owner' }]))
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

  it('lets an owner delete a rider profile and its auth identity', async () => {
    global.fetch
      .mockResolvedValueOnce(response({ id: 'owner-auth-id' }))
      .mockResolvedValueOnce(response([{ owner_id: '00000000-0000-4000-8000-000000000001', role: 'Owner' }]))
      .mockResolvedValueOnce(response([{
        id: '00000000-0000-4000-8000-000000000002',
        auth_user_id: '00000000-0000-4000-8000-000000000003',
        name: 'Test Rider',
      }]))
      .mockResolvedValueOnce(response({}));

    const { handler } = require('../../../netlify/functions/admin-create-user');
    const result = await handler({
      httpMethod: 'DELETE',
      headers: {
        authorization: 'Bearer owner-session-token',
        'x-nf-client-connection-ip': '127.0.0.1',
      },
      body: JSON.stringify({ profileId: '00000000-0000-4000-8000-000000000002' }),
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(expect.objectContaining({ deleted: true, name: 'Test Rider' }));
    expect(global.fetch.mock.calls[3][0]).toContain(
      '/auth/v1/admin/users/00000000-0000-4000-8000-000000000003',
    );
    expect(global.fetch.mock.calls[3][1]).toEqual(expect.objectContaining({ method: 'DELETE' }));
  });

  it('deletes both a customer auth identity and its business profile', async () => {
    global.fetch
      .mockResolvedValueOnce(response({ id: 'admin-auth-id' }))
      .mockResolvedValueOnce(response([{
        owner_id: '00000000-0000-4000-8000-000000000001',
        role: 'Admin',
      }]))
      .mockResolvedValueOnce(response([{
        id: 'customer-123',
        auth_user_id: '00000000-0000-4000-8000-000000000009',
        name: 'Deleted Customer',
        email: 'customer@example.com',
      }]))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response([{ id: 'customer-123' }]));

    const { handler } = require('../../../netlify/functions/admin-create-user');
    const result = await handler({
      httpMethod: 'DELETE',
      headers: {
        authorization: 'Bearer admin-session-token',
        'x-nf-client-connection-ip': '127.0.0.2',
      },
      body: JSON.stringify({ customerId: 'customer-123' }),
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(expect.objectContaining({
      customerId: 'customer-123',
      authIdentityDeleted: true,
    }));
    expect(global.fetch.mock.calls[3][0]).toContain('/auth/v1/admin/users/');
    expect(global.fetch.mock.calls[4][0]).toContain('/rest/v1/customers?id=eq.customer-123');
    expect(global.fetch.mock.calls[4][1]).toEqual(expect.objectContaining({ method: 'DELETE' }));
  });
});
