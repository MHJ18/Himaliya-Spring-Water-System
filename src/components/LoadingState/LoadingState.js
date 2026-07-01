import React from 'react';
import './LoadingState.css';

let activeLoadingStates = 0;

export default function LoadingState({
  label = 'Loading Himaliya Spring...',
  compact = false,
  variant = 'dashboard',
}) {
  React.useEffect(() => {
    activeLoadingStates += 1;
    document.body.classList.add('hs-is-loading');
    return () => {
      activeLoadingStates = Math.max(0, activeLoadingStates - 1);
      if (activeLoadingStates === 0) document.body.classList.remove('hs-is-loading');
    };
  }, []);

  return (
    <div className={`hs-loading-state hs-loading-state--${variant}${compact ? ' hs-loading-state--compact' : ''}`} role="status" aria-live="polite">
      {variant === 'table' ? (
        <div className="hs-loading-state__table" aria-hidden="true">
          <span className="hs-loading-state__table-toolbar" />
          <span /><span /><span /><span /><span />
        </div>
      ) : variant === 'form' ? (
        <div className="hs-loading-state__form" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : variant === 'portal' ? (
        <div className="hs-loading-state__portal" aria-hidden="true">
          <div className="hs-loading-state__portal-header" />
          <div className="hs-loading-state__stats"><span /><span /><span /></div>
          <div className="hs-loading-state__portal-grid"><span /><span /><span /><span /></div>
        </div>
      ) : (
        <div className="hs-loading-state__dashboard" aria-hidden="true">
          <div className="hs-loading-state__top"><span /><span /></div>
          <div className="hs-loading-state__stats"><span /><span /><span /><span /></div>
          <div className="hs-loading-state__bottom"><span /><span /><span /></div>
        </div>
      )}
      <div className="sr-only">
        <strong>{label}</strong>
      </div>
    </div>
  );
}
