import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
} from '@mui/material';
import AddShoppingCartRoundedIcon from '@mui/icons-material/AddShoppingCartRounded';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { validateSaleForm } from '../../utils/validation';
import { formatCurrency } from '../../utils/formatters';

const initial = { bottleType: '', quantity: 1, pricePerBottle: '', notes: '' };

export default function SalesForm({ onSubmit, loading, priceDefaults }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const total = useMemo(
    () => (Number(form.quantity) || 0) * (Number(form.pricePerBottle) || 0),
    [form]
  );

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleBottleTypeChange = (event) => {
    const bottleType = event.target.value;
    const defaultPrice = priceDefaults && priceDefaults[bottleType];
    setForm((current) => ({
      ...current,
      bottleType,
      pricePerBottle: defaultPrice !== undefined && defaultPrice !== ''
        ? defaultPrice
        : current.pricePerBottle,
    }));
    setErrors((current) => ({ ...current, bottleType: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateSaleForm(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    await onSubmit(form);
    setForm(initial);
  };

  const hasSavedPrice = form.bottleType &&
    priceDefaults &&
    priceDefaults[form.bottleType] !== '';

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            select
            label="Bottle type"
            value={form.bottleType}
            onChange={handleBottleTypeChange}
            error={Boolean(errors.bottleType)}
            helperText={errors.bottleType || (hasSavedPrice
              ? `Saved unit price: ${formatCurrency(priceDefaults[form.bottleType])}`
              : 'Select the delivered bottle or gallon type.')}
            required
            fullWidth
          >
            <MenuItem value="">Select type</MenuItem>
            {BOTTLE_TYPES.map((type) => (
              <MenuItem key={type} value={type}>{BOTTLE_TYPE_LABELS[type] || type}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Quantity"
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
        <Grid item xs={12} sm={4}>
          <TextField
            label="Unit price"
            type="number"
            value={form.pricePerBottle}
            onChange={(event) => setField('pricePerBottle', event.target.value)}
            error={Boolean(errors.pricePerBottle)}
            helperText={errors.pricePerBottle}
            InputProps={{
              inputProps: { min: 0, step: 1 },
              startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
            }}
            required
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Total amount"
            value={formatCurrency(total)}
            helperText="Saved with this sale"
            InputProps={{ readOnly: true, inputProps: { 'aria-live': 'polite' } }}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Delivery notes"
            value={form.notes}
            onChange={(event) => setField('notes', event.target.value)}
            placeholder="Optional route, payment, or collection note"
            multiline
            minRows={3}
            fullWidth
          />
        </Grid>
        {total > 0 && (
          <Grid item xs={12}>
            <Alert severity="info">This entry will add {formatCurrency(total)} to the customer sales history.</Alert>
          </Grid>
        )}
        <Grid item xs={12}>
          <Button
            type="submit"
            variant="contained"
            color="success"
            startIcon={<AddShoppingCartRoundedIcon />}
            disabled={loading}
          >
            {loading ? 'Recording sale...' : 'Record sale'}
          </Button>
        </Grid>
      </Grid>
    </form>
  );
}
