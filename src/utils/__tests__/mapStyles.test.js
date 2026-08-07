import fs from 'fs';
import path from 'path';
import { MAP_STYLE_URLS } from '../mapStyles';

describe('map provider configuration', () => {
  it('uses the same CSP-approved provider for light and dark maps', () => {
    expect(MAP_STYLE_URLS.light).toMatch(/^https:\/\/tiles\.openfreemap\.org\//);
    expect(MAP_STYLE_URLS.dark).toMatch(/^https:\/\/tiles\.openfreemap\.org\//);

    const netlifyConfig = fs.readFileSync(path.join(process.cwd(), 'netlify.toml'), 'utf8');
    expect(netlifyConfig).toContain('https://tiles.openfreemap.org');
  });

  it('does not leave the blocked CARTO host in the customer map', () => {
    const customerMap = fs.readFileSync(path.join(
      process.cwd(),
      'src',
      'pages',
      'dashboard',
      'components',
      'customer-map',
      'CustomerMap.js',
    ), 'utf8');
    expect(customerMap).toContain('MAP_STYLE_URLS');
    expect(customerMap).not.toContain('cartocdn.com');
  });
});
