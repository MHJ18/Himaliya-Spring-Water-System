import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { getCustomerProfile, saveCustomerProfile } from '../../services/api/customerPortalApi';
import LoadingState from '../../components/LoadingState/LoadingState';
import useCustomerTheme from './useCustomerTheme';
import PasswordChangeForm from '../../components/PasswordChangeForm/PasswordChangeForm';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';

function buildCustomerTheme(theme) {
  const dark = theme === 'dark';
  return createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: { main: '#0896c4' },
      background: dark
        ? { default: '#07111f', paper: '#0d2133' }
        : { default: '#edf8fc', paper: '#ffffff' },
      text: dark
        ? { primary: '#f2fbff', secondary: '#9fc4d5' }
        : { primary: '#102a3d', secondary: '#607c8d' },
      divider: dark ? 'rgba(125, 223, 255, 0.14)' : '#d7eaf2',
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      button: { textTransform: 'none', fontWeight: 750 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 46,
            paddingRight: 18,
            paddingLeft: 18,
            borderRadius: 999,
            transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
            '&:hover': { transform: 'translateY(-1px)' },
            '&:active': { transform: 'translateY(0)' },
            '&:focus-visible': { outline: '3px solid rgba(8, 150, 196, .24)', outlineOffset: 2 },
          },
          containedPrimary: {
            color: '#042433',
            background: 'linear-gradient(135deg, #b9f7ff 0%, #65dff2 54%, #55a8ff 100%)',
            boxShadow: '0 12px 28px rgba(8, 150, 196, .2)',
            '&:hover': {
              background: 'linear-gradient(135deg, #cdfaff 0%, #76e5f4 54%, #69b4ff 100%)',
              boxShadow: '0 16px 34px rgba(8, 150, 196, .26)',
            },
          },
          outlined: {
            borderWidth: 1,
            '&:hover': { borderWidth: 1 },
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: dark ? '1px solid rgba(125, 223, 255, 0.14)' : '1px solid #d7eaf2',
            boxShadow: dark ? '0 20px 50px rgba(0, 0, 0, .24)' : '0 18px 46px rgba(25, 79, 105, .1)',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: { root: { minHeight: 46, borderRadius: 12 } },
      },
    },
  });
}

function PreferenceSwitch({
  label, description, checked, onChange, icon,
}) {
  return (
    <Box sx={{
      display: 'flex',
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1.25,
      p: 1.25,
      bgcolor: checked ? 'rgba(8, 150, 196, .09)' : 'action.hover',
      border: '1px solid',
      borderColor: checked ? 'rgba(8, 150, 196, .3)' : 'divider',
      borderRadius: 2.5,
      boxShadow: checked ? '0 8px 24px rgba(8, 150, 196, .08)' : 'none',
      transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
    }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Box sx={{
          display: 'grid',
          width: 40,
          height: 40,
          flex: '0 0 40px',
          placeItems: 'center',
          color: checked ? 'primary.main' : 'text.secondary',
          bgcolor: checked ? 'rgba(8, 150, 196, .14)' : 'action.selected',
          borderRadius: 2,
          '& svg': { fontSize: 21 },
        }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={750}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Box>
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: '0 0 auto' }}>
        <Typography
          variant="caption"
          sx={{ display: { xs: 'none', sm: 'block' }, color: checked ? 'primary.main' : 'text.secondary', fontWeight: 850 }}
        >
          {checked ? 'On' : 'Off'}
        </Typography>
        <Switch
          checked={Boolean(checked)}
          onChange={onChange}
          inputProps={{ 'aria-label': label }}
          sx={{
            width: 52,
            height: 30,
            p: 0,
            '& .MuiSwitch-switchBase': {
              p: '3px',
              '&.Mui-checked': {
                color: '#fff',
                transform: 'translateX(22px)',
                '& + .MuiSwitch-track': { opacity: 1, bgcolor: 'primary.main' },
              },
            },
            '& .MuiSwitch-thumb': { width: 24, height: 24, boxShadow: '0 3px 9px rgba(0,0,0,.22)' },
            '& .MuiSwitch-track': { opacity: 1, bgcolor: 'action.disabled', borderRadius: 15 },
          }}
        />
      </Stack>
    </Box>
  );
}

