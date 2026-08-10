import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import RouteBranding from '../RouteBranding';

describe('RouteBranding search metadata', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.head.querySelectorAll('meta[name="robots"], meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]').forEach((node) => node.remove());
    document.head.querySelectorAll('link[rel="shortcut icon"]').forEach((node) => node.remove());
    document.title = '';
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  function renderRoute(pathname) {
    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[pathname]}>
          <RouteBranding />
        </MemoryRouter>
      );
    });
  }

  it('publishes local landing metadata on the public home page', () => {
    renderRoute('/');

    expect(document.title).toBe('19L Water Delivery in Sialkot Cantt | Himaliya Spring Water');
    expect(document.querySelector('meta[name="description"]').content).toContain('Sialkot Cantt');
    expect(document.querySelector('meta[name="robots"]').content).toContain('index, follow');
    expect(document.querySelector('meta[property="og:title"]').content).toBe(document.title);
  });

  it('prevents private and tokenized routes from being indexed', () => {
    renderRoute('/invoice/example-number');

    expect(document.title).toBe('Invoice | Himaliya Spring Water');
    expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow, noarchive');
  });
});
