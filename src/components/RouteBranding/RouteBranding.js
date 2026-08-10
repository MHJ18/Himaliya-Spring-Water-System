import React from 'react';
import { withRouter } from 'react-router-dom';

const icons = {
  admin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#071b33"/><path d="M32 9c-8 12-17 22-17 33a17 17 0 0 0 34 0C49 31 40 21 32 9Z" fill="#49c9ff"/><path d="M24 43h16M32 35v16" stroke="#071b33" stroke-width="5" stroke-linecap="round"/></svg>`,
  customer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#e9f9ff"/><circle cx="32" cy="24" r="10" fill="#0786c8"/><path d="M14 54c1-12 8-19 18-19s17 7 18 19" fill="#49c9ff"/><path d="M53 8c-4 6-8 10-8 15a8 8 0 0 0 16 0c0-5-4-9-8-15Z" fill="#0786c8"/></svg>`,
  rider: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#07263b"/><circle cx="19" cy="44" r="9" fill="none" stroke="#63e1ed" stroke-width="5"/><circle cx="47" cy="44" r="9" fill="none" stroke="#63e1ed" stroke-width="5"/><path d="M19 44l10-17h11l7 17M27 33h17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  public: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#071b33"/><path d="M32 8C23 22 14 31 14 43a18 18 0 0 0 36 0C50 31 41 22 32 8Z" fill="#55d5ff"/></svg>`,
};

const siteName = 'Himaliya Spring Water';
const landingTitle = `19L Water Delivery in Sialkot Cantt | ${siteName}`;
const landingDescription = 'Order 19L spring water refills for homes and offices in Sialkot Cantt. Track deliveries, bottles, invoices, and balances with Himaliya Spring Water.';

function setMetaContent(attribute, key, content) {
  let meta = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function getRouteMetadata(pathname) {
  if (pathname === '/') {
    return { title: landingTitle, description: landingDescription, indexable: true };
  }
  if (pathname === '/customer/login') {
    return {
      title: `Order 19L Water | ${siteName}`,
      description: 'Sign in to order and manage Himaliya Spring Water deliveries.',
    };
  }
  if (pathname.indexOf('/customer') === 0) {
    return {
      title: `Customer Portal | ${siteName}`,
      description: 'Manage your Himaliya Spring Water orders, account, and messages.',
    };
  }
  if (pathname.indexOf('/rider') === 0) {
    return {
      title: `Rider Portal | ${siteName}`,
      description: 'Authorized delivery workspace for Himaliya Spring Water riders.',
    };
  }
  if (pathname.indexOf('/track/') === 0) {
    return {
      title: `Track Your Delivery | ${siteName}`,
      description: 'View the latest status of a Himaliya Spring Water delivery.',
    };
  }
  if (pathname.indexOf('/invoice/') === 0) {
    return {
      title: `Invoice | ${siteName}`,
      description: 'View a Himaliya Spring Water invoice.',
    };
  }
  if (pathname === '/login') {
    return {
      title: `Staff Sign In | ${siteName}`,
      description: 'Authorized staff sign in for Himaliya Spring Water operations.',
    };
  }
  if (pathname === '/forgot-password' || pathname === '/reset-password' || pathname.indexOf('/account/') === 0) {
    return {
      title: `Account Access | ${siteName}`,
      description: 'Secure account access for Himaliya Spring Water staff.',
    };
  }
  if (pathname.indexOf('/app') === 0 || ['/history', '/messages', '/notifications', '/profile'].includes(pathname)) {
    return {
      title: `Administration | ${siteName}`,
      description: 'Authorized administration workspace for Himaliya Spring Water.',
    };
  }
  if (pathname === '/error') {
    return {
      title: `Page Not Found | ${siteName}`,
      description: 'The requested Himaliya Spring Water page could not be found.',
    };
  }
  return {
    title: siteName,
    description: 'Himaliya Spring Water delivery and operations in Sialkot Cantt.',
  };
}

function svgUrl(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function RouteBranding({ location }) {
  React.useEffect(() => {
    const customerArea = location.pathname.indexOf('/customer') === 0;
    const riderArea = location.pathname.indexOf('/rider') === 0;
    const adminArea = location.pathname.indexOf('/app') === 0
      || location.pathname === '/login'
      || location.pathname === '/profile';
    const role = customerArea ? 'customer' : riderArea ? 'rider' : (adminArea ? 'admin' : 'public');
    let favicon = document.querySelector('link[rel="shortcut icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'shortcut icon';
      document.head.appendChild(favicon);
    }
    favicon.href = svgUrl(icons[role]);
    const metadata = getRouteMetadata(location.pathname);
    document.title = metadata.title;
    setMetaContent('name', 'description', metadata.description);
    setMetaContent(
      'name',
      'robots',
      metadata.indexable
        ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
        : 'noindex, nofollow, noarchive'
    );
    setMetaContent('property', 'og:title', metadata.title);
    setMetaContent('property', 'og:description', metadata.description);
    setMetaContent('name', 'twitter:title', metadata.title);
    setMetaContent('name', 'twitter:description', metadata.description);
  }, [location.pathname]);

  return null;
}

export default withRouter(RouteBranding);
