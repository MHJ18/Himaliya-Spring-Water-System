import React from 'react';
import PropTypes from 'prop-types';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'react-toastify';
import { changeSignedInPassword } from '../../services/cloud/supabaseClient';
import './PasswordChangeForm.css';

export default function PasswordChangeForm({ email, compact }) {
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' });
  const [visible, setVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (form.next.length < 8) { toast.error('Use at least 8 characters for the new password.'); return; }
    if (form.next !== form.confirm) { toast.error('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await changeSignedInPassword(email, form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed successfully.');
    } catch (error) {
      toast.error(/invalid login|invalid credentials/i.test(error.message || '') ? 'Current password is incorrect.' : error.message || 'Could not change password.');
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, autoComplete) => (
    <label>{label}<input type={visible ? 'text' : 'password'} value={form[name]} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} autoComplete={autoComplete} required /></label>
  );

  return (
    <form className={`password-change-form ${compact ? 'is-compact' : ''}`} onSubmit={submit}>
      <div className="password-change-heading"><KeyRound size={20} /><div><strong>Change password</strong><span>Confirm your current password before choosing a new one.</span></div></div>
      {field('current', 'Current password', 'current-password')}
      {field('next', 'New password', 'new-password')}
      {field('confirm', 'Confirm new password', 'new-password')}
      <div className="password-change-actions"><button type="button" className="password-visibility" onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />} {visible ? 'Hide' : 'Show'}</button><button type="submit" className="customer-btn" disabled={saving}>{saving ? 'Updating...' : 'Update password'}</button></div>
    </form>
  );
}

PasswordChangeForm.propTypes = { email: PropTypes.string.isRequired, compact: PropTypes.bool };
PasswordChangeForm.defaultProps = { compact: false };
