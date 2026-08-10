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
  Typography,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import ColorLensRoundedIcon from '@mui/icons-material/ColorLensRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CookieRoundedIcon from '@mui/icons-material/CookieRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { LayoutGroup, motion } from 'motion/react';
import { toast } from 'react-toastify';
import { getCustomerProfile, saveCustomerProfile } from '../../services/api/customerPortalApi';
import LoadingState from '../../components/LoadingState/LoadingState';
import useCustomerTheme from './useCustomerTheme';
import PasswordChangeForm from '../../components/PasswordChangeForm/PasswordChangeForm';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';

// Mirrors the .customer-accent--* custom properties in CustomerPortal.css so
// the swatch a customer picks matches the colour the dashboard actually uses.
const ACCENT_SWATCHES = [
  { value: 'aqua', label: 'Aqua', color: '#078eb4', light: '#37c8dd' },
  { value: 'blue', label: 'Blue', color: '#2f6fed', light: '#68a3ff' },
  { value: 'violet', label: 'Violet', color: '#7357d8', light: '#aa7cf3' },
  { value: 'emerald', label: 'Green', color: '#11875d', light: '#4acb92' },
];

// Each preview mirrors the actual page background for that appearance, so the
// swatch is a real sample rather than a decorative colour chip.
const APPEARANCE_OPTIONS = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright surfaces for daytime',
    accent: '#078eb4',
    swatches: ['#f4fbfe', '#cbe7f2', '#078eb4'],
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low glare for evening use',
    accent: '#37c8dd',
    swatches: ['#07111f', '#0a1724', '#37c8dd'],
  },
  {
    value: 'dark-gradient',
    label: 'Dark gradient',
    description: 'Deep tones with a colour wash',
    accent: '#7b5cff',
    swatches: ['#061927', '#140d2b', '#7b5cff'],
  },
];

const COOKIE_CONSENT_KEY = 'himaliya.customer.cookie-consent';

function readCookieConsent() {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) || '';
  } catch {
    return '';
  }
}

