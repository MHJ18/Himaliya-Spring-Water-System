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
});
