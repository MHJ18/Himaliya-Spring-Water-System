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
});
