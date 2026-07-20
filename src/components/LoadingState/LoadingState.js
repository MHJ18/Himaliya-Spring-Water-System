import React from 'react';
import PropTypes from 'prop-types';
import './LoadingState.css';

const blocks = (count, className = '') => Array.from({ length: count }, (_, index) => (
  <span key={index} className={className} />
));

function AuthSkeleton({ customer }) {
  return (
    <div className="hs-loading-state__auth" aria-hidden="true">
      <div className="hs-loading-state__auth-mobile-brand">
        <span className="hs-loading-state__auth-mark" />
        <span className="hs-loading-state__line-group">
          <i />
          <i />
        </span>
      </div>
      <section className="hs-loading-state__auth-copy">
        <span className="hs-loading-state__auth-badge" />
        <span className="hs-loading-state__auth-title" />
        <span className="hs-loading-state__auth-description" />
        <div className="hs-loading-state__auth-stats">{blocks(3)}</div>
        {customer && <span className="hs-loading-state__auth-route" />}
      </section>
      <section className="hs-loading-state__auth-card">
        <div className="hs-loading-state__auth-card-heading">
          <span className="hs-loading-state__auth-mark" />
          <span className="hs-loading-state__line-group">
            <i />
            <i />
          </span>
        </div>
        {customer
          ? <div className="hs-loading-state__auth-tabs">{blocks(2)}</div>
          : <span className="hs-loading-state__auth-card-intro" />}
        <div className="hs-loading-state__auth-form">
          <span className="hs-loading-state__auth-label" />
          <span className="hs-loading-state__auth-input" />
          <span className="hs-loading-state__auth-label" />
          <span className="hs-loading-state__auth-input" />
          <span className="hs-loading-state__auth-submit" />
          <span className="hs-loading-state__auth-note" />
          <span className="hs-loading-state__auth-link" />
        </div>
      </section>
    </div>
  );
}

AuthSkeleton.propTypes = {
  customer: PropTypes.bool.isRequired,
};

function PortalSkeleton() {
  return (
    <div className="hs-loading-state__portal" aria-hidden="true">
      <div className="hs-loading-state__portal-header">
        <div><span className="hs-loading-state__portal-mark" /><span /></div>
        <span className="hs-loading-state__portal-action" />
      </div>
      <div className="hs-loading-state__portal-stats">{blocks(3)}</div>
      <div className="hs-loading-state__portal-grid">
        <span className="hs-loading-state__portal-order" />
        <span className="hs-loading-state__portal-notifications" />
        <span className="hs-loading-state__portal-history" />
        <span className="hs-loading-state__portal-invoices" />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="hs-loading-state__profile" aria-hidden="true">
      <div className="hs-loading-state__profile-toolbar">{blocks(2)}</div>
      <span className="hs-loading-state__profile-header" />
      <span className="hs-loading-state__profile-form" />
    </div>
  );
}

function AdminShellSkeleton() {
  return (
    <div className="hs-loading-state__admin-shell" aria-hidden="true">
      <aside>
        <span className="hs-loading-state__admin-brand" />
        <div>{blocks(11)}</div>
      </aside>
      <div className="hs-loading-state__admin-workspace">
        <span className="hs-loading-state__admin-toolbar" />
        <div className="hs-loading-state__admin-content">
          <span className="hs-loading-state__admin-breadcrumb" />
          <span className="hs-loading-state__admin-heading" />
          <DashboardSkeleton route />
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton({ route = false }) {
  return (
    <div className={`hs-loading-state__dashboard${route ? ' is-route' : ''}`} aria-hidden="true">
      <div className="hs-loading-state__dashboard-stats">{blocks(4)}</div>
      <div className="hs-loading-state__dashboard-primary">{blocks(2)}</div>
      <span className="hs-loading-state__dashboard-actions" />
      <div className="hs-loading-state__dashboard-bottom">{blocks(2)}</div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="hs-loading-state__analytics" aria-hidden="true">
      <span className="hs-loading-state__analytics-action" />
      <div className="hs-loading-state__analytics-stats">{blocks(4)}</div>
      <div className="hs-loading-state__analytics-charts">{blocks(4)}</div>
    </div>
  );
}

DashboardSkeleton.propTypes = {
  route: PropTypes.bool,
};

function TableSkeleton() {
  return (
    <div className="hs-loading-state__table" aria-hidden="true">
      <span className="hs-loading-state__table-toolbar" />
      {blocks(5)}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="hs-loading-state__form" aria-hidden="true">
      <span className="hs-loading-state__form-hero" />
      <span className="hs-loading-state__form-card" />
      <div>{blocks(4)}</div>
    </div>
  );
}

export default function LoadingState({
  label = 'Loading Himaliya Spring...',
  compact = false,
  variant = 'dashboard',
  className = '',
}) {
  let content;
  if (variant === 'admin-auth' || variant === 'customer-auth') {
    content = <AuthSkeleton customer={variant === 'customer-auth'} />;
  } else if (variant === 'portal') {
    content = <PortalSkeleton />;
  } else if (variant === 'customer-profile') {
    content = <ProfileSkeleton />;
  } else if (variant === 'admin-shell') {
    content = <AdminShellSkeleton />;
  } else if (variant === 'table') {
    content = <TableSkeleton />;
  } else if (variant === 'form') {
    content = <FormSkeleton />;
  } else if (variant === 'analytics') {
    content = <AnalyticsSkeleton />;
  } else {
    content = <DashboardSkeleton />;
  }

  const fullPage = ['admin-auth', 'customer-auth', 'portal', 'customer-profile', 'admin-shell'].includes(variant);
  const Wrapper = fullPage ? 'main' : 'div';

  return (
    <Wrapper
      className={`hs-loading-state hs-loading-state--${variant}${compact ? ' hs-loading-state--compact' : ''}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {content}
      <span className="sr-only">{label}</span>
    </Wrapper>
  );
}

LoadingState.propTypes = {
  label: PropTypes.string,
  compact: PropTypes.bool,
  className: PropTypes.string,
  variant: PropTypes.oneOf([
    'admin-auth',
    'customer-auth',
    'portal',
    'customer-profile',
    'admin-shell',
    'analytics',
    'dashboard',
    'table',
    'form',
  ]),
};
