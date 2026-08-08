import { DEFAULT_SETTINGS } from '../data/constants';

/* Currency and date formatting were hard-coded to en-PK/PKR. They now follow
 * the regional settings, but formatters are called from plain functions all
 * over the app (not just React components), so the active values are cached
 * here and refreshed by the SettingsProvider rather than read from context. */
let activeLocale = DEFAULT_SETTINGS.regionLocale;
let activeCurrency = DEFAULT_SETTINGS.currencyCode;

export function setRegionalFormat({ regionLocale, currencyCode } = {}) {
  if (regionLocale) activeLocale = regionLocale;
  if (currencyCode) activeCurrency = currencyCode;
}

export function getRegionalFormat() {
  return { regionLocale: activeLocale, currencyCode: activeCurrency };
}

export function formatCurrency(amount) {
  try {
    return new Intl.NumberFormat(activeLocale, {
      style: 'currency',
      currency: activeCurrency,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    // An unsupported locale or currency code must not blank out a total.
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  try {
    return new Date(dateStr).toLocaleDateString(activeLocale, options);
  } catch {
    return new Date(dateStr).toLocaleDateString('en-PK', options);
  }
}

export function getInitials(name) {
  return (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}
