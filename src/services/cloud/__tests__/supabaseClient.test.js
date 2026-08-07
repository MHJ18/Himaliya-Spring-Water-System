describe('Supabase session expiry', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    process.env.REACT_APP_SUPABASE_URL = 'https://example.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'publishable-test-key';
  });

  it('notifies the app and returns a readable error when no refresh session exists', async () => {
    const {
      consumeSessionExpiredNotice,
      dbRequest,
      getSessionExpiredEventName,
      hasSessionExpiredNotice,
    } = require('../supabaseClient');
    const handler = jest.fn();
    window.addEventListener(getSessionExpiredEventName(), handler);

    await expect(dbRequest('/customers?select=*')).rejects.toThrow(
      'Your session has expired. Please sign in again.'
    );
    expect(handler).toHaveBeenCalledTimes(1);
    expect(hasSessionExpiredNotice()).toBe(true);
    expect(consumeSessionExpiredNotice()).toBe(true);
    expect(hasSessionExpiredNotice()).toBe(false);

    window.removeEventListener(getSessionExpiredEventName(), handler);
  });

  it('converts an HTML hosting fallback into an actionable admin service error', async () => {
    localStorage.setItem('hs_supabase_session', JSON.stringify({
      access_token: 'owner-token',
      refresh_token: 'owner-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }));
    localStorage.setItem('hs_supabase_session_type', 'admin');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('<!doctype html><html><body>Not Found</body></html>'),
    });

    const { adminCreateUser } = require('../supabaseClient');
    await expect(adminCreateUser({
      name: 'New Admin',
      email: 'admin@example.com',
      password: 'temporary-password',
      role: 'Admin',
    })).rejects.toThrow('Administrator service is unavailable on this deployment');
    delete global.fetch;
  });

  it('stores and clears the temporary-password requirement with the session', () => {
    const {
      clearStoredSession,
      isPasswordChangeRequired,
      setPasswordChangeRequired,
    } = require('../supabaseClient');

    expect(isPasswordChangeRequired()).toBe(false);
    setPasswordChangeRequired(true);
    expect(isPasswordChangeRequired()).toBe(true);
    clearStoredSession();
    expect(isPasswordChangeRequired()).toBe(false);
  });

  it('passes an allow-listed callback to signup and normalizes a pending user response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({
        id: 'new-user',
        email: 'customer@example.com',
        identities: [{ id: 'email-identity' }],
        email_confirmed_at: null,
      })),
    });
    const { signUpWithPassword } = require('../supabaseClient');

    const result = await signUpWithPassword(
      'customer@example.com',
      'strong-password',
      'https://app.example.com/customer/login?confirmation=1',
    );

    expect(global.fetch.mock.calls[0][0]).toBe(
      'https://example.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Fapp.example.com%2Fcustomer%2Flogin%3Fconfirmation%3D1'
    );
    expect(result).toEqual(expect.objectContaining({
      user: expect.objectContaining({ id: 'new-user' }),
      session: null,
    }));
    delete global.fetch;
  });

  it('preflights the public Auth settings before customer signup', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ mailer_autoconfirm: false })),
    });
    const { ensureEmailConfirmationEnabled } = require('../supabaseClient');

    await expect(ensureEmailConfirmationEnabled()).resolves.toBe(true);
    expect(global.fetch.mock.calls[0][0]).toBe('https://example.supabase.co/auth/v1/settings');
    delete global.fetch;
  });

  it('fails closed when Auth settings enable auto-confirm or omit the current field', async () => {
    const { ensureEmailConfirmationEnabled } = require('../supabaseClient');
    for (const settings of [{ mailer_autoconfirm: true }, { autoconfirm: false }]) {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(settings)),
      });
      // eslint-disable-next-line no-await-in-loop
      await expect(ensureEmailConfirmationEnabled()).rejects.toThrow('Enable Confirm Email');
    }
    delete global.fetch;
  });

  it('requires a real SMS provider and non-auto-confirming phone Auth', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({
        external: { phone: true },
        phone_autoconfirm: false,
        sms_provider: 'twilio',
      })),
    });
    const { ensurePhoneVerificationEnabled } = require('../supabaseClient');

    await expect(ensurePhoneVerificationEnabled()).resolves.toBe(true);
    delete global.fetch;
  });

  it('rejects a phone OTP result for a different Auth user and revokes both sessions', async () => {
    const responses = [
      {
        access_token: 'wrong-access',
        refresh_token: 'wrong-refresh',
        user: { id: 'wrong-auth-user' },
      },
      {
        id: 'wrong-auth-user',
        phone: '+923001234567',
        phone_confirmed_at: '2026-08-07T18:00:00Z',
      },
      {},
      {},
    ];
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(responses.shift())),
    }));
    const {
      getStoredSession,
      storeSession,
      verifyPhoneChangeOtp,
    } = require('../supabaseClient');
    storeSession({
      access_token: 'original-access',
      refresh_token: 'original-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'original-auth-user', email: 'customer@example.com' },
    }, 'customer');

    await expect(
      verifyPhoneChangeOtp('+923001234567', '123456')
    ).rejects.toThrow('different Auth identity');

    const logoutTokens = global.fetch.mock.calls
      .filter(([url]) => url.endsWith('/logout'))
      .map(([, options]) => options.headers.Authorization);
    expect(logoutTokens).toEqual(['Bearer wrong-access', 'Bearer original-access']);
    expect(getStoredSession()).toBeNull();
    delete global.fetch;
  });

  it('stores pending customer details without persisting the password', () => {
    const {
      getPendingCustomerProfile,
      storePendingCustomerProfile,
    } = require('../supabaseClient');

    storePendingCustomerProfile({
      name: 'Ayesha Khan',
      email: ' AYESHA@example.com ',
      phone: '+92 300 0000000',
      address: 'Sialkot',
      password: 'must-not-be-stored',
    });

    const stored = getPendingCustomerProfile();
    expect(stored).toEqual(expect.objectContaining({
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      phone: '+92 300 0000000',
      address: 'Sialkot',
    }));
    expect(stored).not.toHaveProperty('password');
    expect(localStorage.getItem('hs_pending_customer_profile')).not.toContain('must-not-be-stored');
  });

  it('turns a verified signup callback into a customer session and removes tokens from the URL', async () => {
    window.history.replaceState({}, '', '/customer/login?confirmation=1#access_token=verified-access&refresh_token=verified-refresh&type=signup&expires_in=3600');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ id: 'customer-auth', email: 'customer@example.com' })),
    });
    const {
      consumeCustomerEmailConfirmation,
      getStoredSession,
      getStoredSessionType,
    } = require('../supabaseClient');

    const session = await consumeCustomerEmailConfirmation(window.location.hash, window.location.search);

    expect(session).toEqual(expect.objectContaining({
      access_token: 'verified-access',
      refresh_token: 'verified-refresh',
      user: expect.objectContaining({ id: 'customer-auth' }),
    }));
    expect(getStoredSession()).toEqual(session);
    expect(getStoredSessionType()).toBe('customer');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer verified-access');
    delete global.fetch;
  });
});
