import React from 'react';
import PropTypes from 'prop-types';
import { Link, Redirect, withRouter } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ShakeX } from 'framer-motion-animations';
import { toast } from 'react-toastify';
import {
  registerCustomer,
  saveCustomerProfile,
  signInCustomer,
} from '../../services/api/customerPortalApi';
import {
  consumeSessionExpiredNotice,
  hasStoredSessionType,
} from '../../services/cloud/supabaseClient';
import '../login/WaterLogin.css';
import './CustomerPortal.css';

const customerModes = ['signin', 'signup'];

function CustomerLogin({ location, history }) {
  const [mode, setMode] = React.useState('signin');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [profileCompletionRequired, setProfileCompletionRequired] = React.useState(() => (
    Boolean(location.state && location.state.completeProfile)
  ));
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
  });
  const [sessionExpired] = React.useState(() => {
    const storedNotice = consumeSessionExpiredNotice();
    return Boolean(location.state && location.state.sessionExpired) || storedNotice;
  });

  if (hasStoredSessionType('customer') && !profileCompletionRequired) {
    return <Redirect to="/customer/app" />;
  }

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        if (profileCompletionRequired || hasStoredSessionType('customer')) {
          await saveCustomerProfile({
            name: form.name,
            email: form.email,
            phone: form.phone,
            address: form.address,
          });
          toast.success('Customer profile completed. Welcome to Himaliya Spring Water.');
        } else {
          await registerCustomer(form);
          toast.success('Customer account created. Welcome to Himaliya Spring Water.');
        }
      } else {
        const profile = await signInCustomer(form.email, form.password);
        if (!profile) {
          setMode('signup');
          setProfileCompletionRequired(true);
          throw new Error('No customer profile found. Complete your details to activate your customer portal.');
        }
      }
      history.replace('/customer/app');
    } catch (err) {
      const message = err.message || 'Could not continue. Please check your details.';
      setError(message.includes('Email not confirmed')
        ? 'Email confirmation is still enabled in Supabase. Turn off Confirm Email in Authentication > Providers > Email, then signup will work immediately.'
        : message);
    } finally {
      setLoading(false);
    }
  };

  const visibleError = error || (sessionExpired ? 'Your session has expired. Log in again.' : '');

  return (
    <main className="water-login-page customer-login-page">
      <div className="water-login-shell">
        <motion.section
          className="water-login-mobile-brand"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="water-login-logo-mark">HS</span>
          <div>
            <h1>Himaliya Spring Water</h1>
            <p>Customer delivery portal</p>
          </div>
        </motion.section>

        <motion.section className="water-login-copy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="water-login-badge">Customer portal</span>
          <h1>Order 19L water gallons without calling the office.</h1>
          <p>
            Place delivery requests, see accepted/delivered updates, review paid and unpaid invoices,
            and keep your contract details in one simple account.
          </p>
          <div className="water-login-stats">
            <span><strong>19L</strong>gallon orders</span>
            <span><strong>Live</strong>order status</span>
            <span><strong>Live</strong>invoice status</span>
          </div>
        </motion.section>

        <section className="water-login-card customer-login-card">
          <div className="water-login-logo">
            <span className="water-login-logo-mark">HS</span>
            <div>
              <h2>Customer access</h2>
              <p>{mode === 'signup' ? 'Create your portal account' : 'Sign in to order water'}</p>
            </div>
          </div>

          <LayoutGroup id="customer-login-tabs">
            <div className="customer-login-tabs" role="tablist" aria-label="Customer login mode">
              {customerModes.map((tabMode) => (
                <button
                  key={tabMode}
                  type="button"
                  role="tab"
                  aria-selected={mode === tabMode}
                  className={mode === tabMode ? 'is-active' : ''}
                  onClick={() => switchMode(tabMode)}
                >
                  {mode === tabMode && (
                    <motion.span
                      className="customer-login-tab-indicator"
                      layoutId="customer-login-tab-indicator"
                      transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }}
                    />
                  )}
                  <span>{tabMode === 'signin' ? 'Sign in' : 'Create account'}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>

          <form className="water-login-form customer-login-form" method="post" onSubmit={submit} autoComplete="on">
            {visibleError && (
              <ShakeX key={visibleError} duration={0.4}>
                <div className="water-login-alert" role="alert" aria-live="assertive">
                  <span className="water-login-alert-icon" aria-hidden="true">!</span>
                  <span>{visibleError}</span>
                </div>
              </ShakeX>
            )}

            <div className="customer-login-form-shell">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={mode}
                  className="customer-login-form-panel"
                  initial={{ opacity: 0, y: mode === 'signup' ? 14 : -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: mode === 'signup' ? -10 : 10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                {mode === 'signup' && (
                  <>
                    <label className="water-login-label" htmlFor="customer-name">Full name</label>
                    <div className="water-login-input-wrap">
                      <span className="water-login-input-icon" aria-hidden="true">ID</span>
                      <input id="customer-name" className="water-login-input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Your full name" autoComplete="name" required />
                    </div>
                  </>
                )}

                <label className="water-login-label" htmlFor="customer-email">Email address</label>
                <div className="water-login-input-wrap">
                  <span className="water-login-input-icon" aria-hidden="true">@</span>
                  <input id="customer-email" className="water-login-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@email.com" autoComplete="username" required />
                </div>

                {mode === 'signup' && (
                  <>
                    <label className="water-login-label" htmlFor="customer-phone">Phone number</label>
                    <div className="water-login-input-wrap">
                      <span className="water-login-input-icon" aria-hidden="true">PH</span>
                      <input id="customer-phone" className="water-login-input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+92 300 0000000" autoComplete="tel" required />
                    </div>

                    <label className="water-login-label" htmlFor="customer-address">Delivery address</label>
                    <div className="water-login-input-wrap">
                      <span className="water-login-input-icon" aria-hidden="true">AD</span>
                      <input id="customer-address" className="water-login-input" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street, area, city" autoComplete="street-address" required />
                    </div>
                  </>
                )}

                <label className="water-login-label" htmlFor="customer-password">Password</label>
                <div className="water-login-input-wrap">
                  <span className="water-login-input-icon" aria-hidden="true">&bull;</span>
                  <input id="customer-password" className="water-login-input" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
                </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <button type="submit" className="water-login-submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create customer account' : 'Sign in and order'}
            </button>
            <p className="water-login-note">Use the same phone/email from your Himaliya Spring Water contract to link invoices automatically.</p>
          </form>

          <div className="customer-login-links">
            <Link className="water-login-back" to="/">&larr; Back to landing</Link>
            <Link className="water-login-back" to="/login">Admin login</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

CustomerLogin.propTypes = {
  location: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};

export default withRouter(CustomerLogin);
