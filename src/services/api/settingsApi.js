import { DEFAULT_SETTINGS } from '../../data/constants';
import { getCloudSettings, saveCloudSettings } from '../cloud/himalayaDb';

function migrateLegacyThemeMode(settings) {
  if (!settings || ['light', 'dark', 'system'].includes(settings.themeMode)) return settings;
  if (!Object.prototype.hasOwnProperty.call(settings, 'darkMode')) return settings;
  return { ...settings, themeMode: settings.darkMode ? 'dark' : 'light' };
}

export const settingsApi = {
  async get() {
    const cloudSettings = migrateLegacyThemeMode(await getCloudSettings());
    let legacySettings = null;
    try {
      legacySettings = migrateLegacyThemeMode(JSON.parse(localStorage.getItem('ws_settings') || 'null'));
    } catch {
      legacySettings = null;
    }
    if (legacySettings) {
      const merged = { ...DEFAULT_SETTINGS, ...(cloudSettings || {}), ...legacySettings };
      await saveCloudSettings(merged);
      localStorage.removeItem('ws_settings');
      return merged;
    }
    return { ...DEFAULT_SETTINGS, ...(cloudSettings || {}) };
  },
  async save(settings) {
    await saveCloudSettings(settings);
    return settings;
  },
};
