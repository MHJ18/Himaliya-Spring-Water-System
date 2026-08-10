import { normalizeNotificationUrl } from '../pushNotifications';

describe('normalizeNotificationUrl', () => {
  const origin = 'https://app.example.com';

  it('keeps same-origin paths, queries, and fragments', () => {
    expect(normalizeNotificationUrl('/customer/app?tab=orders#latest', origin))
      .toBe('/customer/app?tab=orders#latest');
  });

  it('rejects external and executable notification targets', () => {
    expect(normalizeNotificationUrl('https://attacker.example/phish', origin)).toBe('/');
    expect(normalizeNotificationUrl('//attacker.example/phish', origin)).toBe('/');
    expect(normalizeNotificationUrl('javascript:alert(1)', origin)).toBe('/');
  });

  it('falls back safely for malformed values', () => {
    expect(normalizeNotificationUrl('https://[invalid', origin)).toBe('/');
  });
});
