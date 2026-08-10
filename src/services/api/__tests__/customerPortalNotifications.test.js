jest.mock('../../cloud/supabaseClient', () => ({
  adminDeleteCustomerAccount: jest.fn(),
  clearPendingCustomerProfile: jest.fn(),
  consumeCustomerEmailConfirmation: jest.fn(),
  dbRequest: jest.fn(),
  getPendingCustomerProfile: jest.fn(),
  getStoredSession: jest.fn(() => ({ user: { id: 'admin-user-1' } })),
  getStoredSessionType: jest.fn(() => null),
  isSupabaseConfigured: jest.fn(() => true),
  requestCustomerLinkEmailOtp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  signUpWithPassword: jest.fn(),
  storeSession: jest.fn(),
  storePendingCustomerProfile: jest.fn((profile) => profile),
  verifyCustomerLinkEmailOtp: jest.fn(),
}));

const {
  clearPendingCustomerProfile,
  consumeCustomerEmailConfirmation,
  dbRequest,
  getPendingCustomerProfile,
  getStoredSessionType,
  requestCustomerLinkEmailOtp,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  storeSession,
  storePendingCustomerProfile,
  verifyCustomerLinkEmailOtp,
} = require('../../cloud/supabaseClient');
const {
  completeCustomerProfile,
  finishCustomerEmailConfirmation,
  getAdminNotifications,
  getCustomerInvoices,
  getCustomerNotifications,
  registerCustomer,
  beginCustomerProfileCompletion,
  verifyCustomerLinkEmailAndCompleteProfile,
} = require('../customerPortalApi');

