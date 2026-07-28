import React from 'react';

export const CUSTOMER_APPEARANCE_STORAGE_KEY = 'himaliya.customer.appearance';

const customerAppearances = new Set(['light', 'dark', 'dark-gradient']);

function normalizeAppearance(value, fallback = 'dark') {
  return customerAppearances.has(value) ? value : fallback;
}

function readStoredAppearance(fallback) {
  if (typeof window === 'undefined') return normalizeAppearance(fallback);
  try {
    return normalizeAppearance(window.localStorage.getItem(CUSTOMER_APPEARANCE_STORAGE_KEY), normalizeAppearance(fallback));
  } catch {
    return normalizeAppearance(fallback);
  }
}

export default function useCustomerTheme(initialTheme = 'dark') {
  const [theme, setThemeState] = React.useState(() => readStoredAppearance(initialTheme));

  const setTheme = React.useCallback((nextTheme) => {
    const safeTheme = normalizeAppearance(nextTheme);
    document.documentElement.classList.add('theme-transitioning');
    setThemeState(safeTheme);
    try {
      window.localStorage.setItem(CUSTOMER_APPEARANCE_STORAGE_KEY, safeTheme);
    } catch {
      // Keep the appearance active for this visit when device storage is unavailable.
    }
    window.setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
  }, []);

  React.useEffect(() => {
    const syncAppearance = (event) => {
      if (event.key === CUSTOMER_APPEARANCE_STORAGE_KEY) {
        setThemeState(normalizeAppearance(event.newValue));
      }
    };
    window.addEventListener('storage', syncAppearance);
    return () => window.removeEventListener('storage', syncAppearance);
  }, []);

  return { theme, setTheme };
}
