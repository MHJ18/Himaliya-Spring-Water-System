import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import {
  DEFAULT_SETTINGS,
  getAdminBackgroundPalette,
  getAdminFontStack,
  getAdminThemePreset,
} from '../data/constants';
import { settingsApi } from '../services/api/settingsApi';
import { getSessionReadyEventName, hasStoredSessionType } from '../services/cloud/supabaseClient';
import { setRegionalFormat } from '../utils/formatters';

const SettingsContext = createContext(null);
const LOCAL_INTERFACE_SETTINGS_KEY = 'hs_interface_settings';
const LOCAL_INTERFACE_KEYS = [
  'themeMode', 'darkMode', 'colorTheme', 'compactMode', 'reduceMotion',
  'highContrast', 'fontScale', 'fontFamily', 'backgroundPalette', 'surfaceStyle', 'dashboardLayout', 'language',
  'headerColor', 'headerTextColor', 'sidebarColor', 'sidebarTextColor',
  'sidebarBrandTitle', 'sidebarBrandSubtitle', 'authAccentColor', 'authPanelColor',
  'authLayout', 'showLoginStats', 'showBreadcrumbs', 'stickyHeader',
  'sidebarPosition', 'sidebarVisibility', 'bottleBranding',
];

function readLocalInterfaceSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(LOCAL_INTERFACE_SETTINGS_KEY) || '{}');
    const saved = ['light', 'dark', 'system'].includes(stored.themeMode)
      ? stored
      : Object.prototype.hasOwnProperty.call(stored, 'darkMode')
        ? { ...stored, themeMode: stored.darkMode ? 'dark' : 'light' }
        : stored;
    return LOCAL_INTERFACE_KEYS.reduce((next, key) => (
      Object.prototype.hasOwnProperty.call(saved, key) ? { ...next, [key]: saved[key] } : next
    ), {});
  } catch {
    return {};
  }
}

function saveLocalInterfaceSettings(settings) {
  try {
    const payload = LOCAL_INTERFACE_KEYS.reduce((next, key) => (
      Object.prototype.hasOwnProperty.call(settings, key) ? { ...next, [key]: settings[key] } : next
    ), {});
    window.localStorage.setItem(LOCAL_INTERFACE_SETTINGS_KEY, JSON.stringify(payload));
  } catch {
    // The cloud copy remains authoritative when local storage is unavailable.
  }
}

