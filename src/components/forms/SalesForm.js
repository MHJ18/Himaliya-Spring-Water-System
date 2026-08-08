import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddShoppingCartRoundedIcon from '@mui/icons-material/AddShoppingCartRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { validateSaleForm } from '../../utils/validation';
import { formatCurrency } from '../../utils/formatters';

const initial = {
  bottleType: 'Gallon',
  quantity: 1,
  pricePerBottle: '',
  amountPaid: '',
  notes: '',
};

const salesActionSx = {
  minHeight: 46,
  px: 2.25,
  color: '#fff',
  fontWeight: 850,
  borderRadius: 999,
  background: 'linear-gradient(135deg, var(--hs-primary), var(--hs-secondary))',
  boxShadow: '0 10px 24px color-mix(in srgb, var(--hs-primary) 24%, transparent)',
  '&:hover': {
    background: 'linear-gradient(135deg, var(--hs-secondary), var(--hs-primary))',
    boxShadow: '0 14px 30px color-mix(in srgb, var(--hs-primary) 30%, transparent)',
    transform: 'translateY(-1px)',
  },
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,.7)',
    background: 'color-mix(in srgb, var(--hs-primary) 52%, #a9b7c0)',
  },
};

export default function SalesForm({
  onSubmit,
  loading,
  assignedPrices = {},
  paymentSchedule = 'monthly',
  monthlyBalance = 0,
  monthlyPaid = 0,
  onRecordMonthlyPayment,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);
  const [payDaily, setPayDaily] = useState(paymentSchedule === 'on_delivery');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [monthlyError, setMonthlyError] = useState('');
  const [showDeliveryEntry, setShowDeliveryEntry] = useState(false);
  const total = useMemo(
    () => (Number(form.quantity) || 0) * (Number(form.pricePerBottle) || 0),
    [form.quantity, form.pricePerBottle],
  );
  const isMonthlyPayment = paymentSchedule !== 'on_delivery';
  const effectivePaymentSchedule = isMonthlyPayment && !payDaily ? 'monthly' : 'on_delivery';
  const amountPaid = effectivePaymentSchedule === 'monthly'
    ? 0
    : Math.min(total, Math.max(0, Number(form.amountPaid) || 0));
  const amountDue = Math.max(0, total - amountPaid);

  const handleMonthlyPayment = async (event) => {
    event.preventDefault();
    const amount = Number(monthlyAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMonthlyError('Enter an amount greater than zero.');
      return;
    }
    if (amount > monthlyBalance) {
      setMonthlyError('Payment cannot be greater than the total unpaid balance.');
      return;
    }
    const saved = await onRecordMonthlyPayment(amount);
    if (saved !== false) {
      setMonthlyAmount('');
      setMonthlyError('');
    }
  };

  useEffect(() => {
    const savedPrice = Number(assignedPrices[form.bottleType] || 0);
    if (!form.pricePerBottle && savedPrice) {
      setForm((current) => ({ ...current, pricePerBottle: String(savedPrice) }));
    }
  }, [assignedPrices, form.bottleType, form.pricePerBottle]);

  useEffect(() => {
    if (effectivePaymentSchedule === 'monthly') {
      setAmountPaidTouched(false);
      setForm((current) => (
        current.amountPaid === '' ? current : { ...current, amountPaid: '' }
      ));
      return;
    }
    if (amountPaidTouched) return;
    const nextAmountPaid = total > 0 ? String(total) : '';
    setForm((current) => (
      current.amountPaid === nextAmountPaid
        ? current
        : { ...current, amountPaid: nextAmountPaid }
    ));
  }, [amountPaidTouched, effectivePaymentSchedule, total]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (field === 'amountPaid') setAmountPaidTouched(true);
  };

  const selectBottleType = (bottleType) => {
    const savedPrice = Number(assignedPrices[bottleType] || 0);
    setAmountPaidTouched(false);
    setForm((current) => ({
      ...current,
      bottleType,
      pricePerBottle: savedPrice ? String(savedPrice) : '',
      amountPaid: '',
    }));
    setErrors((current) => ({
      ...current,
      bottleType: undefined,
      pricePerBottle: undefined,
      amountPaid: undefined,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedForm = {
      ...form,
      amountPaid: effectivePaymentSchedule === 'monthly' ? 0 : form.amountPaid,
      paymentSchedule: effectivePaymentSchedule,
    };
    const nextErrors = validateSaleForm(normalizedForm);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const saved = await onSubmit(normalizedForm);
    if (saved !== false) {
      setForm(initial);
      setAmountPaidTouched(false);
      setPayDaily(paymentSchedule === 'on_delivery');
    }
  };

  if (isMonthlyPayment && !showDeliveryEntry) {
    return (
      <Box component="form" onSubmit={handleMonthlyPayment} sx={{ width: '100%', minWidth: 0 }}>
        <Stack spacing={2}>
          <Box
            role="status"
            aria-live="polite"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '2.5rem minmax(0, 1fr)', sm: '2.5rem minmax(0, 1fr) auto' },
              gap: 1.25,
              alignItems: 'center',
              minWidth: 0,
              p: { xs: 1.25, sm: 1.5 },
              bgcolor: 'rgba(47, 125, 255, .055)',
              border: '1px solid rgba(47, 125, 255, .18)',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'grid', width: 40, height: 40, color: 'primary.main', placeItems: 'center', bgcolor: 'rgba(47, 125, 255, .11)', borderRadius: 1.5 }}>
              <CalendarMonthRoundedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={900}>Monthly account</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .2, overflowWrap: 'anywhere' }}>
                Payments are applied to the oldest unpaid deliveries first.
              </Typography>
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, minWidth: { sm: 150 }, px: 1.25, py: .8, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={800}>Unpaid balance</Typography>
              <Typography variant="subtitle1" fontWeight={900} sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(monthlyBalance)}</Typography>
            </Box>
          </Box>

          <Box
            aria-label="Monthly account payment summary"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, p: 1.15, borderRight: '1px solid', borderColor: 'divider' }}>
              <PaymentsRoundedIcon color="success" fontSize="small" />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={800}>Payments applied</Typography>
                <Typography variant="body2" fontWeight={900} noWrap>{formatCurrency(monthlyPaid)}</Typography>
              </Box>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, p: 1.15 }}>
              <WarningAmberRoundedIcon color="warning" fontSize="small" />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={800}>Still due</Typography>
                <Typography variant="body2" fontWeight={900} noWrap>{formatCurrency(monthlyBalance)}</Typography>
              </Box>
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
            <TextField
              label="Amount received"
              placeholder="e.g. 1500"
              type="number"
              value={monthlyAmount}
              onChange={(event) => { setMonthlyAmount(event.target.value); setMonthlyError(''); }}
              error={Boolean(monthlyError)}
              helperText={monthlyError || 'Enter the cash received against the total unpaid balance.'}
              InputProps={{
                inputProps: { min: 1, max: monthlyBalance, step: 1 },
                startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
              }}
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<PaymentsRoundedIcon />}
              disabled={loading || monthlyBalance <= 0}
              sx={{ ...salesActionSx, minHeight: 48, minWidth: { sm: 190 }, whiteSpace: 'nowrap' }}
            >
              {loading ? 'Recording...' : 'Record payment'}
            </Button>
          </Stack>

          <Button
            type="button"
            variant="text"
            onClick={() => setShowDeliveryEntry(true)}
            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, minHeight: 44 }}
          >
            Add a new delivery instead
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {isMonthlyPayment && (
        <Button type="button" variant="text" onClick={() => setShowDeliveryEntry(false)} sx={{ minHeight: 44, mb: 1 }}>
          Back to monthly payment
        </Button>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            select
            label="Bottle type"
            value={form.bottleType}
            onChange={(event) => selectBottleType(event.target.value)}
            error={Boolean(errors.bottleType)}
            helperText={errors.bottleType}
            required
            fullWidth
          >
            {BOTTLE_TYPES.map((type) => (
              <MenuItem key={type} value={type}>{BOTTLE_TYPE_LABELS[type] || type}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField
            label="Quantity"
            placeholder="e.g. 2"
            type="number"
            value={form.quantity}
            onChange={(event) => setField('quantity', event.target.value)}
            error={Boolean(errors.quantity)}
            helperText={errors.quantity}
            inputProps={{ min: 1 }}
            required
            fullWidth
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField
            label="Unit price"
            placeholder="Price per bottle"
            type="number"
            value={form.pricePerBottle}
            onChange={(event) => setField('pricePerBottle', event.target.value)}
            error={Boolean(errors.pricePerBottle)}
            helperText={errors.pricePerBottle || (Number(assignedPrices[form.bottleType] || 0) > 0
              ? 'Saved customer price'
              : 'Saved for next time')}
            InputProps={{
              inputProps: { min: 1, step: 1 },
              startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
            }}
            required
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sx={{ minWidth: 0 }}>
          {isMonthlyPayment ? (
            <Stack spacing={1.25} sx={{ width: '100%', minWidth: 0 }}>
              <Stack
                role="status"
                aria-label="Monthly payment account"
                direction={{ xs: 'column', sm: 'row' }}
                alignItems="center"
                spacing={1.25}
                sx={{
                  width: '100%',
                  minWidth: 0,
                  minHeight: 56,
                  px: 1.5,
                  py: 1,
                  color: 'text.primary',
                  bgcolor: payDaily ? 'rgba(25, 135, 84, .07)' : 'rgba(47, 125, 255, .06)',
                  border: '1px solid',
                  borderColor: payDaily ? 'rgba(25, 135, 84, .22)' : 'rgba(47, 125, 255, .2)',
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'grid', width: 36, height: 36, flex: '0 0 36px', color: payDaily ? 'success.main' : 'primary.main', placeItems: 'center', bgcolor: payDaily ? 'rgba(25, 135, 84, .1)' : 'rgba(47, 125, 255, .11)', borderRadius: 1.25 }}>
                  <CalendarMonthRoundedIcon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0, width: '100%', overflowWrap: 'anywhere' }}>
                  <Typography variant="body2" fontWeight={900} sx={{ overflowWrap: 'anywhere' }}>{payDaily ? 'Pay on this delivery' : 'Add to monthly account'}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{payDaily ? 'This delivery is paid now' : `This delivery adds ${formatCurrency(total)} to the account`}</Typography>
                </Box>
              </Stack>
              {payDaily ? (
                <TextField
                  label="Amount paid for this delivery"
                  placeholder="Cash received now"
                  type="number"
                  value={form.amountPaid}
                  onChange={(event) => setField('amountPaid', event.target.value)}
                  error={Boolean(errors.amountPaid)}
                  helperText={errors.amountPaid || 'Full delivery total suggested'}
                  InputProps={{ inputProps: { min: 0, max: total, step: 1 }, startAdornment: <InputAdornment position="start">PKR</InputAdornment> }}
                  fullWidth
                />
              ) : (
                <Box
                  role="note"
                  sx={{
                    px: 1.5,
                    py: 1.25,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography variant="body2" fontWeight={850}>No daily payment on this entry</Typography>
                  <Typography variant="caption" color="text.secondary">
                    The full delivery is added to the monthly account. Record received cash from the monthly payment panel.
                  </Typography>
                </Box>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1} sx={{ px: 0.5, minWidth: 0 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" fontWeight={800} color="text.primary">Pay this delivery daily</Typography>
                  <Typography variant="caption" display="block" color="text.secondary">Keep the customer monthly for future entries</Typography>
                </Box>
                <Switch
                  checked={payDaily}
                  onChange={(event) => {
                    setPayDaily(event.target.checked);
                    setAmountPaidTouched(false);
                  }}
                  inputProps={{ 'aria-label': 'Pay this delivery daily' }}
                />
              </Stack>
            </Stack>
          ) : (
            <TextField
              label="Amount paid"
              type="number"
              value={form.amountPaid}
              onChange={(event) => setField('amountPaid', event.target.value)}
              onFocus={() => {
                if (!amountPaidTouched) setField('amountPaid', '');
              }}
              placeholder="Enter amount"
              error={Boolean(errors.amountPaid)}
              helperText={errors.amountPaid || 'Full total suggested'}
              InputProps={{
                inputProps: { min: 0, max: total, step: 1 },
                startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
              }}
              fullWidth
            />
          )}
        </Grid>

        <Grid item xs={12}>
          <Box
            aria-live="polite"
            sx={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1.18fr 1fr 1fr' },
              overflow: 'hidden',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'color-mix(in srgb, var(--hs-primary) 18%, transparent)',
              borderRadius: 3,
              boxShadow: '0 12px 30px rgba(22, 76, 105, .07)',
              '&::before': {
                position: 'absolute',
                inset: '0 0 auto',
                height: 3,
                content: '""',
                background: 'linear-gradient(90deg, var(--hs-primary), var(--hs-secondary))',
              },
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                minHeight: 76,
                p: { xs: 1.25, sm: 1.5 },
                color: 'text.primary',
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--hs-primary) 8%, transparent), transparent)',
              }}
            >
              <Box sx={{ display: 'grid', width: 38, height: 38, flex: '0 0 38px', color: 'var(--hs-primary)', placeItems: 'center', bgcolor: 'color-mix(in srgb, var(--hs-primary) 11%, transparent)', borderRadius: 1.5 }}>
                <AccountBalanceWalletRoundedIcon fontSize="small" />
              </Box>
              <Box sx={{ display: 'grid', minWidth: 0 }}>
                <Typography variant="caption" fontWeight={850} color="text.secondary">Delivery total</Typography>
                <Typography variant="subtitle1" fontWeight={900} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(total)}
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                minHeight: 76,
                p: { xs: 1.25, sm: 1.5 },
                color: 'text.primary',
                borderTop: { xs: '1px solid', sm: 0 },
                borderLeft: { xs: 0, sm: '1px solid' },
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'grid', width: 32, height: 32, flex: '0 0 32px', color: 'success.main', placeItems: 'center', bgcolor: 'rgba(25, 135, 84, .1)', borderRadius: '50%' }}>
                <PaymentsRoundedIcon fontSize="small" />
              </Box>
              <Box sx={{ display: 'grid', minWidth: 0 }}>
                <Typography variant="caption" fontWeight={850} color="text.secondary">Paid now</Typography>
                <Typography variant="subtitle2" fontWeight={900} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(amountPaid)}
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                minHeight: 76,
                p: { xs: 1.25, sm: 1.5 },
                color: 'text.primary',
                borderTop: { xs: '1px solid', sm: 0 },
                borderLeft: { xs: 0, sm: '1px solid' },
                borderColor: 'divider',
                bgcolor: amountDue > 0 ? 'rgba(237, 142, 24, .045)' : 'rgba(25, 135, 84, .035)',
              }}
            >
              <Box sx={{ display: 'grid', width: 32, height: 32, flex: '0 0 32px', color: amountDue > 0 ? 'warning.main' : 'success.main', placeItems: 'center', bgcolor: amountDue > 0 ? 'rgba(237, 142, 24, .12)' : 'rgba(25, 135, 84, .1)', borderRadius: '50%' }}>
                <WarningAmberRoundedIcon fontSize="small" />
              </Box>
              <Box sx={{ display: 'grid', minWidth: 0 }}>
                <Typography variant="caption" fontWeight={850} color="text.secondary">Remaining</Typography>
                <Typography variant="subtitle2" fontWeight={900} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(amountDue)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <TextField
            label="Delivery notes"
            value={form.notes}
            onChange={(event) => setField('notes', event.target.value)}
            placeholder="Optional route, payment, or collection note"
            multiline
            minRows={2}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddShoppingCartRoundedIcon />}
            disabled={loading}
            sx={salesActionSx}
          >
            {loading ? 'Recording sale...' : 'Record sale'}
          </Button>
        </Grid>
      </Grid>
    </form>
  );
}
