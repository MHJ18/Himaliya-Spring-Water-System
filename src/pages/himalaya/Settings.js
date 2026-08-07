import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import CancelScheduleSendRoundedIcon from '@mui/icons-material/CancelScheduleSendRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import DatabaseRoundedIcon from '@mui/icons-material/StorageRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { toast } from 'react-toastify';
import { alpha } from '@mui/material/styles';
import PageShell from '../../components/PageShell/PageShell';
import { useSettings } from '../../context/SettingsContext';
import { useCustomers } from '../../context/CustomerContext';
import { exportCustomersToCsv, exportSalesToCsv } from '../../utils/exportCsv';
import { isSupabaseConfigured, verifyPassword } from '../../services/cloud/supabaseClient';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { getBottlePrices, saveBottlePrices } from '../../services/api/bottlePriceApi';
import { getCurrentAdminProfile } from '../../utils/adminAuth';
import PasswordChangeForm from '../../components/PasswordChangeForm/PasswordChangeForm';
import { getInventory, saveInventory } from '../../services/api/inventoryApi';
import { getActiveRiders } from '../../services/api/customerPortalApi';
import {
  getDatabaseStats,
  getSupabaseUsageUrl,
  resetBusinessData,
} from '../../services/api/databaseAdminApi';
import { formatCurrency } from '../../utils/formatters';
import './UtilityPages.css';

const emptyBottleValues = BOTTLE_TYPES.reduce((acc, type) => ({ ...acc, [type]: '' }), {});
const RESET_CONFIRMATION_PHRASE = 'RESET DATABASE';

function SettingsCard({
  id, title, subtitle, icon, children, action, className, mobile, expanded, onToggle,
}) {
  const contentId = `${id}-settings-content`;
  return (
    <Card
      className={`settings-card${mobile ? ' settings-card--accordion' : ''}${className ? ` ${className}` : ''}`}
      sx={{ height: '100%' }}
    >
      <CardHeader
        component={mobile ? 'button' : 'div'}
        {...(mobile ? {
          type: 'button',
          onClick: onToggle,
          'aria-expanded': expanded,
          'aria-controls': contentId,
          'aria-label': `${expanded ? 'Collapse' : 'Expand'} ${title}`,
        } : {})}
        avatar={(
          <Box
            className="settings-card__icon"
            sx={(theme) => ({
              display: 'grid',
              width: 42,
              height: 42,
              placeItems: 'center',
              color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.dark',
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.1),
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.15),
              borderRadius: 2,
              boxShadow: `0 10px 24px ${alpha(theme.palette.primary.main, 0.1)}`,
            })}
          >
            {icon}
          </Box>
        )}
        title={title}
        subheader={subtitle}
        action={mobile ? (
          <ExpandMoreRoundedIcon
            aria-hidden="true"
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}
          />
        ) : action}
        titleTypographyProps={{ variant: 'h5' }}
        subheaderTypographyProps={{ variant: 'body2' }}
        sx={{
          pb: mobile ? 2 : 1,
          width: '100%',
          color: 'inherit',
          textAlign: 'left',
          bgcolor: 'transparent',
          border: 0,
          cursor: mobile ? 'pointer' : 'default',
          '& .MuiCardHeader-action': {
            alignSelf: 'center',
            display: 'grid',
            minWidth: mobile ? 44 : 'auto',
            minHeight: mobile ? 44 : 'auto',
            m: 0,
            placeItems: 'center',
          },
        }}
      />
      <Collapse in={!mobile || expanded} timeout={220} unmountOnExit={mobile}>
        <CardContent id={contentId} sx={{ pt: 1 }}>
          {mobile && action && (
            <Box sx={{ display: 'flex', mb: 2, justifyContent: 'flex-start' }}>
              {action}
            </Box>
          )}
          {children}
        </CardContent>
      </Collapse>
    </Card>
  );
}

