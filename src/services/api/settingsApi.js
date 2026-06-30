import { DEFAULT_SETTINGS } from '../../data/constants';
import { getCloudSettings, saveCloudSettings } from '../cloud/himalayaDb';

export const settingsApi = {
  async get() {
    const cloudSettings = await getCloudSettings();
    let legacySettings = null;
    try { legacySettings = JSON.parse(localStorage.getItem('ws_settings') || 'null'); } catch { legacySettings = null; }
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