function buildCustomerTheme(theme) {
  const dark = theme !== 'light';
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
      fontSize: 12.5,
      h5: { fontSize: '1.1rem', fontWeight: 800 },
      h6: { fontSize: '.98rem', fontWeight: 800 },
      subtitle1: { fontSize: '.9rem' },
      body1: { fontSize: '.8rem' },
      body2: { fontSize: '.76rem' },
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
  const {
    theme,
    setTheme,
    dashboardStyle,
    setDashboardStyle,
  } = useCustomerTheme();
  const [profile, setProfile] = React.useState(null);
  const [form, setForm] = React.useState({ name: '', email: '', phone: '', address: '' });
  const [preferences, setPreferences] = React.useState({
    browserNotifications: true,
    orderUpdates: true,
    invoiceAlerts: true,
    defaultBottleType: 'Gallon',
    defaultQuantity: 1,
  });
  const [tab, setTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [cookieConsent, setCookieConsent] = React.useState(readCookieConsent);
  const customerTheme = React.useMemo(() => buildCustomerTheme(theme), [theme]);

  // Declining here clears the stored choice as well as the allowance, so the
  // portal's consent card is shown again on the next visit.
  const updateCookieConsent = React.useCallback((allowed) => {
    const next = allowed ? 'allowed' : 'declined';
    setCookieConsent(next);
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, next);
    } catch {
      // Consent stays active for this visit when storage is unavailable.
    }
  }, []);

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
      })
      .catch((error) => toast.error(error.message || 'Could not load your profile.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [history]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updatePreference = (field, value) => {
    setPreferences((current) => ({ ...current, [field]: value }));
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
          backgroundImage: theme === 'dark-gradient'
            ? 'radial-gradient(circle at 8% 0%, rgba(0, 221, 255, .22), transparent 30rem), radial-gradient(circle at 92% 10%, rgba(123, 92, 255, .22), transparent 34rem), linear-gradient(145deg, #061927 0%, #0b1630 48%, #140d2b 100%)'
            : theme === 'dark'
              ? 'linear-gradient(180deg, #07111f 0%, #0a1724 100%)'
              : 'radial-gradient(circle at 10% 0%, rgba(61,190,239,.13), transparent 28rem), radial-gradient(circle at 94% 18%, rgba(14,116,144,.09), transparent 30rem)',
          backgroundAttachment: 'fixed',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 1040, mx: 'auto' }}>
          <Box
            component="header"
            sx={{
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column-reverse', sm: 'row' },
              gap: 1.5,
              mb: 2.5,
              p: { xs: 2, sm: 'clamp(1.15rem, 3.2vw, 1.75rem)' },
              borderRadius: '1.65rem',
              border: '1px solid',
              borderColor: theme === 'light' ? 'rgba(7,86,117,.16)' : 'rgba(125,223,255,.18)',
              boxShadow: theme === 'light' ? '0 18px 46px rgba(25,79,105,.1)' : '0 30px 76px rgba(0,11,24,.34)',
              backdropFilter: 'blur(18px)',
              background: theme === 'light'
                ? 'linear-gradient(145deg, rgba(255,255,255,.92), rgba(237,248,252,.92))'
                : 'linear-gradient(145deg, rgba(9,36,60,.86), rgba(6,21,38,.88))',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{
                display: 'grid',
                flex: '0 0 auto',
                width: 44,
                height: 44,
                placeItems: 'center',
                color: '#fff',
                background: 'linear-gradient(140deg, #43cfe6, #0782ab)',
                borderRadius: 2.25,
                boxShadow: '0 10px 24px rgba(7, 130, 171, .3)',
              }}
              >
                <WaterDropRoundedIcon />
              </Box>
              <Box>
                <Typography
                  sx={{
                    display: 'block',
                    mb: 0.35,
                    color: theme === 'light' ? '#078eb4' : '#7ddfff',
                    fontSize: '.72rem',
                    fontWeight: 900,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Himaliya Spring Water
                </Typography>
                <Typography
                  variant="h5"
                  component="p"
                  sx={{ fontWeight: 900, color: theme === 'light' ? '#102a3d' : '#f2fbff', lineHeight: 1.15 }}
                >
                  Profile & preferences
                </Typography>
                <Typography sx={{ mt: 0.35, color: theme === 'light' ? '#4c6c7d' : '#c7ebfb' }}>
                  Manage your account, delivery defaults, and appearance.
                </Typography>
              </Box>
            </Stack>
            <Button
              color="primary"
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => history.push('/customer/app')}
              sx={{
                position: 'relative',
                zIndex: 1,
                flex: '0 0 auto',
                color: theme === 'light' ? '#075675' : '#dff8ff',
                bgcolor: theme === 'light' ? 'rgba(255,255,255,.78)' : 'rgba(125,223,255,.1)',
                borderColor: theme === 'light' ? 'rgba(7,86,117,.28)' : 'rgba(125,223,255,.38)',
                '&:hover': {
                  bgcolor: theme === 'light' ? '#fff' : 'rgba(125,223,255,.17)',
                  borderColor: theme === 'light' ? '#078eb4' : '#7ddfff',
                },
              }}
            >
              Back to dashboard
            </Button>
          </Box>

          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
          >
            <Card
              sx={{
                mb: 2.5,
                overflow: 'hidden',
                borderRadius: 3,
                boxShadow: '0 18px 46px rgba(6, 40, 58, .1)',
              }}
            >
              <CardHeader
                sx={{
                  // A tinted masthead separates identity from the tabbed
                  // content below without needing another divider.
                  background: 'linear-gradient(135deg, rgba(8, 150, 196, .13), transparent 68%)',
                }}
                avatar={(
                  <Box sx={{
                    display: 'grid',
                    width: 52,
                    height: 52,
                    placeItems: 'center',
                    color: '#fff',
                    background: 'linear-gradient(140deg, #43cfe6, #0782ab)',
                    borderRadius: 2.25,
                    boxShadow: '0 10px 24px rgba(7, 130, 171, .3)',
                  }}
                  >
                    <PersonOutlineRoundedIcon />
                  </Box>
                )}
                title="Profile & preferences"
                subheader="Manage your delivery details, ordering defaults, notifications, and password."
                titleTypographyProps={{ variant: 'h5', fontWeight: 850 }}
              />
              <Tabs
                value={tab}
                onChange={(event, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Customer settings sections"
                sx={{
                  px: 1,
                  borderTop: '1px solid',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
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
                  subheader="Delivery preferences follow your account. Appearance stays on this device."
                />
                <CardContent>
                  <Box component="form" onSubmit={(event) => save(event, 'Portal preferences saved.')}>
                    <Typography variant="overline" color="text.secondary">Appearance</Typography>
                    {/* Same selector component as the admin interface settings,
                        so both sides of the product pick options the same way. */}
                    <LayoutGroup id="customer-appearance-options">
                      <div className="settings-theme-grid" role="radiogroup" aria-label="Appearance" style={{ margin: '0.6rem 0 1rem' }}>
                        {APPEARANCE_OPTIONS.map((option) => {
                          const selected = theme === option.value;
                          return (
                            <motion.button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              className={`settings-theme-card${selected ? ' is-selected' : ''}`}
                              style={{
                                '--settings-theme-accent': option.accent,
                                '--settings-theme-ring': `${option.accent}2b`,
                              }}
                              onClick={() => setTheme(option.value)}
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.985 }}
                            >
                              {selected && (
                                <motion.span
                                  className="settings-theme-card__selection"
                                  layoutId="customer-appearance-selection"
                                />
                              )}
                              <span className="settings-theme-card__content">
                                <span className="settings-theme-card__topline">
                                  <span className="settings-theme-card__swatches" aria-hidden="true">
                                    {option.swatches.map((color) => <i key={color} style={{ background: color }} />)}
                                  </span>
                                  <span className="settings-theme-card__check" aria-hidden="true">
                                    {selected && <CheckRoundedIcon fontSize="small" />}
                                  </span>
                                </span>
                                <strong>{option.label}</strong>
                                <small>{option.description}</small>
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </LayoutGroup>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1, mb: 2 }}>
                      Saved only in this browser, so it can be different on each device.
                    </Typography>

                    <Divider sx={{ mb: 2 }} />
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <ColorLensRoundedIcon color="primary" fontSize="small" />
                      <Box>
                        <Typography variant="subtitle2" fontWeight={850}>Dashboard colors</Typography>
                        <Typography variant="caption" color="text.secondary">Personalize the accent, header, and card surfaces.</Typography>
                      </Box>
                    </Stack>
                    <Grid container spacing={1.5} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={4}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>Accent</Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          role="radiogroup"
                          aria-label="Dashboard accent colour"
                          sx={{ mt: 0.75 }}
                        >
                          {ACCENT_SWATCHES.map((swatch) => {
                            const selected = dashboardStyle.accent === swatch.value;
                            return (
                              <Box
                                key={swatch.value}
                                component="button"
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={swatch.label}
                                title={swatch.label}
                                onClick={() => setDashboardStyle({ accent: swatch.value })}
                                sx={{
                                  display: 'grid',
                                  width: 40,
                                  height: 40,
                                  flex: '0 0 auto',
                                  placeItems: 'center',
                                  p: 0,
                                  color: '#fff',
                                  cursor: 'pointer',
                                  background: `linear-gradient(140deg, ${swatch.light}, ${swatch.color})`,
                                  border: '2px solid',
                                  borderColor: selected ? 'text.primary' : 'transparent',
                                  borderRadius: '50%',
                                  boxShadow: selected
                                    ? `0 0 0 3px ${swatch.color}33, 0 6px 16px ${swatch.color}44`
                                    : '0 3px 10px rgba(12, 45, 62, .16)',
                                  transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                                  '&:hover': { transform: 'translateY(-2px)' },
                                  '&:focus-visible': { outline: `3px solid ${swatch.color}`, outlineOffset: 2 },
                                  '@media (prefers-reduced-motion: reduce)': {
                                    transition: 'none',
                                    '&:hover': { transform: 'none' },
                                  },
                                }}
                              >
                                {selected && <CheckRoundedIcon sx={{ fontSize: 20 }} />}
                              </Box>
                            );
                          })}
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>Header</Typography>
                        <Select
                          size="small"
                          fullWidth
                          value={dashboardStyle.header}
                          onChange={(event) => setDashboardStyle({ header: event.target.value })}
                          sx={{ mt: .5 }}
                          inputProps={{ 'aria-label': 'Dashboard header color' }}
                        >
                          <MenuItem value="ocean">Ocean</MenuItem>
                          <MenuItem value="midnight">Midnight</MenuItem>
                          <MenuItem value="violet">Violet</MenuItem>
                          <MenuItem value="emerald">Emerald</MenuItem>
                        </Select>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>Cards</Typography>
                        <Select
                          size="small"
                          fullWidth
                          value={dashboardStyle.cards}
                          onChange={(event) => setDashboardStyle({ cards: event.target.value })}
                          sx={{ mt: .5 }}
                          inputProps={{ 'aria-label': 'Dashboard card style' }}
                        >
                          <MenuItem value="clean">Clean</MenuItem>
                          <MenuItem value="tinted">Tinted</MenuItem>
                          <MenuItem value="glass">Glass</MenuItem>
                        </Select>
                      </Grid>
                    </Grid>
                    <Alert icon={<ViewModuleRoundedIcon />} severity="info" sx={{ mb: 2 }}>
                      Dashboard color changes are saved immediately on this device.
                    </Alert>

                    <Divider />
                    <Stack spacing={1} sx={{ mt: 1.5, mb: 2 }}>
                      <PreferenceSwitch
                        label="Allow cookies"
                        description="Optional storage for saved dashboard preferences. Declining shows the consent card again."
                        checked={cookieConsent === 'allowed'}
                        onChange={(event) => updateCookieConsent(event.target.checked)}
                        icon={<CookieRoundedIcon />}
                      />
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
