import {
  ADMIN_BACKGROUND_PALETTES,
  DEFAULT_ADMIN_BACKGROUND,
  getAdminBackgroundPalette,
} from '../constants';

describe('admin background palettes', () => {
  it('offers the full set of gradient combinations', () => {
    expect(ADMIN_BACKGROUND_PALETTES.map(({ id }) => id)).toEqual([
      'sky',
      'aqua',
      'lavender',
      'aurora',
      'citrus',
      'meadow',
      'twilight',
      'slate',
    ]);
    expect(new Set(ADMIN_BACKGROUND_PALETTES.map(({ id }) => id)).size)
      .toBe(ADMIN_BACKGROUND_PALETTES.length);
  });

  it('keeps every choice static and usable in both appearance modes', () => {
    ADMIN_BACKGROUND_PALETTES.forEach((palette) => {
      expect(palette.effect).toBe('none');
      expect(palette.light).toContain('linear-gradient');
      expect(palette.dark).toContain('linear-gradient');
      expect(palette.swatches).toHaveLength(3);
    });
  });

  it('gives each light palette a visible gradient, not a near-white wash', () => {
    // The previous light values topped out around #edf4ff, which read as flat
    // white. Every light gradient must now include a stop that is clearly
    // tinted (at least one channel below 0xE8) so the gradient is perceivable.
    ADMIN_BACKGROUND_PALETTES.forEach((palette) => {
      const hexStops = palette.light.match(/#[0-9a-f]{6}/gi) || [];
      expect(hexStops.length).toBeGreaterThan(0);
      const hasTintedStop = hexStops.some((hex) => {
        const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return Math.min(...channels) < 0xe8;
      });
      expect(hasTintedStop).toBe(true);
    });
  });

  it('migrates removed or unknown palette ids to the default', () => {
    expect(DEFAULT_ADMIN_BACKGROUND).toBe('sky');
    expect(getAdminBackgroundPalette('mesh').id).toBe(DEFAULT_ADMIN_BACKGROUND);
    expect(getAdminBackgroundPalette('not-a-palette').id).toBe(DEFAULT_ADMIN_BACKGROUND);
  });
});
