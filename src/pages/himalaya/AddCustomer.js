import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
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
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddAPhotoOutlined,
  AlternateEmailRounded,
  CalendarMonthRounded,
  CloseRounded,
  EditRounded,
  LocationOnRounded,
  PersonAddAltRounded,
  PersonOutlineRounded,
  PhoneRounded,
  SearchRounded,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import { useCustomers } from '../../context/CustomerContext';
import { DEFAULT_COUNTRY_CODE } from '../../data/constants';
import { validateCustomerForm, normalizePhone } from '../../utils/validation';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import { compressImageFile } from '../../utils/imageCompression';

const initialForm = {
  name: '',
  phone: DEFAULT_COUNTRY_CODE,
  address: '',
  email: '',
  photo: '',
};

const panelBaseSx = {
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  boxShadow: '0 20px 60px rgba(4, 18, 43, 0.12)',
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
      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} lg={5}>
          <Card sx={formPanelSx}>
            <Box
              sx={{
                p: { xs: 2.25, sm: 3 },
                color: 'common.white',
                background: 'linear-gradient(135deg, #1473e6 0%, #5c3ce5 100%)',
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
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Stack spacing={2.25}>
                  <Stack alignItems="center" spacing={1}>
                    <input
                      id="customer-photo"
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleImage}
                    />
                    <Box component="label" htmlFor="customer-photo" sx={{ cursor: 'pointer', position: 'relative' }}>
                      <Avatar
                        src={preview || undefined}
                        sx={{
                          width: 92,
                          height: 92,
                          bgcolor: 'primary.main',
                          boxShadow: '0 12px 30px rgba(20,115,230,.3)',
                        }}
                      >
                        <AddAPhotoOutlined fontSize="large" />
                      </Avatar>
                      <Box sx={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: '50%', bgcolor: 'background.paper', color: 'primary.main', display: 'grid', placeItems: 'center', boxShadow: 2 }}>
                        <AddAPhotoOutlined sx={{ fontSize: 17 }} />
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">Optional photo. Large images are compressed automatically.</Typography>
                  </Stack>

                  <TextField
                    label="Full name"
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
                    value={form.phone}
                    onChange={(event) => updateForm('phone', normalizePhone(event.target.value))}
                    required
                    error={Boolean(errors.phone)}
                    helperText={errors.phone || 'Use a Pakistan number with country code.'}
                    autoComplete="tel"
                    inputMode="tel"
                    InputProps={{ startAdornment: <InputAdornment position="start"><PhoneRounded /></InputAdornment> }}
                  />
                  <TextField
                    label="Delivery address"
                    value={form.address}
                    onChange={(event) => updateForm('address', event.target.value)}
                    required
                    multiline
                    minRows={3}
                    error={Boolean(errors.address)}
                    helperText={errors.address}
                    autoComplete="street-address"
                    InputProps={{ startAdornment: <InputAdornment position="start"><LocationOnRounded /></InputAdornment> }}
                  />
                  <TextField
                    label="Email address"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    error={Boolean(errors.email)}
                    helperText={errors.email || 'Optional'}
                    autoComplete="email"
                    InputProps={{ startAdornment: <InputAdornment position="start"><AlternateEmailRounded /></InputAdornment> }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <PersonAddAltRounded />}
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
                <Chip label={`${customers.length} registered`} color="primary" variant="outlined" />
              </Stack>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name, email, or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ mt: 2.5 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment>,
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton aria-label="Clear customer search" size="small" onClick={() => setSearch('')}>
                        <CloseRounded />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
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
              <List disablePadding sx={{ maxHeight: { xs: 420, lg: 520 }, overflowY: 'auto' }}>
                {filteredCustomers.map((customer, index) => (
                  <ListItem key={customer.id} disablePadding divider>
                    <ListItemButton
                      selected={selectedId === customer.id}
                      onClick={() => setSelectedId(customer.id)}
                      sx={{ py: 1.25, px: { xs: 2, sm: 3 } }}
                    >
                      <ListItemAvatar>
                        <Avatar src={customer.photo || getCustomerAvatar(index)}>
                          {(customer.name || '?').charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={customer.name}
                        secondary={customer.phone || customer.email || 'No contact details'}
                        primaryTypographyProps={{ fontWeight: 700, noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                      <Stack direction="row" spacing={0.75} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                        {(customer.source === 'portal' || customer.source === 'both') && (
                          <Chip size="small" label={customer.source === 'both' ? 'Admin + app' : 'App signup'} color="info" variant="outlined" />
                        )}
                        <Chip size="small" label={`${(customer.purchaseHistory || []).length} orders`} />
                      </Stack>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Card>

          {selected && (
            <Card sx={listPanelSx}>
              <Box sx={{ p: { xs: 2.25, sm: 3 }, color: 'common.white', background: 'linear-gradient(135deg, #1473e6, #5c3ce5)' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                    <Avatar src={selected.photo || getCustomerAvatar(0)} sx={{ width: 56, height: 56, border: '2px solid rgba(255,255,255,.4)' }}>
                      {(selected.name || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" noWrap>{selected.name}</Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.72)' }}>Customer profile</Typography>
                    </Box>
                  </Stack>
                  <IconButton aria-label="Close customer details" onClick={() => setSelectedId(null)} sx={{ color: 'inherit' }}>
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
                    <DetailRow icon={<CalendarMonthRounded />} label="Date added">
                      {selected.createdAt
                        ? new Date(selected.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'Not available'}
                    </DetailRow>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DetailRow icon={<PersonOutlineRounded />} label="Account source">
                      {selected.source === 'both' ? 'Admin and customer app' : selected.source === 'portal' ? 'Customer app signup' : 'Created by admin'}
                    </DetailRow>
                  </Grid>
                </Grid>
                <Button
                  variant="outlined"
                  startIcon={<EditRounded />}
                  onClick={() => history.push(`/app/customers/${selected.id}/edit`)}
                  sx={{ mt: 3 }}
                >
                  Edit customer
                </Button>
              </CardContent>
            </Card>
          )}
          </Stack>
        </Grid>
      </Grid>
    </PageShell>
  );
}