function normalizeInterfaceSettings(settings) {
  const themeMode = ['light', 'dark', 'system'].includes(settings.themeMode)
    ? settings.themeMode
    : settings.darkMode ? 'dark' : 'light';
  return {
    ...settings,
    themeMode,
    darkMode: themeMode === 'dark',
    backgroundPalette: getAdminBackgroundPalette(settings.backgroundPalette).id,
  };
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => normalizeInterfaceSettings({
    ...DEFAULT_SETTINGS,
    ...readLocalInterfaceSettings(),
  }));
  const [systemDark, setSystemDark] = useState(
    () => Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
  const settingsRef = useRef(settings);
  const transitionTimer = useRef(null);

  const beginAppearanceTransition = useCallback((reduceMotion = false) => {
    window.clearTimeout(transitionTimer.current);
    if (reduceMotion) {
      document.documentElement.classList.remove('theme-transitioning');
      return;
    }
    document.documentElement.classList.add('theme-transitioning');
    transitionTimer.current = window.setTimeout(
      () => document.documentElement.classList.remove('theme-transitioning'),
      520
    );
  }, []);

  useEffect(() => {
    const loadSettings = () => {
      if (!hasStoredSessionType('admin')) return;
      settingsApi.get().then((data) => {
        const next = normalizeInterfaceSettings({ ...data, ...readLocalInterfaceSettings() });
        settingsRef.current = next;
        setSettings(next);
      }).catch(() => {});
    };
    loadSettings();
    window.addEventListener(getSessionReadyEventName(), loadSettings);
    return () => window.removeEventListener(getSessionReadyEventName(), loadSettings);
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (event) => {
      const current = settingsRef.current;
      if (current.themeMode === 'system') {
        beginAppearanceTransition(Boolean(current.reduceMotion));
      }
      setSystemDark(event.matches);
    };
    setSystemDark(media.matches);
    if (media.addEventListener) media.addEventListener('change', handleSystemThemeChange);
    else media.addListener(handleSystemThemeChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', handleSystemThemeChange);
      else media.removeListener(handleSystemThemeChange);
    };
  }, [beginAppearanceTransition]);

  const resolvedDarkMode = settings.themeMode === 'system'
    ? systemDark
    : settings.themeMode === 'dark';

  // formatCurrency/formatDate are called outside React too, so the regional
  // choice is pushed into the formatter module instead of read from context.
  // This runs during render, not in an effect: the provider renders before its
  // children, so their very next render already formats with the new currency.
  // In an effect it would land after them, leaving stale totals on screen until
  // something unrelated forced another render.
  setRegionalFormat({
    regionLocale: settings.regionLocale,
    currencyCode: settings.currencyCode,
  });

  useEffect(() => {
    const themePreset = getAdminThemePreset(settings.colorTheme);
    const root = document.documentElement;
    document.body.classList.toggle('dashboard-dark', resolvedDarkMode);
    document.body.classList.toggle('dashboard-light', !resolvedDarkMode);
    document.body.classList.toggle('dashboard-compact', Boolean(settings.compactMode));
    document.body.dataset.adminTheme = themePreset.id;
    root.classList.toggle('dark', resolvedDarkMode);
    root.classList.toggle('light', !resolvedDarkMode);
    root.classList.toggle('dashboard-compact', Boolean(settings.compactMode));
    root.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
    root.classList.toggle('high-contrast', Boolean(settings.highContrast));
    root.dataset.adminTheme = themePreset.id;
    root.dataset.surfaceStyle = settings.surfaceStyle || 'soft';
    root.dataset.dashboardLayout = settings.dashboardLayout || 'studio';
    root.dataset.stickyHeader = settings.stickyHeader === false ? 'off' : 'on';
    root.dataset.language = settings.language === 'ur' ? 'ur' : 'en';
    root.lang = settings.language === 'ur' ? 'ur' : 'en';
    root.dir = settings.language === 'ur' ? 'rtl' : 'ltr';
    const baseFontSize = settings.fontScale === 'large'
      ? 16
      : settings.fontScale === 'small' ? 14 : 15;
    const workspaceFontSize = settings.compactMode
      ? Math.max(13, baseFontSize - 1.5)
      : baseFontSize;
    root.style.fontSize = `${workspaceFontSize}px`;
    root.style.colorScheme = resolvedDarkMode ? 'dark' : 'light';
    root.style.setProperty('--hs-font-family', getAdminFontStack(settings.fontFamily));
    // Keep the user's background on a dedicated token. Accent theme selectors
    // also define --hs-page-bg on <body>, so sharing that token allowed the
    // cascade to mask a newly selected palette in parts of the app shell.
    const backgroundPalette = getAdminBackgroundPalette(settings.backgroundPalette);
    root.dataset.bgPalette = backgroundPalette.id;
    root.dataset.bgEffect = backgroundPalette.effect || 'none';
    document.body.dataset.bgPalette = backgroundPalette.id;
    document.body.dataset.bgEffect = backgroundPalette.effect || 'none';
    const paletteBackground = resolvedDarkMode ? backgroundPalette.dark : backgroundPalette.light;
    if (paletteBackground) {
      root.style.setProperty('--hs-selected-page-bg', paletteBackground);
      document.body.style.setProperty('--hs-selected-page-bg', paletteBackground);
    } else {
      root.style.removeProperty('--hs-selected-page-bg');
      document.body.style.removeProperty('--hs-selected-page-bg');
    }
    root.style.setProperty('--hs-primary', themePreset.primary);
    root.style.setProperty('--hs-primary-light', themePreset.primaryLight);
    root.style.setProperty('--hs-primary-dark', themePreset.primaryDark);
    root.style.setProperty('--hs-secondary', themePreset.secondary);
    root.style.setProperty('--hs-header-custom', settings.headerColor || '#08090b');
    root.style.setProperty('--hs-header-custom-text', settings.headerTextColor || '#f7f8fa');
    root.style.setProperty('--hs-sidebar-custom', settings.sidebarColor || '#111214');
    root.style.setProperty('--hs-sidebar-custom-text', settings.sidebarTextColor || '#e7e9ed');
    root.style.setProperty('--hs-header-bg', settings.headerColor || '#08090b');
    root.style.setProperty('--hs-header-text', settings.headerTextColor || '#f7f8fa');
    root.style.setProperty('--hs-sidebar-bg', settings.sidebarColor || '#111214');
    root.style.setProperty('--hs-sidebar-text', settings.sidebarTextColor || '#e7e9ed');
    root.style.setProperty('--hs-auth-accent', settings.authAccentColor || themePreset.primary);
    root.style.setProperty('--hs-auth-panel', settings.authPanelColor || '#071d2a');
    document.body.style.setProperty('--hs-header-bg', settings.headerColor || '#08090b');
    document.body.style.setProperty('--hs-header-text', settings.headerTextColor || '#f7f8fa');
    document.body.style.setProperty('--hs-sidebar-bg', settings.sidebarColor || '#111214');
    document.body.style.setProperty('--hs-sidebar-text', settings.sidebarTextColor || '#e7e9ed');
    document.body.style.setProperty('--hs-auth-accent', settings.authAccentColor || themePreset.primary);
    document.body.style.setProperty('--hs-auth-panel', settings.authPanelColor || '#071d2a');
  }, [
    resolvedDarkMode,
    settings.colorTheme,
    settings.compactMode,
    settings.fontScale,
    settings.fontFamily,
    settings.backgroundPalette,
    settings.highContrast,
    settings.headerColor,
    settings.headerTextColor,
    settings.language,
    settings.reduceMotion,
    settings.stickyHeader,
    settings.dashboardLayout,
    settings.sidebarColor,
    settings.sidebarTextColor,
    settings.surfaceStyle,
    settings.authAccentColor,
    settings.authPanelColor,
  ]);

  const updateSettings = useCallback((partial) => {
    const previous = settingsRef.current;
    const changes = typeof partial === 'function' ? partial(previous) : partial;
    if (!changes || typeof changes !== 'object') return;
    const appearanceChanged = [
      'themeMode', 'darkMode', 'colorTheme', 'fontScale', 'fontFamily', 'backgroundPalette', 'surfaceStyle',
      'highContrast', 'dashboardLayout', 'headerColor', 'headerTextColor',
      'sidebarColor', 'sidebarTextColor', 'sidebarBrandTitle',
      'sidebarBrandSubtitle', 'authAccentColor', 'authPanelColor', 'authLayout',
      'showLoginStats', 'language', 'compactMode', 'reduceMotion',
      'showBreadcrumbs', 'stickyHeader', 'sidebarPosition', 'sidebarVisibility',
      'bottleBranding',
    ].some(
      (key) => Object.prototype.hasOwnProperty.call(changes, key) && changes[key] !== previous[key]
    );
    const canPersistLocally = Object.keys(changes)
      .every((key) => LOCAL_INTERFACE_KEYS.includes(key));
    if (appearanceChanged) beginAppearanceTransition(Boolean(previous.reduceMotion));

    const next = { ...previous, ...changes };
    saveLocalInterfaceSettings(next);
    settingsRef.current = next;
    setSettings(next);
    return settingsApi.save(next).then(() => ({
      ok: true,
      settings: next,
    })).catch((error) => {
      if (canPersistLocally) {
        return {
          ok: true,
          localOnly: true,
          settings: next,
        };
      }
      if (settingsRef.current === next) {
        settingsRef.current = previous;
        setSettings(previous);
      }
      return {
        ok: false,
        error,
        settings: previous,
      };
    });
  }, [beginAppearanceTransition]);

  const toggleDarkMode = useCallback(() => {
    const current = settingsRef.current;
    const currentIsDark = current.themeMode === 'system'
      ? systemDark
      : current.themeMode === 'dark';
    updateSettings({
      darkMode: !currentIsDark,
      themeMode: currentIsDark ? 'light' : 'dark',
    });
  }, [systemDark, updateSettings]);

  useEffect(() => () => {
    window.clearTimeout(transitionTimer.current);
    document.documentElement.classList.remove('theme-transitioning');
  }, []);

  const value = useMemo(
    () => ({
      settings,
      resolvedDarkMode,
      toggleDarkMode,
      updateSettings,
    }),
    [settings, resolvedDarkMode, toggleDarkMode, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings requires SettingsProvider');
  return ctx;
}