function SettingsToggle({
  label, description, checked, onChange, disabled, icon,
}) {
  return (
    <Box
      className={`settings-toggle${checked ? ' is-checked' : ''}`}
      sx={(theme) => ({
        display: 'flex',
        minHeight: 68,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        my: 0.65,
        p: 1.15,
        bgcolor: checked ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.07) : 'action.hover',
        border: '1px solid',
        borderColor: checked ? alpha(theme.palette.primary.main, 0.3) : 'divider',
        borderRadius: 2.25,
        transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
        boxShadow: checked ? `0 8px 24px ${alpha(theme.palette.primary.main, 0.09)}` : 'none',
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Box
          className="settings-toggle__icon"
          sx={(theme) => ({
            display: 'grid',
            width: 40,
            height: 40,
            flex: '0 0 40px',
            placeItems: 'center',
            color: checked
              ? (theme.palette.mode === 'dark' ? 'primary.light' : 'primary.dark')
              : 'text.secondary',
            bgcolor: checked ? alpha(theme.palette.primary.main, 0.14) : 'action.selected',
            borderRadius: 1.75,
            '& svg': { fontSize: 21 },
          })}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={750} color="text.primary">{label}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Box>
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: '0 0 auto' }}>
        <Typography
          variant="caption"
          sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 20, color: checked ? 'primary.main' : 'text.secondary', fontWeight: 850 }}
        >
          {checked ? 'On' : 'Off'}
        </Typography>
        <Switch
          className="settings-toggle__switch"
          checked={Boolean(checked)}
          onChange={onChange}
          disabled={disabled}
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

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unit = -1;
  do {
    amount /= 1024;
    unit += 1;
  } while (amount >= 1024 && unit < units.length - 1);
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unit]}`;
}

function DatabaseMetric({ icon, label, value, detail, tone }) {
  return (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
      <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box sx={{
          display: 'grid',
          width: 42,
          height: 42,
          flex: '0 0 42px',
          placeItems: 'center',
          color: tone || 'primary.main',
          bgcolor: 'action.hover',
          borderRadius: 2,
        }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography>
          <Typography variant="h5" sx={{ mt: 0.2, overflowWrap: 'anywhere' }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{detail}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const { customers, refresh: refreshCustomers } = useCustomers();
  const mobile = useMediaQuery((theme) => theme.breakpoints.down('md'), { noSsr: true });
  const [tab, setTab] = useState(0);
  const [openMobileCard, setOpenMobileCard] = useState(null);
  const [form, setForm] = useState({ ...settings });
  const [bottlePrices, setBottlePrices] = useState(emptyBottleValues);
  const [inventory, setInventory] = useState(emptyBottleValues);
  const [savingPrices, setSavingPrices] = useState(false);
  const [savingInventory, setSavingInventory] = useState(false);
  const [currentAdminEmail, setCurrentAdminEmail] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [riders, setRiders] = useState([]);
  const [databaseStats, setDatabaseStats] = useState(null);
  const [loadingDatabaseStats, setLoadingDatabaseStats] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetOwnerPassword, setResetOwnerPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resettingDatabase, setResettingDatabase] = useState(false);
  const cloudReady = isSupabaseConfigured();
  const resetPhraseMatchesPrefix = RESET_CONFIRMATION_PHRASE.startsWith(resetPhrase);
  const resetPhraseReady = resetPhrase === RESET_CONFIRMATION_PHRASE;
  const resetPhraseProgress = resetPhraseMatchesPrefix
    ? Math.min(100, Math.round((resetPhrase.length / RESET_CONFIRMATION_PHRASE.length) * 100))
    : 0;
  const cardProps = (id) => ({
    id,
    mobile,
    expanded: openMobileCard === id,
    onToggle: () => setOpenMobileCard((current) => (current === id ? null : id)),
  });

  const loadBottlePrices = useCallback(async () => {
    try {
      const prices = await getBottlePrices(emptyBottleValues);
      setBottlePrices({ ...emptyBottleValues, ...prices });
    } catch (error) {
      toast.error(error.message || 'Could not load bottle prices.');
    }
  }, []);

  useEffect(() => {
    loadBottlePrices();
    getInventory()
      .then((stock) => setInventory({ ...emptyBottleValues, ...stock }))
      .catch(() => {});
    getCurrentAdminProfile()
      .then((admin) => {
        setCurrentAdmin(admin);
        setCurrentAdminEmail(admin.email);
      })
      .catch(() => {});
    getActiveRiders().then(setRiders).catch(() => setRiders([]));
  }, [loadBottlePrices]);

  useEffect(() => {
    if (tab === 2) loadBottlePrices();
  }, [tab, loadBottlePrices]);

  const loadDatabaseStats = useCallback(async () => {
    setLoadingDatabaseStats(true);
    try {
      setDatabaseStats(await getDatabaseStats());
    } catch (error) {
      toast.error(error.message || 'Could not load database information.');
    } finally {
      setLoadingDatabaseStats(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 4) loadDatabaseStats();
  }, [tab, loadDatabaseStats]);

  useEffect(() => {
    setForm((current) => ({ ...current, ...settings }));
  }, [settings]);

  const updateForm = (field) => (event) => {
    const value = event && event.target ? event.target.value : event;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveBusiness = (event) => {
    event.preventDefault();
    updateSettings({
      businessName: form.businessName.trim(),
      businessPhone: form.businessPhone.trim(),
      businessEmail: String(form.businessEmail || '').trim().toLowerCase(),
      businessAddress: form.businessAddress.trim(),
      serviceArea: String(form.serviceArea || '').trim(),
      invoiceFooter: String(form.invoiceFooter || '').trim(),
    });
    toast.success('Business profile saved.');
  };

  const handleSaveCompanyFeatures = (event) => {
    event.preventDefault();
    updateSettings({
      featureCustomerOrders: form.featureCustomerOrders !== false,
      featureInvoices: form.featureInvoices !== false,
      featureRiderTracking: form.featureRiderTracking !== false,
      featureMessaging: form.featureMessaging !== false,
      featureInventory: form.featureInventory !== false,
      featureAnalytics: form.featureAnalytics !== false,
    });
    toast.success('Company features updated.');
  };

  const handleSaveWorkflow = (event) => {
    event.preventDefault();
    updateSettings({
      autoAcceptOrders: Boolean(form.autoAcceptOrders),
      riderAssignmentMode: form.riderAssignmentMode === 'auto' ? 'auto' : 'manual',
      defaultRiderId: form.riderAssignmentMode === 'auto' ? (form.defaultRiderId || '') : '',
      adminOrderNotifications: Boolean(form.adminOrderNotifications),
      requireDeliveryConfirmation: Boolean(form.requireDeliveryConfirmation),
      allowCustomerCancellation: Boolean(form.allowCustomerCancellation),
      riderLocationRefreshSeconds: Math.max(5, Number(form.riderLocationRefreshSeconds) || 15),
      routeOptimization: Boolean(form.routeOptimization),
      riderStatusNotifications: Boolean(form.riderStatusNotifications),
      requireBottleCollectionCount: Boolean(form.requireBottleCollectionCount),
      autoAssignNearestRider: Boolean(form.autoAssignNearestRider),
      invoiceDueDays: Math.max(0, Number(form.invoiceDueDays) || 0),
      lowStockThreshold: Math.max(0, Number(form.lowStockThreshold) || 0),
      orderCutoffTime: form.orderCutoffTime || '18:00',
    });
    toast.success('Order workflow saved.');
  };

  const handleSavePrices = async (event) => {
    event.preventDefault();
    setSavingPrices(true);
    try {
      await saveBottlePrices(bottlePrices);
      await loadBottlePrices();
      toast.success('Bottle prices are now available to customers.');
    } catch (error) {
      toast.error(error.message || 'Could not save bottle prices.');
    } finally {
      setSavingPrices(false);
    }
  };

  const handleSaveInventory = async (event) => {
    event.preventDefault();
    setSavingInventory(true);
    try {
      await saveInventory(inventory);
      toast.success('Inventory levels updated.');
    } catch (error) {
      toast.error(error.message || 'Could not save inventory.');
    } finally {
      setSavingInventory(false);
    }
  };

  const closeResetDialog = () => {
    if (resettingDatabase) return;
    setResetDialogOpen(false);
    setResetPhrase('');
    setResetOwnerPassword('');
    setShowResetPassword(false);
    setResetError('');
  };

  const handleResetDatabase = async () => {
    if (!currentAdmin || currentAdmin.role !== 'Owner') {
      setResetError('Only the signed-in Owner can reset the database.');
      return;
    }
    if (resetPhrase !== RESET_CONFIRMATION_PHRASE) {
      setResetError(`Type ${RESET_CONFIRMATION_PHRASE} exactly to continue.`);
      return;
    }
    if (!resetOwnerPassword) {
      setResetError('Enter your owner password to authorize this reset.');
      return;
    }

    setResettingDatabase(true);
    setResetError('');
    try {
      await verifyPassword(currentAdmin.email, resetOwnerPassword);
      const result = await resetBusinessData();
      await refreshCustomers();
      setDatabaseStats(null);
      setResetDialogOpen(false);
      setResetPhrase('');
      setResetOwnerPassword('');
      setShowResetPassword(false);
      toast.success(`Database cleared. ${Number(result.deletedRows) || 0} records removed; user accounts were preserved.`);
    } catch (error) {
      setResetError(error.message || 'The database could not be reset.');
    } finally {
      setResettingDatabase(false);
    }
  };

  return (
    <PageShell title="App settings" subtitle="Control company details, business features, ordering rules, prices, and data">
      <Card className="settings-tabs-card" sx={{ mb: 3, overflow: 'visible' }}>
        <Tabs
          className="settings-tabs"
          value={tab}
          onChange={(event, value) => {
            setTab(value);
            setOpenMobileCard(null);
          }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Settings sections"
          sx={{ px: { xs: 0.5, sm: 1.5 }, minHeight: 58 }}
        >
          <Tab icon={<BusinessOutlinedIcon />} iconPosition="start" label="Company" />
          <Tab icon={<AccountTreeOutlinedIcon />} iconPosition="start" label="Operations" />
          <Tab icon={<WaterDropOutlinedIcon />} iconPosition="start" label="Catalog" />
          <Tab icon={<SecurityOutlinedIcon />} iconPosition="start" label="Data & security" />
          <Tab icon={<DatabaseRoundedIcon />} iconPosition="start" label="Database info" />
          <Tab icon={<DeleteSweepRoundedIcon />} iconPosition="start" label="Reset" />
        </Tabs>
      </Card>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <SettingsCard
              {...cardProps('business-profile')}
              title="Business profile"
              subtitle="Used on invoices, customer records, and delivery information"
              icon={<BusinessOutlinedIcon />}
            >
              <Box component="form" onSubmit={handleSaveBusiness}>
                <Stack spacing={2}>
                  <TextField
                    label="Business name"
                    value={form.businessName || ''}
                    onChange={updateForm('businessName')}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Business phone"
                    value={form.businessPhone || ''}
                    onChange={updateForm('businessPhone')}
                    autoComplete="tel"
                    fullWidth
                  />
                  <TextField
                    label="Support email"
                    type="email"
                    value={form.businessEmail || ''}
                    onChange={updateForm('businessEmail')}
                    placeholder="support@himaliya.com"
                    autoComplete="email"
                    fullWidth
                  />
                  <TextField
                    label="Business address"
                    value={form.businessAddress || ''}
                    onChange={updateForm('businessAddress')}
                    multiline
                    minRows={3}
                    helperText="This address appears on invoices and public invoice lookup."
                    fullWidth
                  />
                  <TextField
                    label="Delivery service area"
                    value={form.serviceArea || ''}
                    onChange={updateForm('serviceArea')}
                    placeholder="Sialkot and surrounding areas"
                    helperText="Shown to staff when planning routes and customer coverage."
                    fullWidth
                  />
                  <TextField
                    label="Invoice footer"
                    value={form.invoiceFooter || ''}
                    onChange={updateForm('invoiceFooter')}
                    placeholder="Thank you for choosing Himaliya Spring Water."
                    multiline
                    minRows={2}
                    fullWidth
                  />
                  <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} sx={{ alignSelf: 'flex-start' }}>
                    Save business profile
                  </Button>
                </Stack>
              </Box>
            </SettingsCard>
          </Grid>

          <Grid item xs={12} lg={6}>
            <SettingsCard
              {...cardProps('company-features')}
              title="Company features"
              subtitle="Turn major application modules on or off for your team"
              icon={<AccountTreeOutlinedIcon />}
            >
              <Box component="form" onSubmit={handleSaveCompanyFeatures}>
                <SettingsToggle
                  label="Customer ordering"
                  description="Show the customer order queue and dashboard delivery schedule."
                  checked={form.featureCustomerOrders !== false}
                  onChange={(event) => setForm((current) => ({ ...current, featureCustomerOrders: event.target.checked }))}
                  icon={<AccountTreeOutlinedIcon />}
                />
                <SettingsToggle
                  label="Invoices"
                  description="Enable invoice center navigation and invoice workflows."
                  checked={form.featureInvoices !== false}
                  onChange={(event) => setForm((current) => ({ ...current, featureInvoices: event.target.checked }))}
                  icon={<ReceiptLongRoundedIcon />}
                />
                <SettingsToggle
                  label="Rider tracking"
                  description="Enable delivery tracking and route-management tools."
                  checked={form.featureRiderTracking !== false}
                  onChange={(event) => setForm((current) => ({ ...current, featureRiderTracking: event.target.checked }))}
                  icon={<MapRoundedIcon />}
                />
                <SettingsToggle
                  label="Customer messaging"
                  description="Show the shared inbox and customer support conversations."
                  checked={form.featureMessaging !== false}
                  onChange={(event) => setForm((current) => ({ ...current, featureMessaging: event.target.checked }))}
                  icon={<NotificationsActiveRoundedIcon />}
                />
                <SettingsToggle
                  label="Inventory tracking"
                  description="Track reusable stock and expose inventory controls."
                  checked={form.featureInventory !== false}
                  onChange={(event) => setForm((current) => ({ ...current, featureInventory: event.target.checked }))}
                  icon={<Inventory2OutlinedIcon />}
                />
                <SettingsToggle
                  label="Analytics"
                  description="Show revenue reports and analytical navigation."
                  checked={form.featureAnalytics !== false}
                  onChange={(event) => setForm((current) => ({ ...current, featureAnalytics: event.target.checked }))}
                  icon={<InsightsRoundedIcon />}
                />
                <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} sx={{ mt: 2 }}>
                  Save company features
                </Button>
              </Box>
            </SettingsCard>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <SettingsCard
              {...cardProps('order-workflow')}
              title="Order workflow"
              subtitle="Rules applied to customer ordering and admin fulfilment"
              icon={<AccountTreeOutlinedIcon />}
            >
              <Box component="form" onSubmit={handleSaveWorkflow}>
                <SettingsToggle
                  label="Automatically accept new orders"
                  description="Skip manual acceptance and move valid orders straight to the delivery queue."
                  checked={form.autoAcceptOrders}
                  onChange={(event) => setForm((current) => ({ ...current, autoAcceptOrders: event.target.checked }))}
                  icon={<AutorenewRoundedIcon />}
                />
                <Box sx={{ my: 1.25, p: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
                  <Typography variant="body2" fontWeight={800}>Rider assignment</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Choose whether accepted orders wait for dispatch or transfer to a rider automatically.
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 0.25 }}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel id="rider-assignment-mode-label">Assignment mode</InputLabel>
                        <Select
                          labelId="rider-assignment-mode-label"
                          label="Assignment mode"
                          value={form.riderAssignmentMode || 'manual'}
                          onChange={updateForm('riderAssignmentMode')}
                        >
                          <MenuItem value="manual">Manual assignment</MenuItem>
                          <MenuItem value="auto">Automatic transfer</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth disabled={(form.riderAssignmentMode || 'manual') !== 'auto'}>
                        <InputLabel id="default-rider-label">Preferred rider</InputLabel>
                        <Select
                          labelId="default-rider-label"
                          label="Preferred rider"
                          value={form.defaultRiderId || ''}
                          onChange={updateForm('defaultRiderId')}
                        >
                          <MenuItem value="">First available rider</MenuItem>
                          {riders.map((rider) => <MenuItem key={rider.id} value={rider.id}>{rider.name}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  {!riders.length && (
                    <Alert severity="info" sx={{ mt: 1.5 }}>
                      Create a Rider account in Users before enabling automatic transfer.
                    </Alert>
                  )}
                </Box>
                <Box sx={{ my: 1.25, p: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
                  <Typography variant="body2" fontWeight={800}>Rider operations</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tune location updates, route assistance, and delivery handover controls.
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 0.25, mb: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel id="rider-refresh-label">Live location interval</InputLabel>
                        <Select
                          labelId="rider-refresh-label"
                          label="Live location interval"
                          value={Number(form.riderLocationRefreshSeconds) || 15}
                          onChange={updateForm('riderLocationRefreshSeconds')}
                        >
                          <MenuItem value={5}>Every 5 seconds</MenuItem>
                          <MenuItem value={15}>Every 15 seconds</MenuItem>
                          <MenuItem value={30}>Every 30 seconds</MenuItem>
                          <MenuItem value={60}>Every minute</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel id="rider-route-mode-label">Route guidance</InputLabel>
                        <Select
                          labelId="rider-route-mode-label"
                          label="Route guidance"
                          value={form.routeOptimization === false ? 'manual' : 'optimized'}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            routeOptimization: event.target.value === 'optimized',
                          }))}
                        >
                          <MenuItem value="optimized">Optimize delivery order</MenuItem>
                          <MenuItem value="manual">Keep dispatcher order</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  <SettingsToggle
                    label="Delivery status notifications"
                    description="Notify admins when a rider starts, arrives, or completes a delivery."
                    checked={form.riderStatusNotifications !== false}
                    onChange={(event) => setForm((current) => ({ ...current, riderStatusNotifications: event.target.checked }))}
                    icon={<NotificationsActiveRoundedIcon />}
                  />
                  <SettingsToggle
                    label="Require returned-bottle count"
                    description="Keep reusable bottle collection visible during rider handover."
                    checked={form.requireBottleCollectionCount !== false}
                    onChange={(event) => setForm((current) => ({ ...current, requireBottleCollectionCount: event.target.checked }))}
                    icon={<Inventory2OutlinedIcon />}
                  />
                  <SettingsToggle
                    label="Assign nearest available rider"
                    description="Use the nearest active rider when automatic assignment is enabled."
                    checked={Boolean(form.autoAssignNearestRider)}
                    onChange={(event) => setForm((current) => ({ ...current, autoAssignNearestRider: event.target.checked }))}
                    icon={<MapRoundedIcon />}
                  />
                </Box>
                <SettingsToggle
                  label="Notify admins about new orders"
                  description="Create an unread alert for each customer order."
                  checked={form.adminOrderNotifications}
                  onChange={(event) => setForm((current) => ({ ...current, adminOrderNotifications: event.target.checked }))}
                  icon={<NotificationsActiveRoundedIcon />}
                />
                <SettingsToggle
                  label="Confirm before marking delivered"
                  description="Protect against accidental delivery completion."
                  checked={form.requireDeliveryConfirmation}
                  onChange={(event) => setForm((current) => ({ ...current, requireDeliveryConfirmation: event.target.checked }))}
                  icon={<VerifiedRoundedIcon />}
                />
                <SettingsToggle
                  label="Allow pending order cancellation"
                  description="Customers can cancel only while an order is still pending."
                  checked={form.allowCustomerCancellation}
                  onChange={(event) => setForm((current) => ({ ...current, allowCustomerCancellation: event.target.checked }))}
                  icon={<CancelScheduleSendRoundedIcon />}
                />

                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Invoice due days"
                      type="number"
                      value={form.invoiceDueDays}
                      onChange={updateForm('invoiceDueDays')}
                      inputProps={{ min: 0, max: 90 }}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Low-stock alert"
                      type="number"
                      value={form.lowStockThreshold}
                      onChange={updateForm('lowStockThreshold')}
                      inputProps={{ min: 0 }}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Daily order cutoff"
                      type="time"
                      value={form.orderCutoffTime || '18:00'}
                      onChange={updateForm('orderCutoffTime')}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} sx={{ mt: 2 }}>
                  Save workflow
                </Button>
              </Box>
            </SettingsCard>
          </Grid>

          {form.featureInventory !== false && (
          <Grid item xs={12} lg={5}>
            <SettingsCard
              {...cardProps('live-inventory')}
              title="Live inventory"
              subtitle="Sales reduce these quantities automatically"
              icon={<Inventory2OutlinedIcon />}
            >
              <Box component="form" onSubmit={handleSaveInventory}>
                <Grid container spacing={2}>
                  {BOTTLE_TYPES.map((type) => (
                    <Grid item xs={12} sm={6} lg={12} key={type}>
                      <TextField
                        label={BOTTLE_TYPE_LABELS[type] || type}
                        type="number"
                        value={inventory[type] || ''}
                        onChange={(event) => setInventory((current) => ({ ...current, [type]: event.target.value }))}
                        InputProps={{
                          inputProps: { min: 0, step: 1 },
                          endAdornment: <InputAdornment position="end">units</InputAdornment>,
                        }}
                        fullWidth
                      />
                    </Grid>
                  ))}
                </Grid>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveRoundedIcon />}
                  disabled={savingInventory}
                  sx={{ mt: 2 }}
                >
                  {savingInventory ? 'Saving inventory...' : 'Save inventory'}
                </Button>
              </Box>
            </SettingsCard>
          </Grid>
          )}
        </Grid>
      )}

      {tab === 2 && (
        <SettingsCard
          {...cardProps('customer-prices')}
          title="Customer bottle prices"
          subtitle="Fixed unit prices shown before a customer confirms an order"
          icon={<WaterDropOutlinedIcon />}
        >
          <Alert severity="info" sx={{ mb: 2 }}>
            Changes apply to new orders. Existing orders keep the price recorded when they were placed.
          </Alert>
          <Box component="form" onSubmit={handleSavePrices}>
            <Grid container spacing={2}>
              {BOTTLE_TYPES.map((type) => (
                <Grid item xs={12} sm={6} lg={3} key={type}>
                  <TextField
                    label={BOTTLE_TYPE_LABELS[type] || type}
                    type="number"
                    value={bottlePrices[type] || ''}
                    onChange={(event) => setBottlePrices((current) => ({ ...current, [type]: event.target.value }))}
                    InputProps={{
                      inputProps: { min: 0, step: 1 },
                      startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                      endAdornment: <InputAdornment position="end">/ unit</InputAdornment>,
                    }}
                    fullWidth
                  />
                </Grid>
              ))}
            </Grid>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              disabled={savingPrices}
              sx={{ mt: 2 }}
            >
              {savingPrices ? 'Publishing prices...' : 'Publish bottle prices'}
            </Button>
          </Box>
        </SettingsCard>
      )}

      {tab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={5}>
            <SettingsCard
              {...cardProps('cloud-data')}
              title="Cloud data"
              subtitle="Storage status and portable exports"
              icon={<CloudDoneOutlinedIcon />}
              action={(
                <Chip
                  size="small"
                  color={cloudReady ? 'success' : 'error'}
                  label={cloudReady ? 'Connected' : 'Configuration required'}
                  sx={{ mt: 1, mr: 1 }}
                />
              )}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Customers, orders, sales, invoices, prices, inventory, and settings use Supabase as the source of truth.
                CSV files are generated only when you request an export.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadRoundedIcon />}
                  onClick={() => exportCustomersToCsv(customers)}
                >
                  Customers CSV
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadRoundedIcon />}
                  onClick={() => exportSalesToCsv(customers)}
                >
                  Sales CSV
                </Button>
              </Stack>
            </SettingsCard>
          </Grid>
          <Grid item xs={12} lg={7}>
            <SettingsCard
              {...cardProps('account-security')}
              title="Account security"
              subtitle="Update the password for the signed-in administrator"
              icon={<SecurityOutlinedIcon />}
            >
              {currentAdminEmail
                ? <PasswordChangeForm email={currentAdminEmail} compact />
                : <Alert severity="warning">Administrator details are still loading. Try again in a moment.</Alert>}
            </SettingsCard>
          </Grid>
        </Grid>
      )}

      {tab === 4 && (
        <Stack spacing={3}>
          <SettingsCard
            {...cardProps('database-information')}
            title="Database information"
            subtitle="Live business totals and storage information from Supabase"
            icon={<InsightsRoundedIcon />}
            action={(
              <Button
                size="small"
                startIcon={loadingDatabaseStats ? <CircularProgress size={16} /> : <RefreshRoundedIcon />}
                onClick={loadDatabaseStats}
                disabled={loadingDatabaseStats}
                sx={{ mt: 0.5, mr: 1 }}
              >
                Refresh
              </Button>
            )}
          >
            {!databaseStats && loadingDatabaseStats && (
              <Box sx={{ display: 'grid', minHeight: 220, placeItems: 'center' }}>
                <CircularProgress />
              </Box>
            )}
            {databaseStats && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} lg={3}>
                  <DatabaseMetric
                    icon={<PaymentsRoundedIcon />}
                    label="Gross revenue"
                    value={formatCurrency(databaseStats.grossRevenue)}
                    detail={`${Number(databaseStats.salesEntries) || 0} recorded sales`}
                    tone="success.main"
                  />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <DatabaseMetric
                    icon={<GroupsRoundedIcon />}
                    label="Customers"
                    value={(Number(databaseStats.customers) || 0).toLocaleString()}
                    detail={`${Number(databaseStats.teamAccounts) || 0} preserved team users`}
                  />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <DatabaseMetric
                    icon={<ReceiptLongRoundedIcon />}
                    label="Orders & invoices"
                    value={`${Number(databaseStats.orders) || 0} / ${Number(databaseStats.invoices) || 0}`}
                    detail={`${formatCurrency(databaseStats.outstandingRevenue)} outstanding`}
                    tone="warning.main"
                  />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <DatabaseMetric
                    icon={<DatabaseRoundedIcon />}
                    label="Business data size"
                    value={formatBytes(databaseStats.tenantDataBytes)}
                    detail={`${Number(databaseStats.operationalRecords) || 0} operational records`}
                    tone="info.main"
                  />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <DatabaseMetric
                    icon={<WaterDropOutlinedIcon />}
                    label="Bottles sold"
                    value={(Number(databaseStats.bottlesSold) || 0).toLocaleString()}
                    detail={`${Number(databaseStats.inventoryUnits) || 0} units currently in stock`}
                    tone="info.main"
                  />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <DatabaseMetric
                    icon={<AccountTreeOutlinedIcon />}
                    label="Rider accounts"
                    value={(Number(databaseStats.riders) || 0).toLocaleString()}
                    detail="Included in preserved user accounts"
                  />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <DatabaseMetric
                    icon={<NotificationsActiveRoundedIcon />}
                    label="Messages & alerts"
                    value={`${Number(databaseStats.messages) || 0} / ${Number(databaseStats.notifications) || 0}`}
                    detail="Messages / notifications"
                    tone="secondary.main"
                  />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <DatabaseMetric
                    icon={<CloudDoneOutlinedIcon />}
                    label="Project database size"
                    value={formatBytes(databaseStats.databaseBytes)}
                    detail="Whole Supabase PostgreSQL project"
                    tone="success.main"
                  />
                </Grid>
              </Grid>
            )}
          </SettingsCard>

          <SettingsCard
            {...cardProps('hosted-usage')}
            title="Egress and hosted usage"
            subtitle="Supabase measures outbound traffic at the project and organization level"
            icon={<CloudDoneOutlinedIcon />}
          >
            <Alert severity="info" sx={{ mb: 2 }}>
              Egress cannot be calculated from table rows alone. Open Supabase Usage to see Database, Auth,
              Realtime, Storage, and Edge Function egress for the current billing period.
            </Alert>
            <Button
              component="a"
              href={getSupabaseUsageUrl()}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              endIcon={<OpenInNewRoundedIcon />}
            >
              Open Supabase usage
            </Button>
          </SettingsCard>
        </Stack>
      )}

      {tab === 5 && (
        <SettingsCard
          {...cardProps('reset-database')}
          title="Reset business database"
          subtitle="Remove all operational data while preserving user accounts"
          icon={<DeleteSweepRoundedIcon />}
          className="settings-danger-card"
        >
          <Alert severity="error" sx={{ mb: 2 }}>
            This permanently deletes customers, sales, orders, invoices, messages, notifications, inventory,
            prices, rider device data, and app settings. Authentication users and admin/rider profiles remain.
          </Alert>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="body2" fontWeight={800}>What remains</Typography>
              <Typography variant="body2" color="text.secondary">
                Owner, admin, manager, and rider login accounts are preserved so your team can sign in after the reset.
              </Typography>
            </Box>
            {currentAdmin && currentAdmin.role !== 'Owner' && (
              <Alert severity="warning">Only an Owner can perform this reset.</Alert>
            )}
            <Button
              color="error"
              variant="contained"
              startIcon={<DeleteSweepRoundedIcon />}
              onClick={() => setResetDialogOpen(true)}
              disabled={!cloudReady || !currentAdmin || currentAdmin.role !== 'Owner'}
              sx={{ alignSelf: 'flex-start' }}
            >
              Clear all business data
            </Button>
          </Stack>
        </SettingsCard>
      )}

      <Dialog
        open={resetDialogOpen}
        onClose={closeResetDialog}
        fullWidth
        maxWidth="sm"
        aria-describedby="reset-database-description"
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <span className="settings-reset-dialog__icon" aria-hidden="true">
              <WarningAmberRoundedIcon />
            </span>
            <Box component="span" sx={{ display: 'grid' }}>
              <Typography component="span" variant="h5">Reset the business database?</Typography>
              <Typography component="span" variant="caption" color="text.secondary">
                Owner verification is required
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Alert severity="error" id="reset-database-description">
              This cannot be undone from the app. Export any records you need before continuing.
            </Alert>
            <Box className="settings-reset-token">
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>
                    Confirmation phrase
                  </Typography>
                  <Box component="code">{RESET_CONFIRMATION_PHRASE}</Box>
                </Box>
                <Typography
                  variant="caption"
                  color={resetPhraseReady ? 'success.main' : resetPhraseMatchesPrefix ? 'text.secondary' : 'error.main'}
                  fontWeight={850}
                >
                  {resetPhraseReady ? 'Confirmed' : `${resetPhraseProgress}%`}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={resetPhraseProgress}
                color={resetPhraseReady ? 'success' : resetPhraseMatchesPrefix ? 'primary' : 'error'}
                aria-label="Confirmation phrase progress"
              />
            </Box>
            <TextField
              label="Confirmation phrase"
              placeholder={RESET_CONFIRMATION_PHRASE}
              value={resetPhrase}
              onChange={(event) => { setResetPhrase(event.target.value); setResetError(''); }}
              autoComplete="off"
              disabled={resettingDatabase}
              autoFocus
              error={Boolean(resetPhrase) && !resetPhraseMatchesPrefix}
              helperText={
                resetPhrase && !resetPhraseMatchesPrefix
                  ? `Match ${RESET_CONFIRMATION_PHRASE} exactly.`
                  : 'Uppercase letters and the space must match.'
              }
              InputProps={{
                endAdornment: resetPhraseReady ? (
                  <InputAdornment position="end">
                    <CheckRoundedIcon color="success" aria-label="Confirmation phrase matched" />
                  </InputAdornment>
                ) : null,
              }}
            />
            <TextField
              label="Owner password"
              type={showResetPassword ? 'text' : 'password'}
              value={resetOwnerPassword}
              onChange={(event) => { setResetOwnerPassword(event.target.value); setResetError(''); }}
              autoComplete="current-password"
              disabled={resettingDatabase}
              helperText="Your password is checked again before any data is removed."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label={showResetPassword ? 'Hide owner password' : 'Show owner password'}
                      onClick={() => setShowResetPassword((visible) => !visible)}
                      disabled={resettingDatabase}
                    >
                      {showResetPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {resetError && <Alert severity="error">{resetError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={closeResetDialog} disabled={resettingDatabase}>
            Keep my data
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleResetDatabase}
            disabled={!resetPhraseReady || !resetOwnerPassword || resettingDatabase}
            startIcon={resettingDatabase ? <CircularProgress size={17} color="inherit" /> : <DeleteSweepRoundedIcon />}
          >
            {resettingDatabase ? 'Clearing data…' : 'Reset database'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
