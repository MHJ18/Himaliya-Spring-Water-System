import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ADMIN_BACKGROUND_PALETTES } from '../../data/constants';
import { SettingsProvider, useSettings } from '../SettingsContext';
import { settingsApi } from '../../services/api/settingsApi';

jest.mock('../../services/api/settingsApi', () => ({
  settingsApi: {
    get: jest.fn(),
    save: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../services/cloud/supabaseClient', () => ({
  getSessionReadyEventName: () => 'hs-session-ready-test',
  hasStoredSessionType: () => false,
}));

jest.mock('../../utils/formatters', () => ({
  setRegionalFormat: jest.fn(),
}));

const LOCAL_SETTINGS_KEY = 'hs_interface_settings';
const paletteById = (id) => ADMIN_BACKGROUND_PALETTES.find((palette) => palette.id === id);

function createMatchMedia(matches = false) {
  return jest.fn(() => ({
    matches,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
}

describe('SettingsProvider appearance settings', () => {
  let container;
  let root;
  let current;
  let setPropertySpy;

  function Probe() {
    current = useSettings();
    return null;
  }

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.matchMedia = createMatchMedia(false);
    settingsApi.save.mockClear();
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('data-bg-palette');
    document.documentElement.removeAttribute('data-bg-effect');
    document.body.removeAttribute('data-bg-palette');
    document.body.removeAttribute('data-bg-effect');
    setPropertySpy = jest.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPropertySpy.mockRestore();
    delete global.IS_REACT_ACT_ENVIRONMENT;
    container.remove();
  });

  function renderProvider() {
    act(() => {
      root = createRoot(container);
      root.render(<SettingsProvider><Probe /></SettingsProvider>);
    });
  }

  it('applies the selected gradient immediately and switches its mode consistently', async () => {
    renderProvider();
    const aqua = paletteById('aqua');

    await act(async () => {
      await current.updateSettings({ backgroundPalette: aqua.id });
    });

    expect(document.documentElement.dataset.bgPalette).toBe(aqua.id);
    expect(document.body.dataset.bgPalette).toBe(aqua.id);
    expect(document.documentElement.dataset.bgEffect).toBe('none');
    expect(setPropertySpy.mock.calls.filter(([name, value]) => (
      name === '--hs-selected-page-bg' && value === aqua.light
    ))).toHaveLength(2);
    expect(JSON.parse(window.localStorage.getItem(LOCAL_SETTINGS_KEY)).backgroundPalette).toBe(aqua.id);

    await act(async () => {
      await current.updateSettings({ themeMode: 'dark', darkMode: true });
    });

    expect(current.resolvedDarkMode).toBe(true);
    expect(setPropertySpy.mock.calls.filter(([name, value]) => (
      name === '--hs-selected-page-bg' && value === aqua.dark
    ))).toHaveLength(2);
  });

  it('trusts an explicit light mode and migrates removed palette ids', () => {
    window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify({
      backgroundPalette: 'mesh',
      themeMode: 'light',
      darkMode: true,
    }));

    renderProvider();

    const sky = paletteById('sky');
    expect(current.settings.backgroundPalette).toBe('sky');
    expect(current.settings.darkMode).toBe(false);
    expect(current.resolvedDarkMode).toBe(false);
    expect(setPropertySpy.mock.calls.filter(([name, value]) => (
      name === '--hs-selected-page-bg' && value === sky.light
    ))).toHaveLength(2);
  });

  it('reports an operational save failure and restores the applied settings', async () => {
    settingsApi.save.mockRejectedValueOnce(new Error('network unavailable'));
    renderProvider();
    let result;

    await act(async () => {
      result = await current.updateSettings({ riderAssignmentMode: 'auto' });
    });

    expect(result).toMatchObject({ ok: false });
    expect(result.error.message).toBe('network unavailable');
    expect(current.settings.riderAssignmentMode).toBe('manual');
  });
});
