import React from 'react';
import { withRouter } from 'react-router-dom';

const icons = {
  admin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#071b33"/><path d="M32 9c-8 12-17 22-17 33a17 17 0 0 0 34 0C49 31 40 21 32 9Z" fill="#49c9ff"/><path d="M24 43h16M32 35v16" stroke="#071b33" stroke-width="5" stroke-linecap="round"/></svg>`,
  customer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#e9f9ff"/><circle cx="32" cy="24" r="10" fill="#0786c8"/><path d="M14 54c1-12 8-19 18-19s17 7 18 19" fill="#49c9ff"/><path d="M53 8c-4 6-8 10-8 15a8 8 0 0 0 16 0c0-5-4-9-8-15Z" fill="#0786c8"/></svg>`,
  public: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#071b33"/><path d="M32 8C23 22 14 31 14 43a18 18 0 0 0 36 0C50 31 41 22 32 8Z" fill="#55d5ff"/></svg>`,
};

function svgUrl(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function RouteBranding({ location }) {
  React.useEffect(() => {
    const customerArea = location.pathname.indexOf('/customer') === 0;
    const adminArea = location.pathname.indexOf('/app') === 0
      || location.pathname === '/login'
      || location.pathname === '/profile';
    const role = customerArea ? 'customer' : (adminArea ? 'admin' : 'public');
    let favicon = document.querySelector('link[rel="shortcut icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'shortcut icon';
      document.head.appendChild(favicon);
    }
    favicon.href = svgUrl(icons[role]);
    document.title = role === 'customer'
      ? 'Himaliya Spring — Customer'
      : role === 'admin'
        ? 'Himaliya Spring — Admin'
        : 'Himaliya Spring Water';
  }, [location.pathname]);

  return null;
}

export default withRouter(RouteBranding);
