import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep a useful stack in development while rendering a recoverable screen.
    console.error('Application render failed', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert">
        <div>
          <span>Himaliya Spring Water</span>
          <h1>The dashboard could not finish loading.</h1>
          <p>{error.message || 'An unexpected interface error occurred.'}</p>
          <button type="button" onClick={() => window.location.reload()}>Reload dashboard</button>
        </div>
      </main>
    );
  }
}
