import React from 'react';

const STORAGE_KEY = 'himaliya-customer-theme';

export default function useCustomerTheme() {
  const [theme, setThemeState] = React.useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'light' ? 'light' : 'dark';
  });

  const setTheme = React.useCallback((nextTheme) => {
    const safeTheme = nextTheme === 'light' ? 'light' : 'dark';
    document.documentElement.classList.add('theme-transitioning');
    window.localStorage.setItem(STORAGE_KEY, safeTheme);
    setThemeState(safeTheme);
    window.setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
  }, []);

  return { theme, setTheme };
}
