import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddAPhotoOutlined,
  AlternateEmailRounded,
  CalendarMonthRounded,
  CheckRounded,
  CloseRounded,
  EditRounded,
  LocalShippingRounded,
  LocationOnRounded,
  PersonAddAltRounded,
  PersonOutlineRounded,
  PhoneRounded,
  SearchRounded,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import { useCustomers } from '../../context/CustomerContext';
import { DEFAULT_COUNTRY_CODE } from '../../data/constants';
import { validateCustomerForm, normalizePhone } from '../../utils/validation';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import { compressImageFile } from '../../utils/imageCompression';

const PAYMENT_SCHEDULES = [
  {
    value: 'monthly',
    label: 'Monthly account',
    hint: 'Deliveries build a running balance',
    icon: CalendarMonthRounded,
  },
  {
    value: 'on_delivery',
    label: 'Pay on delivery',
    hint: 'Cash captured with each sale',
    icon: LocalShippingRounded,
  },
];

const initialForm = {
  name: '',
  phone: DEFAULT_COUNTRY_CODE,
  address: '',
  email: '',
  photo: '',
  paymentSchedule: 'monthly',
};

const panelBaseSx = {
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  boxShadow: { xs: '0 12px 32px rgba(4, 18, 43, 0.08)', sm: '0 20px 60px rgba(4, 18, 43, 0.12)' },
};

const formPanelSx = {
  ...panelBaseSx,
  height: '100%',
};

const listPanelSx = {
  ...panelBaseSx,
};

function DetailRow({ icon, label, children }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ color: 'primary.main', display: 'grid', placeItems: 'center', mt: 0.25 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.09em' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{children || 'Not provided'}</Typography>
      </Box>
    </Stack>
  );
}

