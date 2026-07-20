import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
} from 'react';
import { DEFAULT_SETTINGS } from '../data/constants';
import { settingsApi } from '../services/api/settingsApi';
import { getSessionReadyEventName, hasStoredSessionType } from '../services/cloud/supabaseClient';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadSettings = () => {
      if (!hasStoredSessionType('admin')) return;
      settingsApi.get().then((data) => setSettings(data)).catch(() => {});
    };
    loadSettings();
    window.addEventListener(getSessionReadyEventName(), loadSettings);
    return () => window.removeEventListener(getSessionReadyEventName(), loadSettings);
  }, []);

  useEffect(() => {
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = settings.themeMode === 'system' ? systemDark : settings.themeMode === 'dark' || settings.darkMode;
    document.body.classList.toggle('dashboard-dark', isDark);
    document.body.classList.toggle('dashboard-light', !isDark);
    document.body.classList.toggle('dashboard-compact', Boolean(settings.compactMode));
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
    document.documentElement.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [settings]);

  const toggleDarkMode = useCallback(() => {
    document.documentElement.classList.add('theme-transitioning');
    window.setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 500);
    setSettings((prev) => {
      const next = { ...prev, darkMode: !prev.darkMode };
      next.themeMode = next.darkMode ? 'dark' : 'light';
      settingsApi.save(next).catch(() => setSettings(prev));
      return next;
    });
  }, []);

  const updateSettings = useCallback((partial) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      settingsApi.save(next).catch(() => setSettings(prev));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, toggleDarkMode, updateSettings }),
    [settings, toggleDarkMode, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings requires SettingsProvider');
  return ctx;
}
