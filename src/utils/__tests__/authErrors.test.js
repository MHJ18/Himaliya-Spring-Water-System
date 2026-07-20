import { mapLoginError } from '../authErrors';

describe('mapLoginError', () => {
  it('uses the concise invalid credentials message', () => {
    expect(mapLoginError({ status: 400, message: 'Invalid login credentials' })).toBe(
      'Incorrect username or password.'
    );
  });

  it('does not expose a raw Supabase schema error to the user', () => {
    expect(mapLoginError({ status: 500, message: 'Database error querying schema' })).toBe(
      'Sign-in is temporarily unavailable while the account database is repaired.'
    );
  });
});
