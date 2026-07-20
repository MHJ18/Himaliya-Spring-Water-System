import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import { useCustomers } from '../../context/CustomerContext';
import { normalizePhone, validateCustomerForm } from '../../utils/validation';
import { getInitials } from '../../utils/formatters';
import { compressImageFile } from '../../utils/imageCompression';
import LoadingState from '../../components/LoadingState/LoadingState';
import './EditCustomer.css';

const emptyForm = { name: '', phone: '+92', address: '', email: '', photo: '' };

export default function EditCustomer({ match, history }) {
  const { customerId } = match.params;
  const {
    customers, loading, updateCustomer, deleteCustomer,
  } = useCustomers();
  const customer = customers.find((item) => item.id === customerId);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setForm({
      name: customer.name || '',
      phone: customer.phone || '+92',
      address: customer.address || '',
      email: customer.email || '',
      photo: customer.photo || '',
    });
  }, [customer]);

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handlePhoto = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setField('photo', dataUrl);
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
      await updateCustomer(customerId, form);
      toast.success('Customer details updated.');
      history.push('/app/customers');
    } catch (error) {
      toast.error(error.message || 'Could not update customer.');
    } finally {
      setSaving(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteConfirmation('');
  };

  const handleDelete = async () => {
    if (!customer || deleteConfirmation.trim() !== customer.name) return;
    setDeleting(true);
    try {
      await deleteCustomer(customerId);
      toast.success(`${customer.name} was deleted.`);
      history.replace('/app/customers');
    } catch (error) {
      toast.error(error.message || 'Could not delete customer.');
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageShell title="Edit customer"><LoadingState label="Loading customer profile..." variant="form" /></PageShell>;
  }

  if (!customer) {
    return (
      <PageShell title="Customer not found" subtitle="This customer may have been removed">
        <Button variant="contained" onClick={() => history.replace('/app/customers')}>Back to customer records</Button>
      </PageShell>
    );
  }

  return (
    <PageShell title="Edit customer" subtitle={`Update ${customer.name}'s contact and delivery details`}>
      <Button
        color="inherit"
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => history.push('/app/customers')}
        sx={{ mb: 2 }}
      >
        Back to customer records
      </Button>

      <Widget className="edit-customer-card">
        <Box sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3,
          p: 2,
          color: '#f6fcff',
          background: 'linear-gradient(125deg, #075b84, #0a81ad 58%, #35b7d7)',
          borderRadius: 2.5,
        }}
        >
          <Avatar
            src={form.photo || undefined}
            sx={{ width: 72, height: 72, bgcolor: 'rgba(255,255,255,.18)', fontWeight: 800 }}
          >
            {getInitials(form.name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="overline" sx={{ color: '#bff3ff' }}>Customer workspace</Typography>
            <Typography variant="h3" sx={{ color: '#fff', overflowWrap: 'anywhere' }}>{customer.name}</Typography>
            <Typography variant="body2" sx={{ color: '#d9f6ff' }}>
              {customer.phone} &middot; {(customer.purchaseHistory || []).length} recorded orders
            </Typography>
          </Box>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.7, px: 1.25, py: 0.7,
            bgcolor: 'rgba(255,255,255,.12)', borderRadius: 99, fontSize: '0.75rem', fontWeight: 750,
          }}
          >
            <i style={{ width: 7, height: 7, background: '#6ff2bd', borderRadius: '50%' }} />
            Active account
          </Box>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2 }}>
          <Box sx={{
            display: 'grid', width: 42, height: 42, placeItems: 'center',
            color: 'primary.main', bgcolor: 'rgba(29,155,240,.1)', borderRadius: 2,
          }}
          >
            <PersonOutlineRoundedIcon />
          </Box>
          <Box>
            <Typography variant="h5">Delivery profile</Typography>
            <Typography variant="body2" color="text.secondary">Purchase history remains unchanged.</Typography>
          </Box>
        </Stack>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
            <Avatar
              src={form.photo || undefined}
              sx={{ width: 78, height: 78, bgcolor: 'primary.main', fontWeight: 800 }}
            >
              {getInitials(form.name)}
            </Avatar>
            <Box>
              <Button component="label" variant="outlined" startIcon={<CameraAltOutlinedIcon />}>
                Change photo
                <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhoto} />
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                JPG, PNG, or WebP. Large images are compressed automatically.
              </Typography>
            </Box>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Full name"
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                error={Boolean(errors.name)}
                helperText={errors.name}
                autoComplete="name"
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone number"
                type="tel"
                value={form.phone}
                onChange={(event) => setField('phone', normalizePhone(event.target.value))}
                error={Boolean(errors.phone)}
                helperText={errors.phone}
                autoComplete="tel"
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email address"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                error={Boolean(errors.email)}
                helperText={errors.email || 'Optional for customers created by an administrator.'}
                autoComplete="email"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Delivery address"
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
                error={Boolean(errors.address)}
                helperText={errors.address}
                autoComplete="street-address"
                required
                fullWidth
              />
            </Grid>
          </Grid>

          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mt: 3 }}>
            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete customer
            </Button>
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5}>
              <Button color="inherit" onClick={() => history.push('/app/customers')}>Cancel</Button>
              <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Widget>

      <Dialog open={deleteOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Delete customer</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This cannot be undone. The customer, sales history, linked orders, and saved invoices will be permanently removed.
          </Alert>
          <TextField
            label={`Type "${customer.name}" to confirm`}
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            autoComplete="off"
            disabled={deleting}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={closeDeleteDialog} disabled={deleting}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={handleDelete}
            disabled={deleting || deleteConfirmation.trim() !== customer.name}
          >
            {deleting ? 'Deleting...' : 'Permanently delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