function CustomerProfile({ history }) {
  const { theme, setTheme } = useCustomerTheme();
  const [profile, setProfile] = React.useState(null);
  const [form, setForm] = React.useState({ name: '', email: '', phone: '', address: '' });
  const [preferences, setPreferences] = React.useState({
    theme: 'dark',
    browserNotifications: true,
    orderUpdates: true,
    invoiceAlerts: true,
    defaultBottleType: 'Gallon',
    defaultQuantity: 1,
  });
  const [tab, setTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const customerTheme = React.useMemo(() => buildCustomerTheme(theme), [theme]);

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
        setPreferences((current) => ({ ...current, ...(nextProfile.preferences || {}) }));
        setTheme(nextProfile.preferences && nextProfile.preferences.theme);
      })
      .catch((error) => toast.error(error.message || 'Could not load your profile.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [history, setTheme]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updatePreference = (field, value) => {
    setPreferences((current) => ({ ...current, [field]: value }));
    if (field === 'theme') setTheme(value);
  };

  const save = async (event, successMessage) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await saveCustomerProfile({ ...form, preferences });
      setProfile(updated);
      setPreferences((current) => ({ ...current, ...(updated.preferences || {}) }));
      toast.success(successMessage);
    } catch (error) {
      toast.error(error.message || 'Could not update your settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading your profile..." variant="customer-profile" className={`customer-theme--${theme}`} />;
  }
  if (!profile) return null;

  return (
    <ThemeProvider theme={customerTheme}>
      <Box
        component="main"
        sx={{
          minHeight: '100dvh',
          p: { xs: 1.5, sm: 2.5, md: 4 },
          color: 'text.primary',
          bgcolor: 'background.default',
          backgroundImage: theme === 'dark'
            ? 'radial-gradient(circle at 12% 0%, rgba(41,171,255,.15), transparent 30rem), radial-gradient(circle at 90% 8%, rgba(77,95,255,.12), transparent 30rem)'
            : 'radial-gradient(circle at 10% 0%, rgba(61,190,239,.13), transparent 28rem), radial-gradient(circle at 94% 18%, rgba(14,116,144,.09), transparent 30rem)',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 1040, mx: 'auto' }}>
          <Box
            component="header"
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column-reverse', sm: 'row' },
              gap: 1.5,
              mb: 2.5,
            }}
          >
            <Button
              color="inherit"
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => history.push('/customer/app')}
            >
              Back to dashboard
            </Button>
            <Stack direction="row" alignItems="center" spacing={1} color="primary.main">
              <WaterDropRoundedIcon />
              <Typography fontWeight={800}>Himaliya Spring Water</Typography>
            </Stack>
          </Box>

          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
          >
            <Card sx={{ mb: 2.5 }}>
              <CardHeader
                avatar={(
                  <Box sx={{
                    display: 'grid',
                    width: 48,
                    height: 48,
                    placeItems: 'center',
                    color: 'primary.main',
                    bgcolor: 'rgba(8, 150, 196, .12)',
                    borderRadius: 2,
                  }}
                  >
                    <PersonOutlineRoundedIcon />
                  </Box>
                )}
                title="Profile & preferences"
                subheader="Manage your delivery details, ordering defaults, notifications, and password."
                titleTypographyProps={{ variant: 'h5', fontWeight: 800 }}
              />
              <Tabs
                value={tab}
                onChange={(event, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Customer settings sections"
                sx={{ px: 1 }}
              >
                <Tab icon={<PersonOutlineRoundedIcon />} iconPosition="start" label="Account" />
                <Tab icon={<TuneRoundedIcon />} iconPosition="start" label="Preferences" />
                <Tab icon={<SecurityRoundedIcon />} iconPosition="start" label="Security" />
              </Tabs>
            </Card>

            {tab === 0 && (
              <Card>
                <CardHeader
                  title="Contact and delivery details"
                  subheader="Keep this current so each order reaches the right person and address."
                />
                <CardContent>
                  <Box component="form" onSubmit={(event) => save(event, 'Profile details updated.')}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField label="Full name" value={form.name} onChange={update('name')} autoComplete="name" required fullWidth />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField label="Email address" type="email" value={form.email} onChange={update('email')} autoComplete="email" required fullWidth />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField label="Phone number" value={form.phone} onChange={update('phone')} autoComplete="tel" required fullWidth />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Primary delivery address"
                          value={form.address}
                          onChange={update('address')}
                          autoComplete="street-address"
                          multiline
                          minRows={3}
                          required
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                    <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} disabled={saving} sx={{ mt: 2 }}>
                      {saving ? 'Saving...' : 'Save profile'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}

            {tab === 1 && (
              <Card>
                <CardHeader
                  title="Portal preferences"
                  subheader="These settings follow your account across devices."
                />
                <CardContent>
                  <Box component="form" onSubmit={(event) => save(event, 'Portal preferences saved.')}>
                    <Typography variant="overline" color="text.secondary">Appearance</Typography>
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      value={preferences.theme}
                      onChange={(event, value) => value && updatePreference('theme', value)}
                      sx={{ mt: 0.5, mb: 2 }}
                    >
                      <ToggleButton value="light"><LightModeRoundedIcon sx={{ mr: 1 }} />Light</ToggleButton>
                      <ToggleButton value="dark"><DarkModeRoundedIcon sx={{ mr: 1 }} />Dark</ToggleButton>
                    </ToggleButtonGroup>

                    <Divider />
                    <Stack spacing={1} sx={{ mt: 1.5, mb: 2 }}>
                      <PreferenceSwitch
                        label="Browser notifications"
                        description="Allow invoice and delivery alerts on supported devices."
                        checked={preferences.browserNotifications}
                        onChange={(event) => updatePreference('browserNotifications', event.target.checked)}
                        icon={<NotificationsActiveRoundedIcon />}
                      />
                      <PreferenceSwitch
                        label="Order status updates"
                        description="Show in-app confirmation when an order is delivered."
                        checked={preferences.orderUpdates}
                        onChange={(event) => updatePreference('orderUpdates', event.target.checked)}
                        icon={<LocalShippingRoundedIcon />}
                      />
                      <PreferenceSwitch
                        label="Invoice alerts"
                        description="Notify you when a new invoice is registered."
                        checked={preferences.invoiceAlerts}
                        onChange={(event) => updatePreference('invoiceAlerts', event.target.checked)}
                        icon={<ReceiptLongRoundedIcon />}
                      />
                    </Stack>

                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={12} sm={7}>
                        <FormControl fullWidth>
                          <InputLabel id="default-bottle-label">Default bottle type</InputLabel>
                          <Select
                            labelId="default-bottle-label"
                            label="Default bottle type"
                            value={preferences.defaultBottleType}
                            onChange={(event) => updatePreference('defaultBottleType', event.target.value)}
                          >
                            {BOTTLE_TYPES.map((type) => (
                              <MenuItem key={type} value={type}>{BOTTLE_TYPE_LABELS[type] || type}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={5}>
                        <TextField
                          label="Default quantity"
                          type="number"
                          value={preferences.defaultQuantity}
                          onChange={(event) => updatePreference('defaultQuantity', Math.max(1, Number(event.target.value) || 1))}
                          inputProps={{ min: 1, max: 99 }}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                    <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} disabled={saving} sx={{ mt: 2 }}>
                      {saving ? 'Saving...' : 'Save preferences'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}

            {tab === 2 && (
              <Card>
                <CardHeader title="Account security" subheader="Use a unique password with at least eight characters." />
                <CardContent>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    You will remain signed in on this device after changing your password.
                  </Alert>
                  <PasswordChangeForm email={profile.email} />
                </CardContent>
              </Card>
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

CustomerProfile.propTypes = {
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
    replace: PropTypes.func.isRequired,
  }).isRequired,
};

export default withRouter(CustomerProfile);
