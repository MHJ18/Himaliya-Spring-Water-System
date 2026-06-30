import React from 'react';
import PropTypes from 'prop-types';
import { Link, withRouter, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import { motion } from 'framer-motion';
import { ShakeX } from 'framer-motion-animations';
import { loginUser } from '../../actions/user';
import {
  consumeSessionExpiredNotice,
  hasStoredSessionType,
} from '../../services/cloud/supabaseClient';
import './WaterLogin.css';

function WaterLogin({ dispatch, isFetching, errorMessage, location }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [sessionExpired] = React.useState(() => {
    const storedNotice = consumeSessionExpiredNotice();
    return Boolean(location.state && location.state.sessionExpired) || storedNotice;
  });
  const from = (location.state && location.state.from) || { pathname: '/app/main/dashboard' };
  const visibleError = errorMessage || (sessionExpired
    ? 'Your session has expired. Log in again.'
    : '');

  if (hasStoredSessionType('admin')) {
    return <Redirect to={from} />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser({ email, password }));
  };

  return (
    <main className="water-login-page">
      <div className="water-login-shell">
        <motion.section
          className="water-login-mobile-brand"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <span className="water-login-logo-mark">HS</span>
          <div>
            <h1>Himaliya Spring Water</h1>
            <p>Water delivery management</p>
          </div>
        </motion.section>
        <motion.section
          className="water-login-copy"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <span className="water-login-badge">Himaliya Spring Water admin</span>
          <h1>Sign in to manage deliveries across Sialkot Cantt.</h1>
          <p>
            Track customer accounts, record daily bottle sales, monitor gallon deliveries,
            and review monthly revenue from one focused dashboard.
          </p>
          <div className="water-login-stats">
            <span><strong>19L</strong>gallon routes</span>
            <span><strong>Live</strong>customer ledger</span>
            <span><strong>Fast</strong>sales entry</span>
          </div>
        </motion.section>

        <motion.section
          className="water-login-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <div className="water-login-logo">
            <span className="water-login-logo-mark">HS</span>
            <div>
              <h2>Himaliya Spring Water</h2>
              <p>Admin dashboard</p>
            </div>
          </div>

          <div className="water-login-mobile-heading">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your dashboard.</p>
          </div>

          <form className="water-login-form" method="post" onSubmit={handleSubmit} autoComplete="on" noValidate>
            {visibleError && (
              <ShakeX key={visibleError} duration={0.4}>
                <div className="water-login-alert" role="alert" aria-live="assertive">
                  <span className="water-login-alert-icon" aria-hidden="true">!</span>
                  <span>{visibleError}</span>
                </div>
              </ShakeX>
            )}

            <label className="water-login-label" htmlFor="email">Email address</label>
            <div className="water-login-input-wrap">
              <span className="water-login-input-icon" aria-hidden="true">@</span>
              <input
                id="email"
                name="email"
                className="water-login-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => e.target.removeAttribute('readOnly')}
                placeholder="admin@himaliya.com"
                autoComplete="username"
                readOnly
                required
              />
            </div>

            <label className="water-login-label" htmlFor="password">Password</label>
            <div className="water-login-input-wrap">
              <span className="water-login-input-icon" aria-hidden="true">&bull;</span>
              <input
                id="password"
                name="password"
                className="water-login-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) => e.target.removeAttribute('readOnly')}
                placeholder="Enter password"
                autoComplete="current-password"
                readOnly
                required
              />
            </div>

            <button
              type="submit"
              className="water-login-submit"
              disabled={isFetching}
              aria-busy={isFetching}
            >
              {isFetching ? 'Signing in...' : 'Sign in to dashboard'}
            </button>
            <p className="water-login-note">Your browser can save credentials after a successful sign in.</p>
          </form>

          <Link className="water-login-back" to="/">&larr; Back to landing</Link>
        </motion.section>
      </div>
    </main>
  );
}

WaterLogin.propTypes = {
  dispatch: PropTypes.func.isRequired,
  isFetching: PropTypes.bool,
  errorMessage: PropTypes.string,
  location: PropTypes.object.isRequired,
};

WaterLogin.defaultProps = {
  isFetching: false,
  errorMessage: null,
};

export default withRouter(connect((state) => ({
  isFetching: state.auth.isFetching,
  errorMessage: state.auth.errorMessage,
}))(WaterLogin));