describe('notification API retention limits', () => {
  beforeEach(() => {
    dbRequest.mockReset();
    dbRequest.mockResolvedValue([]);
    signInWithPassword.mockReset();
    signOut.mockReset();
    signUpWithPassword.mockReset();
    storeSession.mockReset();
    storePendingCustomerProfile.mockReset();
    storePendingCustomerProfile.mockImplementation((profile) => profile);
    clearPendingCustomerProfile.mockReset();
    consumeCustomerEmailConfirmation.mockReset();
    getPendingCustomerProfile.mockReset();
    getStoredSessionType.mockReset();
    getStoredSessionType.mockReturnValue(null);
    requestCustomerLinkEmailOtp.mockReset();
    requestCustomerLinkEmailOtp.mockResolvedValue(true);
    verifyCustomerLinkEmailOtp.mockReset();
  });

  it('limits the customer inbox query to the newest 30 rows', async () => {
    await getCustomerNotifications();

    expect(dbRequest).toHaveBeenCalledWith(
      '/customer_notifications?audience=eq.customer&select=*&order=created_at.desc&limit=30',
    );
  });

  it('limits the admin inbox query to the newest 30 rows', async () => {
    await getAdminNotifications({ forceRefresh: true });

    expect(dbRequest).toHaveBeenCalledWith(
      '/customer_notifications?audience=eq.admin&select=*,customer_orders(quantity,bottle_type,items,customers(name))&order=created_at.desc&limit=30',
    );
  });

  it('excludes void invoices from the customer portal', async () => {
    await getCustomerInvoices();

    expect(dbRequest).toHaveBeenCalledWith(
      '/customer_invoices?payment_status=neq.void&select=*&order=invoice_date.desc',
    );
  });

  it('rejects a password-only session when an earlier Auth identity exists without a profile', async () => {
    signUpWithPassword.mockResolvedValue({
      user: {
        id: 'admin-user-1',
        identities: [],
      },
    });
    signInWithPassword.mockResolvedValue({ user: { id: 'admin-user-1' } });
    dbRequest.mockRejectedValueOnce(new Error('Password sessions cannot link customer history.'));

    await expect(registerCustomer({
      name: 'Ayesha Khan',
      email: 'AYESHA@example.com',
      phone: '+92 300 0000000',
      address: 'Sialkot',
      password: 'correct-password',
    })).rejects.toThrow('Password sessions cannot link');

    expect(signInWithPassword).toHaveBeenCalledWith(
      'ayesha@example.com',
      'correct-password',
      'customer',
    );
    expect(signOut).toHaveBeenCalled();
    expect(clearPendingCustomerProfile).toHaveBeenCalled();
  });

  it('keeps only non-secret profile details while email confirmation is pending', async () => {
    signUpWithPassword.mockResolvedValue({
      user: {
        id: 'new-auth-user',
        email: 'ayesha@example.com',
        identities: [{ id: 'email-identity' }],
        email_confirmed_at: null,
      },
      session: null,
    });

    const result = await registerCustomer({
      name: 'Ayesha Khan',
      email: 'AYESHA@example.com',
      phone: '+92 300 0000000',
      address: 'Sialkot',
      password: 'never-persist-this',
    });

    expect(result).toEqual({ confirmationRequired: true, email: 'ayesha@example.com' });
    expect(storePendingCustomerProfile).toHaveBeenCalledWith({
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      phone: '+92 300 0000000',
      address: 'Sialkot',
    });
    expect(JSON.stringify(storePendingCustomerProfile.mock.calls[0][0])).not.toContain('never-persist-this');
    expect(signUpWithPassword.mock.calls[0][2]).toContain('/customer/login?confirmation=1');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs the customer in and completes the profile when signup auto-confirms the email', async () => {
    // Confirm Email is disabled in Supabase Auth settings for this project,
    // so /signup returns an active session immediately instead of requiring
    // a confirmation-link click. Registration must succeed in that case
    // rather than reject the session as unsafe.
    const autoConfirmedSession = {
      access_token: 'auto-confirmed-access',
      refresh_token: 'auto-confirmed-refresh',
      user: { id: 'auto-confirmed-auth-user', email: 'ayesha@example.com' },
    };
    signUpWithPassword.mockResolvedValue({
      user: autoConfirmedSession.user,
      session: autoConfirmedSession,
    });
    dbRequest.mockImplementation(async (path) => {
      if (path === '/rpc/get_customer_link_requirement') {
        return [{ email_otp_required: false }];
      }
      if (path === '/rpc/claim_customer_account') {
        return [{
          id: 'new-customer-1',
          auth_user_id: 'auto-confirmed-auth-user',
          name: 'Ayesha Khan',
          email: 'ayesha@example.com',
          phone: '+923000000000',
          address: 'Sialkot',
          active: true,
        }];
      }
      return [];
    });

    const profile = await registerCustomer({
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      phone: '+92 300 0000000',
      address: 'Sialkot',
      password: 'a-strong-password',
    });

    expect(storeSession).toHaveBeenCalledWith(autoConfirmedSession, 'customer');
    expect(profile.id).toBe('new-customer-1');
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('clears the customer session if a profile claim fails', async () => {
    dbRequest.mockRejectedValueOnce(new Error('Profile claim failed'));

    await expect(completeCustomerProfile({
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      phone: '+92 300 0000000',
      address: 'Sialkot',
    })).rejects.toThrow('Profile claim failed');

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearPendingCustomerProfile).not.toHaveBeenCalled();
  });

  it('claims the pending profile after a verified email callback', async () => {
    const events = [];
    const session = { user: { id: 'auth-user', email: 'ayesha@example.com' } };
    const pending = {
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      phone: '+92 300 0000000',
      address: 'Sialkot',
    };
    consumeCustomerEmailConfirmation.mockImplementation(async () => {
      events.push('consume-callback');
      return session;
    });
    getPendingCustomerProfile.mockReturnValue(pending);
    dbRequest.mockImplementation(async (path) => {
      if (path === '/rpc/get_customer_link_requirement') {
        events.push('check-link-requirement');
        return [{ email_otp_required: false }];
      }
      if (path === '/rpc/claim_customer_account') {
        events.push('claim-profile');
        return [{
          id: 'manual-customer-1',
          auth_user_id: 'auth-user',
          ...pending,
          active: true,
        }];
      }
      return [];
    });

    const result = await finishCustomerEmailConfirmation('#type=signup', '?confirmation=1');

    expect(result).toEqual(expect.objectContaining({
      session,
      profile: expect.objectContaining({ id: 'manual-customer-1' }),
    }));
    expect(clearPendingCustomerProfile).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
    expect(events).toEqual([
      'consume-callback',
      'check-link-requirement',
      'claim-profile',
    ]);
  });

  it('requests email OTP only after the database finds an existing customer link', async () => {
    const events = [];
    dbRequest.mockImplementation(async (path) => {
      if (path === '/rpc/get_customer_link_requirement') {
        events.push('check-link-requirement');
        return [{ email_otp_required: true }];
      }
      return [];
    });
    requestCustomerLinkEmailOtp.mockImplementation(async () => { events.push('request-email-otp'); });

    const result = await beginCustomerProfileCompletion({
      name: 'Ayesha Khan',
      email: 'AYESHA@example.com',
      phone: '0300 123 4567',
      address: 'Sialkot',
    });

    expect(result).toEqual(expect.objectContaining({
      profile: null,
      emailOtpRequired: true,
      verificationSent: true,
    }));
    expect(requestCustomerLinkEmailOtp).toHaveBeenCalledWith('AYESHA@example.com');
    expect(events).toEqual(['check-link-requirement', 'request-email-otp']);
  });

  it('binds the verified email OTP before claiming the canonical customer row', async () => {
    const events = [];
    const row = {
      id: 'manual-customer-1',
      auth_user_id: 'auth-user',
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      phone: '+923001234567',
      address: 'Sialkot',
      active: true,
    };
    verifyCustomerLinkEmailOtp.mockImplementation(async () => { events.push('verify-email-otp'); });
    dbRequest.mockImplementation(async (path) => {
      if (path === '/rpc/attest_customer_link_email_otp') {
        events.push('bind-customer-session-proof');
        return true;
      }
      if (path === '/rpc/claim_customer_account') {
        events.push('claim-profile');
        return [row];
      }
      return [];
    });

    const profile = await verifyCustomerLinkEmailAndCompleteProfile({
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
    }, '123456');

    expect(profile.id).toBe('manual-customer-1');
    expect(events).toEqual(['verify-email-otp', 'bind-customer-session-proof', 'claim-profile']);
  });

  it('clears a stale customer session when an email callback is invalid', async () => {
    consumeCustomerEmailConfirmation.mockRejectedValue(new Error('Confirmation link expired'));
    getStoredSessionType.mockReturnValue('customer');

    await expect(
      finishCustomerEmailConfirmation('#type=signup&error=access_denied', '?confirmation=1')
    ).rejects.toThrow('Confirmation link expired');

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
