import { mapLoginError } from '../authErrors';

describe('mapLoginError', () => {
  it('uses the concise invalid credentials message', () => {
    expect(mapLoginError({ status: 400, message: 'Invalid login credentials' })).toBe(
      'Incorrect username or password.'
    );
  });
});
