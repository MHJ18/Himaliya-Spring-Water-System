describe('cloud customer records', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('does not return administrator identities as customer records', async () => {
    const dbRequest = jest.fn((path) => {
      if (path.startsWith('/customers?')) {
        return Promise.resolve([
          { id: 'customer-1', name: 'Customer', email: 'customer@example.com', auth_user_id: 'customer-auth', source: 'portal' },
          { id: 'admin-1', name: 'Admin', email: 'admin@example.com', auth_user_id: 'admin-auth', source: 'admin' },
        ]);
      }
      if (path.startsWith('/admin_profiles?')) {
        return Promise.resolve([{ auth_user_id: 'admin-auth', email: 'admin@example.com' }]);
      }
      return Promise.resolve([]);
    });
    jest.doMock('../supabaseClient', () => ({
      dbRequest,
      isSupabaseConfigured: () => true,
    }));

    const { getCloudCustomers } = require('../himalayaDb');
    await expect(getCloudCustomers()).resolves.toEqual([
      expect.objectContaining({ id: 'customer-1', name: 'Customer' }),
    ]);
  });
});
