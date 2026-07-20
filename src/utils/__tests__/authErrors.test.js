import { mapLoginError } from '../authErrors';

describe('mapLoginError', () => {
  it('uses the concise invalid credentials message', () => {
    expect(mapLoginError({ status: 400, message: 'Invalid login credentials' })).toBe(
      'Incorrect username or password.'
    );
  });

  it('prioritizes the email confirmation message even when Supabase returns status 400', () => {
    expect(mapLoginError({ status: 400, message: 'Email not confirmed' })).toBe(
      'Please confirm your email address from the inbox before signing in.'
    );
  });

  it('does not expose a raw Supabase schema error to the user', () => {
    expect(mapLoginError({ status: 500, message: 'Database error querying schema' })).toBe(
      'Sign-in is temporarily unavailable while the account database is repaired.'
    );
  });
});
