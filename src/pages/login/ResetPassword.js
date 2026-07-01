import React from 'react';
import PropTypes from 'prop-types';
import { Link, withRouter } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { clearStoredSession, updatePasswordWithToken } from '../../services/cloud/supabaseClient';
import './WaterLogin.css';

function ResetPassword({ location, history }) {
  const query = new URLSearchParams(location.search || '');
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const account = query.get('account') === 'customer' ? 'customer' : 'admin';
  const accessToken = hash.get('access_token');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!accessToken) { setError('This reset link is invalid or expired. Request a new one.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await updatePasswordWithToken(accessToken, password);
      clearStoredSession();
      history.replace(account === 'customer' ? '/customer/login' : '/login', { passwordChanged: true });
    } catch (err) {
      setError(err.message || 'This reset link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="water-login-page password-access-page">
      <motion.section className="water-login-card password-access-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <span className="password-access-icon"><KeyRound size={25} /></span>
        <span className="water-login-badge">Secure account update</span>
        <h1>Choose a new password</h1>
        <p>Use at least eight characters and avoid passwords used elsewhere.</p>
        <form className="water-login-form" onSubmit={submit}>
          {error && <div className="water-login-alert" role="alert">{error}</div>}
          <label className="water-login-label" htmlFor="new-password">New password</label>
          <div className="water-login-input-wrap"><input id="new-password" className="water-login-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></div>
          <label className="water-login-label" htmlFor="confirm-password">Confirm password</label>
          <div className="water-login-input-wrap"><input id="confirm-password" className="water-login-input" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required /></div>
          <button className="water-login-submit" type="submit" disabled={loading}>{loading ? 'Updating...' : 'Update password'}</button>
        </form>
        {!accessToken && <Link className="water-login-back" to={`/forgot-password?account=${account}`}>Request a new reset link</Link>}
      </motion.section>
    </main>
  );
}

ResetPassword.propTypes = { location: PropTypes.object.isRequired, history: PropTypes.object.isRequired };
export default withRouter(ResetPassword);
