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
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
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
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import CancelScheduleSendRoundedIcon from '@mui/icons-material/CancelScheduleSendRounded';
import ViewCompactRoundedIcon from '@mui/icons-material/ViewCompactRounded';
import MotionPhotosOffRoundedIcon from '@mui/icons-material/MotionPhotosOffRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import DatabaseRoundedIcon from '@mui/icons-material/StorageRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import { toast } from 'react-toastify';
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

const emptyBottleValues = BOTTLE_TYPES.reduce((acc, type) => ({ ...acc, [type]: '' }), {});

function SettingsCard({
  title, subtitle, icon, children, action,
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={(
          <Box sx={{
            display: 'grid',
            width: 42,
            height: 42,
            placeItems: 'center',
            color: 'primary.light',
            bgcolor: 'rgba(29, 155, 240, 0.12)',
            borderRadius: 2,
          }}
          >
            {icon}
          </Box>
        )}
        title={title}
        subheader={subtitle}
        action={action}
        titleTypographyProps={{ variant: 'h5' }}
        subheaderTypographyProps={{ variant: 'body2' }}
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 1 }}>{children}</CardContent>
    </Card>
  );
}

function SettingsToggle({
  label, description, checked, onChange, disabled, icon,
}) {
  return (
    <Box sx={{
      display: 'flex',
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1.5,
      my: 0.75,
      p: 1.25,
      bgcolor: checked ? 'rgba(29, 155, 240, 0.08)' : 'action.hover',
      border: '1px solid',
      borderColor: checked ? 'rgba(29, 155, 240, 0.28)' : 'divider',
      borderRadius: 2.5,
      transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
      boxShadow: checked ? '0 8px 24px rgba(29, 155, 240, 0.08)' : 'none',
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
          bgcolor: checked ? 'rgba(29, 155, 240, 0.14)' : 'action.selected',
          borderRadius: 2,
          '& svg': { fontSize: 21 },
        }}
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
  const [tab, setTab] = useState(0);
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
  const [resetError, setResetError] = useState('');
  const [resettingDatabase, setResettingDatabase] = useState(false);
  const cloudReady = isSupabaseConfigured();

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

  const updatePreference = (partial) => {
    setForm((current) => ({ ...current, ...partial }));
    updateSettings(partial);
  };

  const handleSaveBusiness = (event) => {
    event.preventDefault();
    updateSettings({
      businessName: form.businessName.trim(),
      businessPhone: form.businessPhone.trim(),
      businessAddress: form.businessAddress.trim(),
    });
    toast.success('Business profile saved.');
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
    setResetError('');
  };

  const handleResetDatabase = async () => {
    if (!currentAdmin || currentAdmin.role !== 'Owner') {
      setResetError('Only the signed-in Owner can reset the database.');
      return;
    }
    if (resetPhrase !== 'RESET DATABASE') {
      setResetError('Type RESET DATABASE exactly to continue.');
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
      toast.success(`Database cleared. ${Number(result.deletedRows) || 0} records removed; user accounts were preserved.`);
    } catch (error) {
      setResetError(error.message || 'The database could not be reset.');
    } finally {
      setResettingDatabase(false);
    }
  };

  return (
    <PageShell title="Settings" subtitle="Control the admin workspace, ordering rules, prices, and account security">
      <Card sx={{ mb: 3, overflow: 'visible' }}>
        <Tabs
          value={tab}
          onChange={(event, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Settings sections"
          sx={{ px: { xs: 0.5, sm: 1.5 }, minHeight: 58 }}
        >
          <Tab icon={<PaletteOutlinedIcon />} iconPosition="start" label="Workspace" />
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
              title="Appearance"
              subtitle="Choose a comfortable, consistent workspace"
              icon={<PaletteOutlinedIcon />}
            >
              <Typography variant="overline" color="text.secondary">Color theme</Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={form.themeMode || (form.darkMode ? 'dark' : 'light')}
                onChange={(event, value) => value && updatePreference({
                  themeMode: value,
                  darkMode: value === 'dark',
                })}
                sx={{ mt: 0.5, mb: 2 }}
              >
                <ToggleButton value="light"><LightModeRoundedIcon sx={{ mr: 1 }} />Light</ToggleButton>
                <ToggleButton value="dark"><DarkModeRoundedIcon sx={{ mr: 1 }} />Dark</ToggleButton>
                <ToggleButton value="system"><SettingsBrightnessRoundedIcon sx={{ mr: 1 }} />System</ToggleButton>
              </ToggleButtonGroup>

              <Divider />
              <SettingsToggle
                label="Compact workspace"
                description="Fit more rows and controls on desktop screens."
                checked={form.compactMode}
                onChange={(event) => updatePreference({ compactMode: event.target.checked })}
                icon={<ViewCompactRoundedIcon />}
              />
              <SettingsToggle
                label="Reduce animations"
                description="Use calmer page and status transitions."
                checked={form.reduceMotion}
                onChange={(event) => updatePreference({ reduceMotion: event.target.checked })}
                icon={<MotionPhotosOffRoundedIcon />}
              />
              <SettingsToggle
                label="Show customer map"
                description="Display geographic coverage on the main dashboard."
                checked={form.showDashboardMap}
                onChange={(event) => updatePreference({ showDashboardMap: event.target.checked })}
                icon={<MapRoundedIcon />}
              />

              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="sidebar-position-label">Sidebar position</InputLabel>
                    <Select
                      labelId="sidebar-position-label"
                      label="Sidebar position"
                      value={form.sidebarPosition || 'left'}
                      onChange={(event) => updatePreference({ sidebarPosition: event.target.value })}
                    >
                      <MenuItem value="left">Left</MenuItem>
                      <MenuItem value="right">Right</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="page-size-label">Rows per page</InputLabel>
                    <Select
                      labelId="page-size-label"
                      label="Rows per page"
                      value={Number(form.defaultPageSize) || 10}
                      onChange={(event) => updatePreference({ defaultPageSize: Number(event.target.value) })}
                    >
                      {[10, 20, 50].map((value) => <MenuItem key={value} value={value}>{value} rows</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </SettingsCard>
          </Grid>

          <Grid item xs={12} lg={6}>
            <SettingsCard
              title="Business profile"
              subtitle="Used on invoices and customer-facing records"
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
                    label="Business address"
                    value={form.businessAddress || ''}
                    onChange={updateForm('businessAddress')}
                    multiline
                    minRows={3}
                    helperText="This address appears on invoices and public invoice lookup."
                    fullWidth
                  />
                  <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} sx={{ alignSelf: 'flex-start' }}>
                    Save business profile
                  </Button>
                </Stack>
              </Box>
            </SettingsCard>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <SettingsCard
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

          <Grid item xs={12} lg={5}>
            <SettingsCard
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
        </Grid>
      )}

      {tab === 2 && (
        <SettingsCard
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
          title="Reset business database"
          subtitle="Remove all operational data while preserving user accounts"
          icon={<DeleteSweepRoundedIcon />}
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

      <Dialog open={resetDialogOpen} onClose={closeResetDialog} fullWidth maxWidth="sm">
        <DialogTitle>Reset the business database?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="error">
              This cannot be undone from the app. Export any records you need before continuing.
            </Alert>
            <TextField
              label="Type RESET DATABASE"
              value={resetPhrase}
              onChange={(event) => { setResetPhrase(event.target.value); setResetError(''); }}
              autoComplete="off"
              disabled={resettingDatabase}
              autoFocus
            />
            <TextField
              label="Owner password"
              type="password"
              value={resetOwnerPassword}
              onChange={(event) => { setResetOwnerPassword(event.target.value); setResetError(''); }}
              autoComplete="current-password"
              disabled={resettingDatabase}
              error={Boolean(resetError)}
              helperText={resetError || 'Your password is checked again before any data is removed.'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetDialog} disabled={resettingDatabase}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleResetDatabase}
            disabled={resetPhrase !== 'RESET DATABASE' || !resetOwnerPassword || resettingDatabase}
            startIcon={resettingDatabase ? <CircularProgress size={17} color="inherit" /> : <DeleteSweepRoundedIcon />}
          >
            {resettingDatabase ? 'Clearing data…' : 'Reset database'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
