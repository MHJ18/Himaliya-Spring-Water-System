jest.mock('../../cloud/supabaseClient', () => ({
  adminDeleteCustomerAccount: jest.fn(),
  dbRequest: jest.fn(),
  getStoredSession: jest.fn(() => ({ user: { id: 'auth-customer-1' } })),
  isSupabaseConfigured: jest.fn(() => true),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  signUpWithPassword: jest.fn(),
  storeSession: jest.fn(),
}));

const { dbRequest } = require('../../cloud/supabaseClient');
const { saveCustomerProfile } = require('../customerPortalApi');

describe('customer account linking request', () => {
  beforeEach(() => dbRequest.mockReset());

  it('sends the same canonical phone format used for manual customers', async () => {
    dbRequest.mockResolvedValueOnce([{
      id: 'manual-customer-1',
      auth_user_id: 'auth-customer-1',
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      phone: '+923001234567',
      address: 'Sialkot Cantt',
      active: true,
    }]);

    const profile = await saveCustomerProfile({
      name: 'Ayesha Khan',
      email: '  AYESHA@example.com ',
      phone: '0300 123 4567',
      address: 'Sialkot Cantt',
    });

    expect(profile.id).toBe('manual-customer-1');
    expect(dbRequest).toHaveBeenCalledWith('/rpc/claim_customer_account', expect.objectContaining({
      method: 'POST',
    }));
    const body = JSON.parse(dbRequest.mock.calls[0][1].body);
    expect(body).toMatchObject({
      p_email: 'ayesha@example.com',
      p_phone: '+923001234567',
    });
  });
});
