import React from 'react';
import PropTypes from 'prop-types';
import { Link, Redirect, withRouter } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShakeX } from 'framer-motion-animations';
import { toast } from 'react-toastify';
import {
  ArrowRight,
  AtSign,
  Droplets,
  LockKeyhole,
  MapPin,
  Phone,
  UserRound,
} from 'lucide-react';
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
import './CustomerLogin.css';

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
  const loginNotice = location.state && location.state.passwordChanged
    ? 'Password updated. Sign in with your new password.'
    : '';

  return (
    <main className="water-login-page customer-login-page">
      <div className="water-login-shell">
        <motion.section
          className="water-login-mobile-brand"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="water-login-logo-mark"><Droplets size={22} aria-hidden="true" /></span>
          <div>
            <h1>Himaliya Spring Water</h1>
            <p>Customer delivery portal</p>
          </div>
        </motion.section>

        <motion.section className="water-login-copy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="water-login-badge">Customer portal</span>
          <h1>Your next 19L refill is already within reach.</h1>
          <p>
            Order water, follow the route and review invoices from one focused customer account.
          </p>
          <div className="water-login-stats">
            <span><strong>19L</strong>refill requests</span>
            <span><strong>Live</strong>delivery status</span>
            <span><strong>Clear</strong>invoice history</span>
          </div>
          <div className="customer-login-route" aria-hidden="true">
            <span className="is-complete"><i>01</i><b>Request</b></span>
            <span className="is-current"><i>02</i><b>Deliver</b></span>
            <span><i>03</i><b>Track</b></span>
          </div>
        </motion.section>

        <motion.section
          className="water-login-card customer-login-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <div className="water-login-logo">
            <span className="water-login-logo-mark"><Droplets size={23} aria-hidden="true" /></span>
            <div>
              <h2>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
              <p>{mode === 'signup' ? 'Set up your delivery profile' : 'Sign in to request a refill'}</p>
            </div>
          </div>

          <div className="customer-login-tabs" role="tablist" aria-label="Customer login mode">
            {customerModes.map((tabMode) => (
              <button
                key={tabMode}
                type="button"
                role="tab"
                aria-selected={mode === tabMode}
                aria-controls="customer-auth-panel"
                className={mode === tabMode ? 'is-active' : ''}
                onClick={() => switchMode(tabMode)}
              >
                <span>{tabMode === 'signin' ? 'Sign in' : 'Create account'}</span>
              </button>
            ))}
          </div>

          <form className="water-login-form customer-login-form" method="post" onSubmit={submit} autoComplete="on">
            {(visibleError || loginNotice) && (
              <ShakeX key={visibleError} duration={0.4}>
                <div className={`water-login-alert ${loginNotice && !visibleError ? 'is-success' : ''}`} role="alert" aria-live="assertive">
                  <span className="water-login-alert-icon" aria-hidden="true">!</span>
                  <span>{visibleError || loginNotice}</span>
                </div>
              </ShakeX>
            )}

            <motion.div
              id="customer-auth-panel"
              className="customer-login-form-shell"
              layout
              transition={{ layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
            >
              <AnimatePresence initial={false}>
                {mode === 'signup' && (
                  <motion.div
                    key="customer-signup-fields"
                    className="customer-signup-fields"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.2, ease: 'easeOut' },
                    }}
                  >
                    <div className="customer-signup-fields__inner">
                      <label className="water-login-label" htmlFor="customer-name">Full name</label>
                      <div className="water-login-input-wrap">
                        <span className="water-login-input-icon" aria-hidden="true"><UserRound size={18} /></span>
                        <input
                          id="customer-name"
                          name="name"
                          className="water-login-input"
                          value={form.name}
                          onChange={(e) => update('name', e.target.value)}
                          placeholder="Your full name"
                          autoComplete="name"
                          required
                        />
                      </div>

                      <label className="water-login-label" htmlFor="customer-phone">Phone number</label>
                      <div className="water-login-input-wrap">
                        <span className="water-login-input-icon" aria-hidden="true"><Phone size={18} /></span>
                        <input
                          id="customer-phone"
                          name="tel"
                          className="water-login-input"
                          type="tel"
                          inputMode="tel"
                          value={form.phone}
                          onChange={(e) => update('phone', e.target.value)}
                          placeholder="+92 300 0000000"
                          autoComplete="tel"
                          required
                        />
                      </div>

                      <label className="water-login-label" htmlFor="customer-address">Delivery address</label>
                      <div className="water-login-input-wrap">
                        <span className="water-login-input-icon" aria-hidden="true"><MapPin size={18} /></span>
                        <input
                          id="customer-address"
                          name="street-address"
                          className="water-login-input"
                          value={form.address}
                          onChange={(e) => update('address', e.target.value)}
                          placeholder="Street, area, city"
                          autoComplete="street-address"
                          required
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <label className="water-login-label" htmlFor="customer-email">{mode === 'signup' ? 'Email address' : 'Email or phone number'}</label>
              <div className="water-login-input-wrap">
                <span className="water-login-input-icon" aria-hidden="true"><AtSign size={18} /></span>
                <input
                  id="customer-email"
                  name="username"
                  className="water-login-input"
                  type={mode === 'signup' ? 'email' : 'text'}
                  inputMode={mode === 'signup' ? 'email' : 'text'}
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder={mode === 'signup' ? 'you@email.com' : 'Email or +92 phone number'}
                  autoComplete="username"
                  required
                />
              </div>

              <label className="water-login-label" htmlFor="customer-password">Password</label>
              <div className="water-login-input-wrap">
                <span className="water-login-input-icon" aria-hidden="true"><LockKeyhole size={18} /></span>
                <input
                  id="customer-password"
                  name="password"
                  className="water-login-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                />
              </div>
            </motion.div>

            <button type="submit" className="water-login-submit" disabled={loading} aria-busy={loading}>
              <span>{loading ? 'Please wait...' : mode === 'signup' ? 'Create customer account' : 'Sign in and order'}</span>
              {!loading && <ArrowRight size={18} aria-hidden="true" />}
            </button>
            <p className="water-login-note">Use the same phone/email from your Himaliya Spring Water contract to link invoices automatically.</p>
            {mode === 'signin' && <Link className="water-login-forgot" to="/forgot-password?account=customer">Forgot password?</Link>}
          </form>

          <div className="customer-login-links">
            <Link className="water-login-back" to="/">&larr; Back to landing</Link>
            <Link className="water-login-back" to="/login">Admin login</Link>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

CustomerLogin.propTypes = {
  location: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};

export default withRouter(CustomerLogin);
