import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import { useCustomers } from '../../context/CustomerContext';
import { normalizePhone, validateCustomerForm } from '../../utils/validation';
import { getInitials } from '../../utils/formatters';
import { compressImageFile } from '../../utils/imageCompression';
import LoadingState from '../../components/LoadingState/LoadingState';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { getCustomerBottlePrices, saveCustomerBottlePrices } from '../../services/api/customerBottlePriceApi';
import './EditCustomer.css';

const MONTHLY = 'monthly';
const ON_DELIVERY = 'on_delivery';

const emptyForm = {
  name: '',
  phone: '+92',
  address: '',
  email: '',
  photo: '',
  paymentSchedule: MONTHLY,
};

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
  const [customerPrices, setCustomerPrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!customer) return;
    setForm({
      name: customer.name || '',
      phone: customer.phone || '+92',
      address: customer.address || '',
      email: customer.email || '',
      photo: customer.photo || '',
      paymentSchedule: customer.paymentSchedule === ON_DELIVERY ? ON_DELIVERY : MONTHLY,
    });
  }, [customer]);

  useEffect(() => {
    if (!customer) return undefined;
    let active = true;
    setPricesLoading(true);
    getCustomerBottlePrices(customer.id)
      .then((assignedPrices) => {
        if (active) setCustomerPrices(assignedPrices);
      })
      .catch((error) => {
        if (active) toast.error(error.message || 'Could not load customer bottle prices.');
      })
      .finally(() => { if (active) setPricesLoading(false); });
    return () => { active = false; };
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
      await saveCustomerBottlePrices(customerId, customerPrices);
      await updateCustomer(customerId, form);
      toast.success('Customer profile, payment timing, and bottle prices updated.');
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

  const paysOnDelivery = form.paymentSchedule === ON_DELIVERY;

  return (
    <PageShell
      title="Edit customer"
      subtitle="Contact details, agreed prices, and payment preferences in one place."
      actions={(
        <Button
          color="inherit"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => history.push('/app/customers')}
        >
          Customer records
        </Button>
      )}
    >
      <motion.div
        className="edit-customer-shell"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="edit-customer-card" elevation={0}>
          <Box className="edit-customer-hero">
            <span className="edit-customer-hero__orb edit-customer-hero__orb--one" aria-hidden="true" />
            <span className="edit-customer-hero__orb edit-customer-hero__orb--two" aria-hidden="true" />
            <Avatar className="edit-customer-hero__avatar" src={form.photo || undefined}>
              {getInitials(form.name)}
            </Avatar>
            <Box className="edit-customer-hero__copy">
              <Stack direction="row" alignItems="center" spacing={0.7}>
                <VerifiedRoundedIcon sx={{ fontSize: 16 }} />
                <Typography variant="overline">Customer account</Typography>
              </Stack>
              <Typography variant="h3">{form.name || customer.name}</Typography>
              <Typography variant="body2">
                {form.phone || 'No phone'} <span aria-hidden="true">&middot;</span>{' '}
                {(customer.purchaseHistory || []).length} recorded sales
              </Typography>
            </Box>
            <Box className="edit-customer-hero__status">
              <span aria-hidden="true" />
              Active profile
            </Box>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <CardContent className="edit-customer-section">
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
                    <Box className="edit-customer-section__icon"><PersonOutlineRoundedIcon /></Box>
                    <Box>
                      <Typography variant="h5">Profile &amp; delivery</Typography>
                      <Typography variant="body2" color="text.secondary">
                        The details the delivery team sees.
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={2}
                    className="edit-customer-photo"
                  >
                    <Avatar src={form.photo || undefined} className="edit-customer-photo__avatar">
                      {getInitials(form.name)}
                    </Avatar>
                    <Box>
                      <Button component="label" variant="outlined" startIcon={<CameraAltOutlinedIcon />}>
                        Replace photo
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
                        placeholder="e.g. Ayesha Khan"
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
                        placeholder="+92 3XX XXXXXXX"
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
                    <Grid item xs={12}>
                      <TextField
                        label="Email address"
                        placeholder="name@example.com"
                        type="email"
                        value={form.email}
                        onChange={(event) => setField('email', event.target.value)}
                        error={Boolean(errors.email)}
                        helperText={errors.email || 'Optional for administrator-created customers.'}
                        autoComplete="email"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Delivery address"
                        placeholder="House / shop number, street, area, city"
                        value={form.address}
                        onChange={(event) => setField('address', event.target.value)}
                        error={Boolean(errors.address)}
                        helperText={errors.address}
                        autoComplete="street-address"
                        required
                        multiline
                        minRows={2}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Grid>

              <Grid item xs={12} md={5}>
                <Stack spacing={2.25}>
                  <Box className={`edit-customer-billing${paysOnDelivery ? ' is-on-delivery' : ''}`}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Box className="edit-customer-billing__icon">
                        {paysOnDelivery ? <PaymentsOutlinedIcon /> : <CalendarMonthRoundedIcon />}
                      </Box>
                      <Switch
                        checked={paysOnDelivery}
                        onChange={(event) => setField('paymentSchedule', event.target.checked ? ON_DELIVERY : MONTHLY)}
                        color="success"
                        inputProps={{ 'aria-label': 'Customer pays on delivery' }}
                      />
                    </Stack>
                    <Typography variant="overline" color="text.secondary">Payment policy</Typography>
                    <Typography variant="h5">
                      {paysOnDelivery ? 'Pays on delivery' : 'Monthly account'}
                    </Typography>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={form.paymentSchedule}
                        initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
                        transition={{ duration: 0.18 }}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                          {paysOnDelivery
                            ? 'Daily Sales will expect a payment amount, while still allowing partial payment.'
                            : 'Sales can be recorded without payment and settled with the month-end invoice.'}
                        </Typography>
                      </motion.div>
                    </AnimatePresence>
                    <Stack direction="row" alignItems="center" spacing={0.8} className="edit-customer-billing__hint">
                      <LocalShippingOutlinedIcon fontSize="small" />
                      <Typography variant="caption">
                        Switch on for customers who normally pay at the doorstep.
                      </Typography>
                    </Stack>
                  </Box>

                  <Box className="edit-customer-prices">
                    <Typography variant="h6">Agreed bottle prices</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Used in the customer portal and order calculations.
                    </Typography>
                    {pricesLoading ? <LoadingState compact label="Loading prices..." variant="form" /> : (
                      <Stack spacing={1.5}>
                        {BOTTLE_TYPES.map((type) => (
                          <TextField
                            key={type}
                            fullWidth
                            size="small"
                            label={BOTTLE_TYPE_LABELS[type] || type}
                            type="number"
                            value={customerPrices[type] === undefined ? '' : customerPrices[type]}
                            onChange={(event) => setCustomerPrices((current) => ({ ...current, [type]: event.target.value }))}
                            InputProps={{
                              startAdornment: <Box component="span" sx={{ mr: 0.75, color: 'text.secondary', fontWeight: 700 }}>PKR</Box>,
                              inputProps: { min: 0, step: '0.01' },
                            }}
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </Grid>
            </Grid>

            <Divider sx={{ mt: 3 }} />
            <Stack
              direction={{ xs: 'column-reverse', sm: 'row' }}
              justifyContent="space-between"
              spacing={1.5}
              className="edit-customer-footer"
            >
              <Button
                color="error"
                variant="text"
                startIcon={<DeleteOutlineRoundedIcon />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete customer
              </Button>
              <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.25}>
                <Button color="inherit" onClick={() => history.push('/app/customers')}>Cancel</Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={17} color="inherit" /> : <SaveRoundedIcon />}
                  disabled={saving || pricesLoading}
                  sx={{ minWidth: 160 }}
                >
                  {saving ? 'Saving profile...' : 'Save changes'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Card>
      </motion.div>

      <Dialog
        open={deleteOpen}
        onClose={closeDeleteDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ className: 'edit-customer-delete-dialog' }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box className="edit-customer-delete-dialog__icon"><DeleteOutlineRoundedIcon /></Box>
            <Box>
              <Typography variant="h5">Delete customer?</Typography>
              <Typography variant="body2" color="text.secondary">This action is permanent.</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
            The profile, sales history, linked orders, and saved invoices will all be removed.
          </Alert>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Type <strong>{customer.name}</strong> to confirm.
          </Typography>
          <TextField
            placeholder={customer.name}
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            autoComplete="off"
            disabled={deleting}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button color="inherit" onClick={closeDeleteDialog} disabled={deleting}>Keep customer</Button>
          <Button
            color="error"
            variant="contained"
            startIcon={deleting ? <CircularProgress size={17} color="inherit" /> : <DeleteOutlineRoundedIcon />}
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
