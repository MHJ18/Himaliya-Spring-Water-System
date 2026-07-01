import React from 'react';
import PropTypes from 'prop-types';
import { Link, withRouter } from 'react-router-dom';
import { Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { requestPasswordReset } from '../../services/cloud/supabaseClient';
import './WaterLogin.css';

function ForgotPassword({ location }) {
  const params = new URLSearchParams(location.search || '');
  const account = params.get('account') === 'customer' ? 'customer' : 'admin';
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState('');

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/reset-password?account=${account}`;
      await requestPasswordReset(email, redirectTo);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send the reset email. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="water-login-page password-access-page">
      <motion.section className="water-login-card password-access-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <span className="password-access-icon"><Mail size={25} /></span>
        <span className="water-login-badge">{account === 'customer' ? 'Customer recovery' : 'Admin recovery'}</span>
        <h1>Reset your password</h1>
        <p>Enter your account email and we will send a secure password-reset link.</p>
        {sent ? (
          <div className="password-access-success" role="status"><ShieldCheck size={22} /><div><strong>Check your email</strong><span>If an account exists, a reset link has been sent.</span></div></div>
        ) : (
          <form className="water-login-form" onSubmit={submit}>
            {error && <div className="water-login-alert" role="alert">{error}</div>}
            <label className="water-login-label" htmlFor="recovery-email">Email address</label>
            <div className="water-login-input-wrap"><span className="water-login-input-icon">@</span><input id="recovery-email" className="water-login-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
            <button className="water-login-submit" type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
          </form>
        )}
        <Link className="water-login-back" to={account === 'customer' ? '/customer/login' : '/login'}>&larr; Back to sign in</Link>
      </motion.section>
    </main>
  );
}

ForgotPassword.propTypes = { location: PropTypes.object.isRequired };
export default withRouter(ForgotPassword);
