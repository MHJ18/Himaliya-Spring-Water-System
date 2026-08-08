import { isWithinQuietHours, shouldNotify } from '../adminAlerts';

const at = (hours, minutes = 0) => new Date(2026, 7, 8, hours, minutes, 0);

const settings = {
  pushNotificationsEnabled: true,
  notifyNewOrders: true,
  notifyDeliveryUpdates: true,
  notifyPayments: true,
  notifyLowStock: true,
  notifyOverdueInvoices: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

describe('isWithinQuietHours', () => {
  it('is inactive when quiet hours are switched off', () => {
    expect(isWithinQuietHours({ ...settings }, at(2))).toBe(false);
  });

  it('covers a window that wraps past midnight', () => {
    const quiet = { ...settings, quietHoursEnabled: true };
    expect(isWithinQuietHours(quiet, at(23))).toBe(true);
    expect(isWithinQuietHours(quiet, at(2))).toBe(true);
    expect(isWithinQuietHours(quiet, at(6, 59))).toBe(true);
    expect(isWithinQuietHours(quiet, at(7))).toBe(false);
    expect(isWithinQuietHours(quiet, at(13))).toBe(false);
    expect(isWithinQuietHours(quiet, at(21, 59))).toBe(false);
  });

  it('covers a same-day window without wrapping', () => {
    const quiet = {
      ...settings, quietHoursEnabled: true, quietHoursStart: '09:00', quietHoursEnd: '17:00',
    };
    expect(isWithinQuietHours(quiet, at(8, 59))).toBe(false);
    expect(isWithinQuietHours(quiet, at(9))).toBe(true);
    expect(isWithinQuietHours(quiet, at(16, 59))).toBe(true);
    expect(isWithinQuietHours(quiet, at(17))).toBe(false);
  });

  it('ignores malformed or empty ranges rather than silencing everything', () => {
    const broken = { ...settings, quietHoursEnabled: true, quietHoursStart: 'nonsense' };
    expect(isWithinQuietHours(broken, at(2))).toBe(false);
    const equal = {
      ...settings, quietHoursEnabled: true, quietHoursStart: '08:00', quietHoursEnd: '08:00',
    };
    expect(isWithinQuietHours(equal, at(8))).toBe(false);
  });
});

describe('shouldNotify', () => {
  it('allows a mapped type when its own toggle is on', () => {
    expect(shouldNotify('order', settings, at(12))).toBe(true);
    expect(shouldNotify('invoice_overdue', settings, at(12))).toBe(true);
  });

  it('respects the per-event toggle', () => {
    expect(shouldNotify('order', { ...settings, notifyNewOrders: false }, at(12))).toBe(false);
    expect(shouldNotify('stock', { ...settings, notifyLowStock: false }, at(12))).toBe(false);
  });

  it('treats the master switch as overriding every event toggle', () => {
    const off = { ...settings, pushNotificationsEnabled: false };
    expect(shouldNotify('order', off, at(12))).toBe(false);
    expect(shouldNotify('payment', off, at(12))).toBe(false);
  });

  it('stays silent during quiet hours', () => {
    const quiet = { ...settings, quietHoursEnabled: true };
    expect(shouldNotify('order', quiet, at(23, 30))).toBe(false);
    expect(shouldNotify('order', quiet, at(12))).toBe(true);
  });

  it('does not notify for types that have no mapping', () => {
    expect(shouldNotify('message', settings, at(12))).toBe(false);
    expect(shouldNotify('something_new', settings, at(12))).toBe(false);
  });

  it('stays silent when there are no settings at all', () => {
    expect(shouldNotify('order', null, at(12))).toBe(false);
    expect(shouldNotify('order', undefined, at(12))).toBe(false);
  });

  // Matches the `!== false` convention used across the app (featureInvoices,
  // stickyHeader, ...): an absent key means "on", and DEFAULT_SETTINGS ships
  // every one of these as true. A partial object must not silently mute alerts.
  it('treats absent keys as enabled rather than disabled', () => {
    expect(shouldNotify('order', {}, at(12))).toBe(true);
    expect(shouldNotify('order', { notifyNewOrders: true }, at(12))).toBe(true);
  });
});
