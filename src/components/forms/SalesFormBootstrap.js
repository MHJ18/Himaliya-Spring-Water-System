import React, { useState, useMemo } from 'react';
import { Button, FormGroup, Label, Input, FormFeedback, Row, Col } from 'reactstrap';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { validateSaleForm } from '../../utils/validation';
import { formatCurrency } from '../../utils/formatters';

const initial = { bottleType: '', quantity: 1, pricePerBottle: '', notes: '' };

export default function SalesFormBootstrap({ onSubmit, loading, priceDefaults }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const total = useMemo(() => (Number(form.quantity) || 0) * (Number(form.pricePerBottle) || 0), [form]);

  const handleBottleTypeChange = (e) => {
    const bottleType = e.target.value;
    const defaultPrice = priceDefaults && priceDefaults[bottleType];
    setForm((current) => ({
      ...current,
      bottleType,
      pricePerBottle: defaultPrice !== undefined && defaultPrice !== '' ? defaultPrice : current.pricePerBottle,
    }));
    setErrors((current) => ({ ...current, bottleType: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validateSaleForm(form);
    if (Object.keys(err).length) { setErrors(err); return; }
    onSubmit(form);
    setForm(initial);
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormGroup>
        <Label>Bottle Type *</Label>
        <Input type="select" name="bottleType" value={form.bottleType} onChange={handleBottleTypeChange} invalid={!!errors.bottleType}>
          <option value="">Select type</option>
          {BOTTLE_TYPES.map((bt) => <option key={bt} value={bt}>{BOTTLE_TYPE_LABELS[bt] || bt}</option>)}
        </Input>
        <FormFeedback>{errors.bottleType}</FormFeedback>
        {form.bottleType && priceDefaults && priceDefaults[form.bottleType] !== '' && (
          <small className="sales-form-saved-price">
            Saved unit price: {formatCurrency(priceDefaults[form.bottleType])}
          </small>
        )}
      </FormGroup>
      <Row className="sales-form-entry-row">
        <Col md={4}>
          <FormGroup>
            <Label>Quantity *</Label>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} invalid={!!errors.quantity} />
            <FormFeedback>{errors.quantity}</FormFeedback>
          </FormGroup>
        </Col>
        <Col md={4}>
          <FormGroup>
            <Label>Unit Price (PKR) *</Label>
            <Input type="number" min="0" value={form.pricePerBottle} onChange={(e) => setForm({ ...form, pricePerBottle: e.target.value })} invalid={!!errors.pricePerBottle} />
            <FormFeedback>{errors.pricePerBottle}</FormFeedback>
          </FormGroup>
        </Col>
        <Col md={4}>
          <FormGroup className="sales-form-total-card">
            <Label>Total Amount</Label>
            <Input value={formatCurrency(total)} readOnly aria-live="polite" />
            <small>Saved with sale</small>
          </FormGroup>
        </Col>
      </Row>
      <FormGroup>
        <Label>Notes</Label>
        <Input type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </FormGroup>
      <Button color="success" type="submit" disabled={loading}>
        {loading ? 'Recording...' : 'Record Sale'}
      </Button>
    </form>
  );
}
