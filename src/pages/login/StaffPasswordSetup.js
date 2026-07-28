import React from 'react';
import { Redirect, withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  completeTemporaryPasswordChange,
  getStoredSessionType,
  hasStoredSession,
  isPasswordChangeRequired,
  signOut,
} from '../../services/cloud/supabaseClient';
import './StaffPasswordSetup.css';

export function isStrongStaffPassword(value) {
  return value.length >= 8
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

function StaffPasswordSetup({ history }) {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [touched, setTouched] = React.useState({ password: false, confirm: false });
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const sessionType = getStoredSessionType();
  const destination = sessionType === 'rider' ? '/rider/app' : '/app/main/dashboard';
  const passwordValid = isStrongStaffPassword(password);
  const confirmationValid = Boolean(confirmPassword) && password === confirmPassword;
  const formValid = passwordValid && confirmationValid;

  if (!hasStoredSession()) return <Redirect to="/login" />;
  if (!isPasswordChangeRequired()) return <Redirect to={destination} />;

  const submit = async (event) => {
    event.preventDefault();
    setTouched({ password: true, confirm: true });
    if (!passwordValid) {
      setError('Create a password that meets every requirement below.');
      return;
    }
    if (!confirmationValid) {
      setError('The confirmation password does not match.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await completeTemporaryPasswordChange(password);
      history.replace(destination, { passwordChanged: true });
    } catch (requestError) {
      setError(requestError.message || 'Your password could not be updated. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    await signOut();
    history.replace('/login');
  };

  return (
    <main className="staff-password-page">
      <section className="staff-password-card">
        <span className="staff-password-icon"><KeyRound /></span>
        <span className="staff-password-kicker"><ShieldCheck size={15} /> First sign-in security</span>
        <h1>Create your new password</h1>
        <p>The password given to you was temporary. Replace it before opening your workspace.</p>

        {error && <div className="staff-password-error" role="alert">{error}</div>}

        <form onSubmit={submit} noValidate>
          <label htmlFor="staff-new-password">New password <span aria-hidden="true">*</span></label>
          <div className={`staff-password-input${touched.password && !passwordValid ? ' is-invalid' : ''}`}>
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="staff-new-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(''); }}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
              autoComplete="new-password"
              aria-invalid={touched.password && !passwordValid}
              required
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide new password' : 'Show new password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <small className={touched.password && !passwordValid ? 'is-invalid' : ''}>
            Required: 8+ characters with uppercase, lowercase, a number, and a special character.
          </small>

          <label htmlFor="staff-confirm-password">Confirm new password <span aria-hidden="true">*</span></label>
          <div className={`staff-password-input${touched.confirm && !confirmationValid ? ' is-invalid' : ''}`}>
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="staff-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }}
              onBlur={() => setTouched((current) => ({ ...current, confirm: true }))}
              autoComplete="new-password"
              aria-invalid={touched.confirm && !confirmationValid}
              required
            />
            <button type="button" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}>
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {touched.confirm && !confirmationValid && (
            <small className="is-invalid">Enter the same password again.</small>
          )}

          <button className="staff-password-submit" type="submit" disabled={!formValid || submitting}>
            {submitting ? 'Saving new password…' : 'Save password and continue'}
          </button>
          <button className="staff-password-cancel" type="button" onClick={cancel} disabled={submitting}>Sign out</button>
        </form>
      </section>
    </main>
  );
}

StaffPasswordSetup.propTypes = {
  history: PropTypes.shape({ replace: PropTypes.func.isRequired }).isRequired,
};

export default withRouter(StaffPasswordSetup);
