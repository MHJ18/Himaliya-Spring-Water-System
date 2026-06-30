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
    document.body.classList.toggle('dashboard-dark', settings.darkMode);
    document.body.classList.toggle('dashboard-light', !settings.darkMode);
    document.documentElement.classList.toggle('dark', settings.darkMode);
    document.documentElement.classList.toggle('light', !settings.darkMode);
    document.documentElement.style.colorScheme = settings.darkMode ? 'dark' : 'light';
  }, [settings]);

  const toggleDarkMode = useCallback(() => {
    document.documentElement.classList.add('theme-transitioning');
    window.setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 500);
    setSettings((prev) => {
      const next = { ...prev, darkMode: !prev.darkMode };
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
