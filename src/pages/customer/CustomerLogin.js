import React from 'react';
import PropTypes from 'prop-types';
import { Link, Redirect, withRouter } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'react-toastify';
import {
  ArrowRight,
  AtSign,
  Check,
  Droplets,
  LockKeyhole,
  MapPin,
  Phone,
  UserRound,
} from 'lucide-react';
import {
  beginCustomerProfileCompletion,
  finishCustomerEmailConfirmation,
  registerCustomer,
  requestCustomerPhoneVerification,
  signInCustomer,
  verifyCustomerPhoneAndCompleteProfile,
} from '../../services/api/customerPortalApi';
import {
  consumeSessionExpiredNotice,
  hasStoredSessionType,
  isCustomerEmailConfirmationCallback,
} from '../../services/cloud/supabaseClient';
import { isValidPhone } from '../../utils/validation';
import { useSettings } from '../../context/SettingsContext';
import '../login/WaterLogin.css';
import './CustomerPortal.css';
import './CustomerLogin.css';

function CustomerLogin({ location, history }) {
  const { settings } = useSettings();
  const [mode, setMode] = React.useState('signin');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [profileCompletionRequired, setProfileCompletionRequired] = React.useState(() => (
    Boolean(location.state && location.state.completeProfile)
  ));
  const [handlingConfirmation, setHandlingConfirmation] = React.useState(() => (
    isCustomerEmailConfirmationCallback(location.hash, location.search)
  ));
  const [phoneVerificationRequired, setPhoneVerificationRequired] = React.useState(false);
  const [verificationSent, setVerificationSent] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState('');
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

  React.useEffect(() => {
    if (!isCustomerEmailConfirmationCallback(location.hash, location.search)) return undefined;
    let cancelled = false;
    setHandlingConfirmation(true);
    setLoading(true);
    setError('');

    finishCustomerEmailConfirmation(location.hash, location.search)
      .then((result) => {
        if (cancelled || !result) return;
        if (result.profile) {
          toast.success('Email confirmed. Your customer history is ready.');
          history.replace('/customer/app');
          return;
        }

        setMode('signup');
        setProfileCompletionRequired(true);
        setForm((current) => ({
          ...current,
          ...(result.pendingProfile || {}),
          email: (result.session.user && result.session.user.email) || current.email,
          password: '',
        }));
        setPhoneVerificationRequired(Boolean(result.phoneVerificationRequired));
        setVerificationSent(Boolean(result.verificationSent));
        setVerificationCode('');
        if (result.phoneVerificationError) setError(result.phoneVerificationError);
        setNotice(result.phoneVerificationRequired && result.verificationSent
          ? `Email confirmed. Enter the SMS code sent to ${(result.pendingProfile && result.pendingProfile.phone) || 'your phone'}.`
          : 'Email confirmed. Add your delivery details to finish setting up your profile.');
        history.replace('/customer/login', { completeProfile: true, emailConfirmed: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setMode('signin');
        setProfileCompletionRequired(false);
        setError(err.message || 'This confirmation link is invalid or expired. Please sign in or register again.');
        history.replace('/customer/login');
      })
      .finally(() => {
        if (!cancelled) {
          setHandlingConfirmation(false);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [history, location.hash, location.search]);

  if (hasStoredSessionType('customer') && !profileCompletionRequired && !handlingConfirmation) {
    return <Redirect to="/customer/app" />;
  }

  const update = (field, value) => {
    setError('');
    setNotice('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const passwordValid = form.password.length >= 8;
  const passwordChecks = [
    { key: 'length', label: 'At least 8 characters', met: form.password.length >= 8 },
    { key: 'case', label: 'Upper and lower case letters', met: /[a-z]/.test(form.password) && /[A-Z]/.test(form.password) },
    { key: 'number', label: 'At least one number', met: /\d/.test(form.password) },
    { key: 'symbol', label: 'At least one symbol (e.g. ! ? #)', met: /[^A-Za-z0-9]/.test(form.password) },
  ];
  const verificationCodeValid = /^\d{6,10}$/.test(verificationCode.trim());
  const formErrors = mode === 'signup'
    ? {
      ...(!form.name.trim() ? { name: 'Full name is required.' } : {}),
      ...(!isValidPhone(form.phone) ? { phone: 'Enter a valid phone number (+92 and 10 digits).' } : {}),
      ...(!form.address.trim() ? { address: 'Delivery address is required.' } : {}),
      ...(!form.email.trim() ? { email: 'Email address is required.' } : (!/^\S+@\S+\.\S+$/.test(form.email.trim()) ? { email: 'Enter a valid email address.' } : {})),
      ...(!profileCompletionRequired && !passwordValid ? { password: 'Password must contain at least 8 characters.' } : {}),
    }
    : {
      ...(!form.email.trim() ? { identifier: 'Enter your email or phone number.' } : (!/^\S+@\S+\.\S+$/.test(form.email.trim()) && !isValidPhone(form.email) ? { identifier: 'Enter a valid email or phone number.' } : {})),
      ...(!form.password ? { password: 'Enter your password.' } : {}),
    };
  const canSubmit = !loading
    && Object.keys(formErrors).length === 0
    && (!phoneVerificationRequired || (verificationSent && verificationCodeValid));

  const applyPhoneVerificationState = (result) => {
    setProfileCompletionRequired(true);
    setMode('signup');
    setPhoneVerificationRequired(true);
    setVerificationSent(Boolean(result.verificationSent));
    setVerificationCode('');
    setError(result.phoneVerificationError || '');
    setNotice(result.verificationSent
      ? `Enter the SMS code sent to ${form.phone}.`
      : 'Phone verification is required to link the existing customer history.');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      let requiresSignIn = false;
      if (mode === 'signup') {
        if (profileCompletionRequired || hasStoredSessionType('customer')) {
          const profileForm = {
            name: form.name,
            email: form.email,
            phone: form.phone,
            address: form.address,
          };
          if (phoneVerificationRequired) {
            await verifyCustomerPhoneAndCompleteProfile(profileForm, verificationCode);
          } else {
            const completion = await beginCustomerProfileCompletion(profileForm);
            if (completion.phoneVerificationRequired) {
              applyPhoneVerificationState(completion);
              return;
            }
          }
          toast.success('Customer profile completed. Welcome to Himaliya Spring Water.');
        } else {
          const registration = await registerCustomer(form);
          if (registration && registration.confirmationRequired) {
            setMode('signin');
            setForm((current) => ({ ...current, password: '' }));
            setNotice(`Check ${registration.email} for a confirmation link to finish creating your account.`);
            return;
          }
          if (registration && registration.phoneVerificationRequired) {
            applyPhoneVerificationState(registration);
            return;
          }
          requiresSignIn = true;
          toast.success('Customer account created. Please sign in to continue.');
        }
      } else {
        const profile = await signInCustomer(form.email, form.password);
        if (!profile) {
          setMode('signup');
          setProfileCompletionRequired(true);
          throw new Error('No customer profile found. Complete your details to activate your customer portal.');
        }
      }
      if (requiresSignIn) {
        setMode('signin');
        setForm((current) => ({ ...current, password: '' }));
        history.replace('/customer/login', { accountCreated: true });
      } else {
        history.replace('/customer/app');
      }
    } catch (err) {
      const message = err.message || 'Could not continue. Please check your details.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resendPhoneCode = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await requestCustomerPhoneVerification(form.phone);
      setVerificationSent(true);
      setVerificationCode('');
      setNotice(`A new SMS code was sent to ${form.phone}.`);
    } catch (err) {
      setVerificationSent(false);
      setError(err.message || 'SMS verification could not be started.');
    } finally {
      setLoading(false);
    }
  };

  const visibleError = error || (sessionExpired ? 'Your session has expired. Log in again.' : '');
  const accountDeactivated = location.state && location.state.accountDeactivated
    ? 'This customer account has been deactivated. Contact Himaliya Spring Water.'
    : '';
  const loginNotice = location.state && location.state.passwordChanged
    ? 'Password updated. Sign in with your new password.'
    : location.state && location.state.accountCreated
      ? 'Account created. Sign in with your email and password.'
      : '';

  return (
    <main
      className={`water-login-page customer-login-page auth-layout-${settings.authLayout || 'split'}`}
      style={{
        '--customer-cyan': settings.authAccentColor || '#72e8f5',
        '--customer-surface': settings.authPanelColor || '#081827',
        '--customer-surface-strong': settings.authPanelColor || '#0d2434',
      }}
    >
      <div className="water-login-shell">
        <motion.section
          className="water-login-mobile-brand"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="water-login-logo-mark"><Droplets size={22} aria-hidden="true" /></span>
          <div>
            <h1>{settings.sidebarBrandTitle || settings.businessName || 'Himaliya Spring Water'}</h1>
            <p>Customer delivery portal</p>
          </div>
        </motion.section>

        {settings.showLoginStats !== false && (
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
            {/* <u> is the indeterminate bar track; its ::before is the sliver
                that runs across it on a continuous linear loop. */}
            <span className="is-current"><i>02</i><b>Deliver</b><u /></span>
            <span><i>03</i><b>Track</b></span>
          </div>
        </motion.section>
        )}

        <motion.section
          className="water-login-card customer-login-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <div className="water-login-logo">
            <span className="water-login-logo-mark"><Droplets size={23} aria-hidden="true" /></span>
            <div>
              <h2>{profileCompletionRequired ? 'Complete your profile' : mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
              <p>{profileCompletionRequired ? 'Add the delivery details for your confirmed email' : mode === 'signup' ? 'Set up your delivery profile' : 'Sign in to request a refill'}</p>
            </div>
          </div>

          {!profileCompletionRequired && (
            <div className="customer-auth-switch">
              <span>{mode === 'signin' ? 'New to Himaliya?' : 'Already registered?'}</span>
              <button
                type="button"
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                aria-controls="customer-auth-panel"
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in instead'}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}

          <form className="water-login-form customer-login-form" method="post" onSubmit={submit} autoComplete="on">
            {(visibleError || accountDeactivated || notice || loginNotice) && (
              <motion.div
                key={visibleError || accountDeactivated || notice || loginNotice}
                animate={{ x: [0, -8, 8, -5, 5, 0] }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <div className={`water-login-alert ${(notice || loginNotice) && !visibleError && !accountDeactivated ? 'is-success' : ''}`} role="alert" aria-live="assertive">
                  <span className="water-login-alert-icon" aria-hidden="true">!</span>
                  <span>{visibleError || accountDeactivated || notice || loginNotice}</span>
                </div>
              </motion.div>
            )}

            <motion.div
              id="customer-auth-panel"
              className="customer-login-form-shell"
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
                      <label className="water-login-label" htmlFor="customer-name">Full name <span aria-hidden="true">*</span></label>
                      <div className="water-login-input-wrap">
                        <span className="water-login-input-icon" aria-hidden="true"><UserRound size={18} /></span>
                        <input
                          id="customer-name"
                          name="name"
                          className="water-login-input"
                          value={form.name}
                          onChange={(e) => update('name', e.target.value)}
                          placeholder="e.g. Ayesha Khan"
                          autoComplete="name"
                          disabled={phoneVerificationRequired}
                          required
                        />
                      </div>

                      <label className="water-login-label" htmlFor="customer-phone">Phone number <span aria-hidden="true">*</span></label>
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
                          placeholder="+92 3XX XXXXXXX"
                          autoComplete="tel"
                          disabled={phoneVerificationRequired}
                          required
                        />
                      </div>

                      <label className="water-login-label" htmlFor="customer-address">Delivery address <span aria-hidden="true">*</span></label>
                      <div className="water-login-input-wrap">
                        <span className="water-login-input-icon" aria-hidden="true"><MapPin size={18} /></span>
                        <input
                          id="customer-address"
                          name="street-address"
                          className="water-login-input"
                          value={form.address}
                          onChange={(e) => update('address', e.target.value)}
                          placeholder="House, street, area, and city"
                          autoComplete="street-address"
                          disabled={phoneVerificationRequired}
                          required
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <label className="water-login-label" htmlFor="customer-email">{mode === 'signup' ? <>Email address <span aria-hidden="true">*</span></> : 'Email or phone number'}</label>
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
                  placeholder={mode === 'signup' ? 'name@example.com' : 'Email or +92 phone number'}
                  autoComplete="username"
                  disabled={phoneVerificationRequired}
                  required
                />
              </div>

              {phoneVerificationRequired && (
                <React.Fragment>
                  <label className="water-login-label" htmlFor="customer-phone-code">SMS verification code <span aria-hidden="true">*</span></label>
                  <div className={`water-login-input-wrap${verificationCode && !verificationCodeValid ? ' is-invalid' : ''}`}>
                    <span className="water-login-input-icon" aria-hidden="true"><Phone size={18} /></span>
                    <input
                      id="customer-phone-code"
                      name="one-time-code"
                      className="water-login-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={verificationCode}
                      onChange={(event) => {
                        setError('');
                        setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 10));
                      }}
                      placeholder="6-digit code"
                      autoComplete="one-time-code"
                      aria-invalid={verificationCode ? !verificationCodeValid : undefined}
                      disabled={!verificationSent}
                      required
                    />
                  </div>
                  <p className={`customer-password-hint${verificationCodeValid ? ' is-valid' : ''}`}>
                    {verificationSent ? 'Enter the 6–10 digit code from the SMS.' : 'SMS delivery must be configured before phone-only history can be linked.'}
                  </p>
                  <button
                    type="button"
                    className="water-login-back"
                    onClick={resendPhoneCode}
                    disabled={loading}
                  >
                    {verificationSent ? 'Send a new code' : 'Send verification code'}
                  </button>
                </React.Fragment>
              )}

              {!profileCompletionRequired && (
                <React.Fragment>
                  <label className="water-login-label" htmlFor="customer-password">Password {mode === 'signup' && <span aria-hidden="true">*</span>}</label>
                  <div className={`water-login-input-wrap${mode === 'signup' && form.password && !passwordValid ? ' is-invalid' : ''}`}>
                    <span className="water-login-input-icon" aria-hidden="true"><LockKeyhole size={18} /></span>
                    <input
                      id="customer-password"
                      name="password"
                      className="water-login-input"
                      type="password"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      aria-invalid={mode === 'signup' && form.password ? !passwordValid : undefined}
                      required
                    />
                  </div>
                </React.Fragment>
              )}
              {mode === 'signup' && !profileCompletionRequired && (
                <React.Fragment>
                  <ul className="customer-password-checklist" aria-label="Password requirements">
                    {passwordChecks.map((check) => (
                      <li key={check.key} className={check.met ? 'is-met' : ''}>
                        <span className="customer-password-checklist__icon" aria-hidden="true">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        {check.label}
                      </li>
                    ))}
                  </ul>
                  <p className="customer-password-hint">Fields marked * are required.</p>
                </React.Fragment>
              )}
            </motion.div>

            <button type="submit" className="water-login-submit" disabled={!canSubmit} aria-busy={loading}>
              <span>{loading ? 'Please wait...' : phoneVerificationRequired ? 'Verify phone and link history' : profileCompletionRequired ? 'Complete customer profile' : mode === 'signup' ? 'Create customer account' : 'Sign in and order'}</span>
              {!loading && <ArrowRight size={18} aria-hidden="true" />}
            </button>
            <p className="water-login-note">Existing invoices link only after the matching email or phone is verified through Supabase.</p>
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
