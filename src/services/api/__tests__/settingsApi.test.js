jest.mock('../../cloud/himalayaDb', () => ({
  getCloudSettings: jest.fn(),
  saveCloudSettings: jest.fn(() => Promise.resolve()),
}));

const { getCloudSettings } = require('../../cloud/himalayaDb');
const { settingsApi } = require('../settingsApi');

describe('settingsApi appearance migrations', () => {
  beforeEach(() => {
    localStorage.clear();
    getCloudSettings.mockReset();
  });

  it('preserves a legacy dark preference before defaults are merged', async () => {
    getCloudSettings.mockResolvedValue({ darkMode: true });

    const settings = await settingsApi.get();

    expect(settings.themeMode).toBe('dark');
    expect(settings.darkMode).toBe(true);
  });

  it('treats an explicit light mode as authoritative over a stale legacy flag', async () => {
    getCloudSettings.mockResolvedValue({ themeMode: 'light', darkMode: true });

    const settings = await settingsApi.get();

    expect(settings.themeMode).toBe('light');
  });
});
