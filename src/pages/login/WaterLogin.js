import React from 'react';
import PropTypes from 'prop-types';
import { Link, withRouter, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import { motion } from 'framer-motion';
import { ShakeX } from 'framer-motion-animations';
import {
  ArrowRight,
  AtSign,
  Droplets,
  LockKeyhole,
  Route,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { loginUser } from '../../actions/user';
import {
  consumeSessionExpiredNotice,
  hasStoredSessionType,
} from '../../services/cloud/supabaseClient';
import './WaterLogin.css';
import './AdminLogin.css';

function WaterLogin({ dispatch, isFetching = false, errorMessage = null, location }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [sessionExpired] = React.useState(() => {
    const storedNotice = consumeSessionExpiredNotice();
    return Boolean(location.state && location.state.sessionExpired) || storedNotice;
  });
  const from = (location.state && location.state.from) || { pathname: '/app/main/dashboard' };
  const visibleError = errorMessage || (sessionExpired
    ? 'Your session has expired. Log in again.'
    : location.state && location.state.passwordChanged ? 'Password updated. Sign in with your new password.' : '');

  if (hasStoredSessionType('admin')) {
    return <Redirect to={from} />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser({ email, password }));
  };

  return (
    <main className="water-login-page admin-login-page">
      <div className="water-login-shell admin-login-shell">
        <motion.section
          className="water-login-mobile-brand"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <span className="water-login-logo-mark"><Droplets size={23} /></span>
          <div>
            <h1>Himaliya Spring</h1>
            <p>Admin control room</p>
          </div>
        </motion.section>
        <motion.section
          className="water-login-copy admin-login-copy"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <span className="water-login-badge"><i /> Operations console</span>
          <h1>Run every delivery from one clear control room.</h1>
          <p>
            Move from order intake to rider dispatch and a complete sales ledger without losing sight of what needs attention.
          </p>
          <div className="admin-login-flow" aria-label="Admin workflow">
            <div><span><UsersRound size={18} /></span><strong>Orders</strong><small>Review demand</small></div>
            <i><b /></i>
            <div><span><Route size={18} /></span><strong>Riders</strong><small>Track routes</small></div>
            <i><b /></i>
            <div><span><WalletCards size={18} /></span><strong>Ledger</strong><small>Close the day</small></div>
          </div>
          <div className="admin-login-footnote"><ShieldCheck size={17} /><span>Private workspace · Owner access only</span></div>
        </motion.section>

        <motion.section
          className="water-login-card admin-login-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <div className="water-login-logo">
            <span className="water-login-logo-mark"><Droplets size={23} /></span>
            <div>
              <h2>Himaliya Spring</h2>
              <p>Admin control room</p>
            </div>
          </div>

          <div className="admin-login-heading">
            <span>Secure access</span>
            <h2>Welcome back.</h2>
            <p>Sign in to open today&apos;s operations.</p>
          </div>

          <form className="water-login-form" method="post" onSubmit={handleSubmit} autoComplete="on" noValidate>
            {visibleError && (
              <ShakeX key={visibleError} duration={0.4}>
                <div className={`water-login-alert ${location.state && location.state.passwordChanged && !errorMessage ? 'is-success' : ''}`} role="alert" aria-live="assertive">
                  <span className="water-login-alert-icon" aria-hidden="true">!</span>
                  <span>{visibleError}</span>
                </div>
              </ShakeX>
            )}

            <label className="water-login-label" htmlFor="email">Email address</label>
            <div className="water-login-input-wrap">
              <span className="water-login-input-icon" aria-hidden="true"><AtSign size={18} /></span>
              <input
                id="email"
                name="email"
                className="water-login-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@himaliya.com"
                autoComplete="username"
                required
              />
            </div>

            <label className="water-login-label" htmlFor="password">Password</label>
            <div className="water-login-input-wrap">
              <span className="water-login-input-icon" aria-hidden="true"><LockKeyhole size={18} /></span>
              <input
                id="password"
                name="password"
                className="water-login-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="water-login-submit"
              disabled={isFetching}
              aria-busy={isFetching}
            >
              <span>{isFetching ? 'Opening workspace...' : 'Open admin workspace'}</span>
              {!isFetching && <ArrowRight size={18} aria-hidden="true" />}
            </button>
            <div className="admin-login-form-meta">
              <p className="water-login-note"><ShieldCheck size={15} /> Protected administrator session</p>
              <Link className="water-login-forgot" to="/forgot-password?account=admin">Forgot password?</Link>
            </div>
          </form>

          <Link className="water-login-back" to="/"><ArrowRight size={15} /> Back to website</Link>
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

export default withRouter(connect((state) => ({
  isFetching: state.auth.isFetching,
  errorMessage: state.auth.errorMessage,
}))(WaterLogin));
