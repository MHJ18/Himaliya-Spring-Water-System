import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { ArrowLeft, Building2, Droplets, Mail, MapPin, Moon, Phone, Save, Sun, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { getCustomerProfile, saveCustomerProfile } from '../../services/api/customerPortalApi';
import LoadingState from '../../components/LoadingState/LoadingState';
import './CustomerPortal.css';
import useCustomerTheme from './useCustomerTheme';

function CustomerProfile({ history }) {
  const { theme, setTheme } = useCustomerTheme();
  const [profile, setProfile] = React.useState(null);
  const [form, setForm] = React.useState({ name: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getCustomerProfile()
      .then((nextProfile) => {
        if (!active) return;
        if (!nextProfile) {
          history.replace('/customer/login', { completeProfile: true });
          return;
        }
        setProfile(nextProfile);
        setForm({
          name: nextProfile.name || '',
          email: nextProfile.email || '',
          phone: nextProfile.phone || '',
          address: nextProfile.address || '',
        });
      })
      .catch((error) => toast.error(error.message || 'Could not load your profile.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [history]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await saveCustomerProfile(form);
      setProfile(updated);
      toast.success('Profile details updated.');
    } catch (error) {
      toast.error(error.message || 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="customer-portal-page customer-profile-loading"><LoadingState label="Loading your profile..." variant="form" /></main>;
  if (!profile) return null;

  return (
    <main className={`customer-portal-page customer-profile-page customer-theme--${theme}`}>
      <header className="customer-profile-toolbar">
        <button type="button" className="customer-btn customer-btn--ghost" onClick={() => history.push('/customer/app')}>
          <ArrowLeft size={18} /> Back to dashboard
        </button>
        <div className="customer-profile-brand"><Droplets size={22} /><span>Himaliya Spring Water</span></div>
      </header>

      <motion.div className="customer-profile-layout" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <aside className="customer-portal-card customer-profile-identity">
          <span className="customer-profile-avatar customer-profile-avatar--large"><UserRound size={40} /></span>
          <h1>{profile.name}</h1>
          <p>Customer account</p>
          <div className="customer-contract">
            <p><Building2 size={17} /><span><small>Company</small><strong>{profile.companyName || 'Himaliya Spring Water'}</strong></span></p>
            <p><Mail size={17} /><span><small>Email</small><strong>{profile.email}</strong></span></p>
            <p><Phone size={17} /><span><small>Phone</small><strong>{profile.phone || 'Not provided'}</strong></span></p>
            <p><MapPin size={17} /><span><small>Delivery address</small><strong>{profile.address || 'Not provided'}</strong></span></p>
          </div>
        </aside>

        <section className="customer-portal-card customer-profile-editor">
          <div className="customer-card-heading">
            <span>Private profile</span>
            <h2>Contact and delivery details</h2>
          </div>
          <p className="customer-profile-intro">Keep these details current so every delivery reaches the right person and location.</p>
          <fieldset className="customer-theme-settings">
            <legend>Appearance</legend>
            <button type="button" className={theme === 'dark' ? 'is-active' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={18} /><span><strong>Dark</strong><small>Comfortable low-light dashboard</small></span></button>
            <button type="button" className={theme === 'light' ? 'is-active' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={18} /><span><strong>Light</strong><small>Bright daytime workspace</small></span></button>
          </fieldset>
          <form className="customer-profile-form customer-profile-form--page" onSubmit={submit}>
            <label>Full name<input value={form.name} onChange={update('name')} autoComplete="name" required /></label>
            <label>Email address<input type="email" value={form.email} onChange={update('email')} autoComplete="email" required /></label>
            <label>Phone number<input value={form.phone} onChange={update('phone')} autoComplete="tel" required /></label>
            <label className="customer-form-wide">Primary delivery address<textarea value={form.address} onChange={update('address')} autoComplete="street-address" required /></label>
            <div className="customer-btn-row customer-form-wide">
              <button type="submit" className="customer-btn" disabled={saving}><Save size={17} /> {saving ? 'Saving...' : 'Save changes'}</button>
            </div>
          </form>
        </section>
      </motion.div>
    </main>
  );
}

CustomerProfile.propTypes = { history: PropTypes.object.isRequired };

export default withRouter(CustomerProfile);
