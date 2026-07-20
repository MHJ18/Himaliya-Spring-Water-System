import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { toast } from 'react-toastify';
import { changeSignedInPassword } from '../../services/cloud/supabaseClient';

export default function PasswordChangeForm({ email, compact }) {
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' });
  const [visible, setVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (form.next.length < 8) {
      toast.error('Use at least 8 characters for the new password.');
      return;
    }
    if (form.next !== form.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await changeSignedInPassword(email, form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed successfully.');
    } catch (error) {
      toast.error(/invalid login|invalid credentials/i.test(error.message || '')
        ? 'Current password is incorrect.'
        : error.message || 'Could not change password.');
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, autoComplete) => (
    <TextField
      key={name}
      label={label}
      type={visible ? 'text' : 'password'}
      value={form[name]}
      onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
      autoComplete={autoComplete}
      required
      fullWidth
      InputProps={name === 'current' ? {
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              edge="end"
              onClick={() => setVisible((value) => !value)}
              aria-label={visible ? 'Hide passwords' : 'Show passwords'}
            >
              {visible ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      } : undefined}
    />
  );

  return (
    <Box component="form" onSubmit={submit}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
        <Box sx={{
          display: 'grid',
          width: 40,
          height: 40,
          flex: '0 0 auto',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'rgba(29, 155, 240, 0.1)',
          borderRadius: 2,
        }}
        >
          <KeyRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>Change password</Typography>
          <Typography variant="caption" color="text.secondary">
            Confirm your current password before choosing a new one.
          </Typography>
        </Box>
      </Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: compact ? { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } : '1fr',
        gap: 1.5,
      }}
      >
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password', 'new-password')}
        {field('confirm', 'Confirm new password', 'new-password')}
      </Box>
      <Button
        type="submit"
        variant="contained"
        startIcon={<SaveRoundedIcon />}
        disabled={saving}
        sx={{ mt: 2 }}
      >
        {saving ? 'Updating...' : 'Update password'}
      </Button>
    </Box>
  );
}

PasswordChangeForm.propTypes = {
  email: PropTypes.string.isRequired,
  compact: PropTypes.bool,
};

PasswordChangeForm.defaultProps = {
  compact: false,
};
