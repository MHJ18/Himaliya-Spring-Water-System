import React from 'react';

export default function useCustomerTheme(initialTheme = 'dark') {
  const [theme, setThemeState] = React.useState(initialTheme === 'light' ? 'light' : 'dark');

  const setTheme = React.useCallback((nextTheme) => {
    const safeTheme = nextTheme === 'light' ? 'light' : 'dark';
    document.documentElement.classList.add('theme-transitioning');
    setThemeState(safeTheme);
    window.setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
  }, []);

  return { theme, setTheme };
}
