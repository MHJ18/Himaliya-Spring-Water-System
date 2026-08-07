import React from 'react';

export const CUSTOMER_APPEARANCE_STORAGE_KEY = 'himaliya.customer.appearance';
export const CUSTOMER_DASHBOARD_STYLE_STORAGE_KEY = 'himaliya.customer.dashboard-style';

const customerAppearances = new Set(['light', 'dark', 'dark-gradient']);
const dashboardStyleOptions = {
  accent: new Set(['aqua', 'blue', 'violet', 'emerald']),
  header: new Set(['ocean', 'midnight', 'violet', 'emerald']),
  cards: new Set(['clean', 'tinted', 'glass']),
};
const defaultDashboardStyle = { accent: 'aqua', header: 'ocean', cards: 'clean' };

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

function normalizeDashboardStyle(value = {}) {
  return Object.keys(dashboardStyleOptions).reduce((result, key) => ({
    ...result,
    [key]: dashboardStyleOptions[key].has(value[key]) ? value[key] : defaultDashboardStyle[key],
  }), {});
}

function readStoredDashboardStyle() {
  if (typeof window === 'undefined') return defaultDashboardStyle;
  try {
    return normalizeDashboardStyle(JSON.parse(window.localStorage.getItem(CUSTOMER_DASHBOARD_STYLE_STORAGE_KEY) || '{}'));
  } catch {
    return defaultDashboardStyle;
  }
}

export default function useCustomerTheme(initialTheme = 'dark') {
  const [theme, setThemeState] = React.useState(() => readStoredAppearance(initialTheme));
  const [dashboardStyle, setDashboardStyleState] = React.useState(readStoredDashboardStyle);

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

  const setDashboardStyle = React.useCallback((nextStyle) => {
    setDashboardStyleState((current) => {
      const safeStyle = normalizeDashboardStyle({
        ...current,
        ...(typeof nextStyle === 'function' ? nextStyle(current) : nextStyle),
      });
      try {
        window.localStorage.setItem(CUSTOMER_DASHBOARD_STYLE_STORAGE_KEY, JSON.stringify(safeStyle));
      } catch {
        // Keep the style active for this visit when device storage is unavailable.
      }
      return safeStyle;
    });
  }, []);

  React.useEffect(() => {
    const syncAppearance = (event) => {
      if (event.key === CUSTOMER_APPEARANCE_STORAGE_KEY) {
        setThemeState(normalizeAppearance(event.newValue));
      }
      if (event.key === CUSTOMER_DASHBOARD_STYLE_STORAGE_KEY) {
        try {
          setDashboardStyleState(normalizeDashboardStyle(JSON.parse(event.newValue || '{}')));
        } catch {
          setDashboardStyleState(defaultDashboardStyle);
        }
      }
    };
    window.addEventListener('storage', syncAppearance);
    return () => window.removeEventListener('storage', syncAppearance);
  }, []);

  return {
    theme,
    setTheme,
    dashboardStyle,
    setDashboardStyle,
  };
}
