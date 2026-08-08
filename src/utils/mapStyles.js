// Raster basemap styles for every map surface in the app.
//
// These are plain raster tiles described by a style object that lives in this
// file, so MapLibre never fetches a remote style document, vector tiles,
// sprite sheets or glyph ranges. The only network requests a map makes are
// ordinary tile images.
//
// That matters for two reasons. Vector tiles, glyphs and sprites are fetched
// with XHR and are therefore governed by `connect-src`, while tile images only
// need `img-src` — the vector setup silently failed in production because the
// CSP only ever allow-listed the tile host for images. Raster tiles also cost
// far less to fetch and render, which is the configuration this app shipped
// with originally and the one known to work on the networks it serves.
//
// If you reintroduce a vector style, add its host to BOTH `connect-src` and
// `img-src` in netlify.toml or the tiles will be blocked once deployed.

const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd'];

export const MAP_TILE_HOST = 'https://basemaps.cartocdn.com';

export const MAP_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

const TILE_VARIANTS = {
  light: 'voyager',
  dark: 'dark_all',
};

function tileUrls(variant) {
  return CARTO_SUBDOMAINS.map(
    (subdomain) => `https://${subdomain}.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png`,
  );
}

// A fresh object per call: MapLibre takes ownership of the style it is given
// and mutates it, so handing out a shared instance corrupts later loads.
export function getMapStyle(mode) {
  const variant = TILE_VARIANTS[mode] || TILE_VARIANTS.light;
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: tileUrls(variant),
        tileSize: 256,
        minzoom: 0,
        maxzoom: 20,
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      },
    ],
  };
}

export const MAP_STYLE_MODES = Object.freeze(['light', 'dark']);
