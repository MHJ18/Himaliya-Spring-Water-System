import fs from 'fs';
import path from 'path';
import { getMapStyle, MAP_STYLE_MODES } from '../mapStyles';

function readNetlifyConfig() {
  return fs.readFileSync(path.join(process.cwd(), 'netlify.toml'), 'utf8');
}

function readSource(...segments) {
  return fs.readFileSync(path.join(process.cwd(), 'src', ...segments), 'utf8');
}

describe('map basemap configuration', () => {
  it('describes the basemap locally so no remote style document is fetched', () => {
    MAP_STYLE_MODES.forEach((mode) => {
      const style = getMapStyle(mode);
      expect(style.version).toBe(8);
      expect(style.sources.basemap.type).toBe('raster');
      expect(style.sources.basemap.tiles.length).toBeGreaterThan(0);
      style.sources.basemap.tiles.forEach((url) => {
        expect(url).toMatch(/^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/rastertiles\//);
      });
    });
  });

  it('hands out a fresh style object per call because MapLibre mutates it', () => {
    const first = getMapStyle('dark');
    const second = getMapStyle('dark');
    expect(first).not.toBe(second);
    expect(first.sources.basemap.tiles).not.toBe(second.sources.basemap.tiles);
    expect(first).toEqual(second);
  });

  it('uses different tiles for light and dark so the toggle actually changes', () => {
    expect(getMapStyle('light').sources.basemap.tiles)
      .not.toEqual(getMapStyle('dark').sources.basemap.tiles);
  });

  it('credits OpenStreetMap and CARTO on every basemap', () => {
    MAP_STYLE_MODES.forEach((mode) => {
      const { attribution } = getMapStyle(mode).sources.basemap;
      expect(attribution).toContain('OpenStreetMap');
      expect(attribution).toContain('CARTO');
    });
  });

  // Raster tiles are plain images, so img-src is the directive that has to
  // allow the tile host. The vector setup this replaced was allow-listed for
  // images only while fetching its tiles over connect-src, which is why it
  // rendered nothing once deployed.
  it('allow-lists the tile host for images in the production CSP', () => {
    const csp = readNetlifyConfig();
    const imgSrc = csp.match(/img-src([^;]*);/)[1];
    expect(imgSrc).toContain('cartocdn.com');
  });

  it('keeps the geocoding and routing services on connect-src', () => {
    const connectSrc = readNetlifyConfig().match(/connect-src([^;]*);/)[1];
    ['photon.komoot.io', 'nominatim.openstreetmap.org', 'router.project-osrm.org']
      .forEach((host) => expect(connectSrc).toContain(host));
  });

  it('keeps both map surfaces on the shared style helper', () => {
    [
      readSource('components', 'RiderMap', 'RiderMap.js'),
      readSource('pages', 'dashboard', 'components', 'customer-map', 'CustomerMap.js'),
    ].forEach((source) => {
      expect(source).toContain('getMapStyle');
      expect(source).not.toContain('cartocdn.com');
    });
  });
});

describe('map marker coordinates', () => {
  // Supplying a coordinate makes RiderMap treat a stop as exact and skip the
  // address lookup, so callers must pass the address alone and let the map
  // resolve it. Pre-filling a generated coordinate pinned every customer to a
  // hashed point near the city centre.
  it('does not pre-fill generated coordinates for map stops', () => {
    [
      readSource('pages', 'rider', 'RiderPortal.js'),
      readSource('pages', 'himalaya', 'RiderTracking.js'),
    ].forEach((source) => {
      expect(source).not.toContain('getStableCustomerCoordinates');
    });
  });
});