export default function AddCustomer({ history }) {
  const {
    customers,
    addCustomer,
    loading,
    refresh,
  } = useCustomers();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const digits = query.replace(/\D/g, '');
    if (!query) return customers;
    return customers.filter((customer) => (
      (customer.name || '').toLowerCase().includes(query)
      || (customer.email || '').toLowerCase().includes(query)
      || (digits && String(customer.phone || '').replace(/\D/g, '').includes(digits))
    ));
  }, [customers, search]);

  const selected = customers.find((customer) => customer.id === selectedId);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleImage = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setPreview(dataUrl);
      updateForm('photo', dataUrl);
    } catch (error) {
      toast.error(error.message || 'Could not process this image.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validateCustomerForm(form);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setSaving(true);
    try {
      await addCustomer(form);
      setForm(initialForm);
      setPreview('');
      toast.success('Customer added successfully.');
    } catch (error) {
      toast.error(error.message || 'Could not add the customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      title="Add customer"
      subtitle="Register a delivery account or review an existing customer profile."
    >
      <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">
        <Grid item xs={12} lg={5}>
          <Card sx={formPanelSx}>
            <Box
              sx={{
                p: { xs: 2.25, sm: 3 },
                color: 'common.white',
                background: 'linear-gradient(135deg, var(--hs-primary) 0%, var(--hs-secondary) 100%)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,.15)', display: 'grid', placeItems: 'center' }}>
                  <PersonAddAltRounded />
                </Box>
                <Box>
                  <Typography variant="h6">New delivery customer</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.75)' }}>
                    Required fields are marked below.
                  </Typography>
                </Box>
              </Stack>
            </Box>
            <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
              <Box
                component="form"
                onSubmit={handleSubmit}
                noValidate
                sx={{ '& .MuiOutlinedInput-root': { minHeight: 40 } }}
              >
                <Stack spacing={1.5}>
                  <Stack alignItems="center" spacing={0.75}>
                    <ButtonBase
                      component="label"
                      aria-label="Choose a customer photo"
                      focusRipple
                      sx={{
                        position: 'relative',
                        borderRadius: '50%',
                        p: 0.5,
                        '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 3 },
                      }}
                    >
                      <input
                        id="customer-photo"
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleImage}
                      />
                      <Avatar
                        src={preview || undefined}
                        sx={{
                          width: 72,
                          height: 72,
                          bgcolor: 'primary.main',
                          boxShadow: '0 12px 30px rgba(20,115,230,.3)',
                        }}
                      >
                        <AddAPhotoOutlined fontSize="large" />
                      </Avatar>
                      <Box sx={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: '50%', bgcolor: 'background.paper', color: 'primary.main', display: 'grid', placeItems: 'center', boxShadow: 2 }}>
                        <AddAPhotoOutlined sx={{ fontSize: 17 }} />
                      </Box>
                    </ButtonBase>
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      Optional photo. Large images are compressed automatically.
                    </Typography>
                  </Stack>

                  {/* Name and phone are both short; pairing them saves a row
                      without cramping either field. */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    <TextField
                      label="Full name"
                      placeholder="e.g. Ayesha Khan"
                      value={form.name}
                      onChange={(event) => updateForm('name', event.target.value)}
                      required
                      error={Boolean(errors.name)}
                      helperText={errors.name}
                      autoComplete="name"
                      InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlineRounded /></InputAdornment> }}
                    />
                    <TextField
                      label="Phone number"
                      placeholder="+92 3XX XXXXXXX"
                      value={form.phone}
                      onChange={(event) => updateForm('phone', normalizePhone(event.target.value))}
                      required
                      error={Boolean(errors.phone)}
                      helperText={errors.phone || 'Use a Pakistan number with country code.'}
                      autoComplete="tel"
                      inputMode="tel"
                      InputProps={{ startAdornment: <InputAdornment position="start"><PhoneRounded /></InputAdornment> }}
                    />
                  </Box>
                  <TextField
                    label="Delivery address"
                    placeholder="House / shop number, street, area, city"
                    value={form.address}
                    onChange={(event) => updateForm('address', event.target.value)}
                    required
                    multiline
                    minRows={2}
                    error={Boolean(errors.address)}
                    helperText={errors.address}
                    autoComplete="street-address"
                    InputProps={{ startAdornment: <InputAdornment position="start"><LocationOnRounded /></InputAdornment> }}
                  />
                  <TextField
                    label="Email address"
                    placeholder="name@example.com"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    error={Boolean(errors.email)}
                    helperText={errors.email || 'Optional'}
                    autoComplete="email"
                    InputProps={{ startAdornment: <InputAdornment position="start"><AlternateEmailRounded /></InputAdornment> }}
                  />
                  <Box>
                    <Typography variant="body2" fontWeight={800} sx={{ mb: 0.75 }}>
                      Payment schedule
                    </Typography>
                    {/* Choice cards rather than plain toggles: each option
                        states what it does, and the active one is carried by
                        border, tint and a check — not colour alone. */}
                    <Box
                      role="radiogroup"
                      aria-label="Customer payment schedule"
                      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}
                    >
                      {PAYMENT_SCHEDULES.map((option) => {
                        const selected = form.paymentSchedule === option.value;
                        const OptionIcon = option.icon;
                        return (
                          <Box
                            key={option.value}
                            component="button"
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => updateForm('paymentSchedule', option.value)}
                            sx={(theme) => ({
                              position: 'relative',
                              display: 'grid',
                              gridTemplateColumns: 'auto minmax(0, 1fr)',
                              alignItems: 'start',
                              gap: 1,
                              p: 1.15,
                              font: 'inherit',
                              textAlign: 'left',
                              cursor: 'pointer',
                              color: 'text.primary',
                              bgcolor: selected ? alpha(theme.palette.primary.main, 0.1) : 'action.hover',
                              border: '1.5px solid',
                              borderColor: selected ? 'primary.main' : 'divider',
                              borderRadius: 2,
                              boxShadow: selected ? `0 6px 18px ${alpha(theme.palette.primary.main, 0.18)}` : 'none',
                              transition: 'border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease',
                              '&:hover': { borderColor: selected ? 'primary.main' : 'text.secondary' },
                              '&:focus-visible': { outline: '3px solid', outlineColor: alpha(theme.palette.primary.main, 0.4), outlineOffset: 2 },
                            })}
                          >
                            <Box sx={{
                              display: 'grid',
                              width: 30,
                              height: 30,
                              placeItems: 'center',
                              color: selected ? 'primary.main' : 'text.secondary',
                              bgcolor: 'background.paper',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1.5,
                              '& svg': { fontSize: 17 },
                            }}
                            >
                              <OptionIcon />
                            </Box>
                            <Box sx={{ minWidth: 0, pr: 2 }}>
                              <Typography variant="body2" fontWeight={750} noWrap>{option.label}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35 }}>
                                {option.hint}
                              </Typography>
                            </Box>
                            {selected && (
                              <Box aria-hidden="true" sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                display: 'grid',
                                width: 18,
                                height: 18,
                                placeItems: 'center',
                                color: 'primary.contrastText',
                                bgcolor: 'primary.main',
                                borderRadius: '50%',
                                '& svg': { fontSize: 12 },
                              }}
                              >
                                <CheckRounded />
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                      Monthly deliveries build an account balance; pay-on-delivery entries capture cash with each sale.
                    </Typography>
                  </Box>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <PersonAddAltRounded />}
                    fullWidth
                    sx={{ minHeight: 48 }}
                  >
                    {saving ? 'Saving customer…' : 'Add customer'}
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Stack spacing={2}>
          <Card sx={listPanelSx}>
            <Box sx={{ p: { xs: 2.25, sm: 3 }, pb: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box>
                  <Typography variant="h6">Existing customers</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Select a person to review or edit their profile.
                  </Typography>
                </Box>
                <Chip
                  label={search ? `${filteredCustomers.length} of ${customers.length}` : `${customers.length} registered`}
                  color="primary"
                  variant="outlined"
                  aria-live="polite"
                  sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                />
              </Stack>
              <TextField
                fullWidth
                size="small"
                label="Search customers"
                placeholder="Search by name, email, or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment>,
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="Clear customer search"
                        onClick={() => setSearch('')}
                        sx={{ width: 44, height: 44 }}
                      >
                        <CloseRounded />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{ mt: 2.5, '& .MuiOutlinedInput-root': { minHeight: 48 } }}
              />
            </Box>
            <Divider />
            {loading ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 7 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">Loading customers…</Typography>
              </Stack>
            ) : filteredCustomers.length === 0 ? (
              <Stack alignItems="center" spacing={1} sx={{ py: 7, px: 2, textAlign: 'center' }}>
                <PersonOutlineRounded sx={{ fontSize: 44, color: 'text.disabled' }} />
                <Typography variant="subtitle1">{search ? 'No matching customers' : 'No customers yet'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {search ? 'Try a different name, email, or phone number.' : 'Use the form to create the first customer.'}
                </Typography>
              </Stack>
            ) : (
              <List
                disablePadding
                aria-label="Existing customers"
                sx={{ maxHeight: { xs: 440, lg: 560 }, overflowY: 'auto', overscrollBehavior: 'contain' }}
              >
                {filteredCustomers.map((customer, index) => (
                  <ListItem
                    key={customer.id}
                    divider
                    disablePadding
                    sx={{
                      display: 'block',
                    }}
                  >
                    <ListItemButton
                      aria-label={`Open ${customer.name}`}
                      aria-expanded={selectedId === customer.id}
                      aria-controls={selectedId === customer.id ? 'customer-profile-details' : undefined}
                      onClick={() => setSelectedId(customer.id)}
                      sx={{
                      px: { xs: 1.25, sm: 2 },
                      py: { xs: 1.25, sm: 1.5 },
                      color: 'text.primary',
                      bgcolor: selectedId === customer.id ? 'action.selected' : 'transparent',
                      transition: 'background-color 160ms ease, transform 160ms ease',
                      '&:hover': { bgcolor: selectedId === customer.id ? 'action.selected' : 'action.hover' },
                      '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light', outlineOffset: -3 },
                      }}
                    >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0, 1fr)',
                        alignItems: 'center',
                        columnGap: 1.25,
                        rowGap: 1,
                        minWidth: 0,
                      }}
                    >
                      <Avatar src={customer.photo || getCustomerAvatar(index)}>
                        {(customer.name || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={800} noWrap>{customer.name}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                          {customer.phone || customer.email || 'No contact details'}
                        </Typography>
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                          {(customer.source === 'portal' || customer.source === 'both') && (
                            <Chip size="small" label="App customer" color="info" variant="outlined" />
                          )}
                          <Chip
                            size="small"
                            label={`${customer.orderCount === undefined ? (customer.purchaseHistory || []).length : customer.orderCount} orders`}
                          />
                        </Stack>
                      </Box>
                    </Box>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Card>

          {selected && (
            <Card id="customer-profile-details" sx={listPanelSx}>
              <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 }, color: 'common.white', background: 'linear-gradient(135deg, var(--hs-primary), var(--hs-secondary))' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Avatar src={selected.photo || getCustomerAvatar(0)} sx={{ width: { xs: 44, sm: 52 }, height: { xs: 44, sm: 52 }, border: '2px solid rgba(255,255,255,.4)' }}>
                      {(selected.name || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" noWrap>{selected.name}</Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.72)' }}>Customer profile</Typography>
                    </Box>
                  </Stack>
                  <IconButton aria-label="Close customer details" onClick={() => setSelectedId(null)} sx={{ color: 'inherit', flex: '0 0 auto', width: 44, height: 44 }}>
                    <CloseRounded />
                  </IconButton>
                </Stack>
              </Box>
              <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={6}><DetailRow icon={<PhoneRounded />} label="Phone">{selected.phone}</DetailRow></Grid>
                  <Grid item xs={12} sm={6}><DetailRow icon={<AlternateEmailRounded />} label="Email">{selected.email}</DetailRow></Grid>
                  <Grid item xs={12}><DetailRow icon={<LocationOnRounded />} label="Delivery address">{selected.address}</DetailRow></Grid>
                  <Grid item xs={12} sm={6}>
                    <DetailRow icon={<LocalShippingRounded />} label="Payment terms">
                      {selected.paymentSchedule === 'on_delivery' ? 'Pay on delivery' : 'Monthly account'}
                    </DetailRow>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DetailRow icon={<CalendarMonthRounded />} label="Date added">
                      {selected.createdAt
                        ? new Date(selected.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'Not available'}
                    </DetailRow>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DetailRow icon={<PersonOutlineRounded />} label="Account source">
                      {selected.source === 'both' ? 'Customer app account' : selected.source === 'portal' ? 'Customer app signup' : 'Created by admin'}
                    </DetailRow>
                  </Grid>
                </Grid>
              </CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  px: { xs: 2.25, sm: 3 },
                  pb: { xs: 2.25, sm: 3 },
                  pt: 0,
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<EditRounded />}
                  aria-label={`Edit ${selected.name}`}
                  onClick={() => history.push(`/app/customers/${selected.id}/edit`)}
                  sx={{
                    minHeight: 48,
                    minWidth: { xs: 0, sm: 210 },
                    width: { xs: '100%', sm: 'auto' },
                    maxWidth: '100%',
                    px: { xs: 2, sm: 2.5 },
                    color: 'common.white',
                    background: 'linear-gradient(135deg, var(--hs-primary) 0%, var(--hs-secondary) 100%)',
                    boxShadow: '0 12px 28px color-mix(in srgb, var(--hs-primary) 28%, transparent)',
                    '&:hover': { filter: 'brightness(1.06)', boxShadow: '0 16px 32px color-mix(in srgb, var(--hs-primary) 34%, transparent)' },
                  }}
                >
                  Edit customer details
                </Button>
              </Box>
            </Card>
          )}
          </Stack>
        </Grid>
      </Grid>
    </PageShell>
  );
}
