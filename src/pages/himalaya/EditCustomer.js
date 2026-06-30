import React, { useEffect, useState } from 'react';
import {
  Button, Col, FormFeedback, FormGroup, Input, Label, Modal, ModalBody, ModalFooter,
  ModalHeader, Row,
} from 'reactstrap';
import { toast } from 'react-toastify';
import { AlertTriangle, ArrowLeft, Camera, Save, Trash2, UserRound } from 'lucide-react';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import { useCustomers } from '../../context/CustomerContext';
import { normalizePhone, validateCustomerForm } from '../../utils/validation';
import { getInitials } from '../../utils/formatters';
import LoadingState from '../../components/LoadingState/LoadingState';
import './EditCustomer.css';

const emptyForm = { name: '', phone: '+92', address: '', email: '', photo: '' };

export default function EditCustomer({ match, history }) {
  const { customerId } = match.params;
  const { customers, loading, updateCustomer, deleteCustomer } = useCustomers();
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

  const handlePhoto = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Customer image must be smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setField('photo', reader.result);
    reader.readAsDataURL(file);
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
      history.push('/app/add-customer');
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
    if (deleteConfirmation.trim() !== customer.name) return;
    setDeleting(true);
    try {
      await deleteCustomer(customerId);
      toast.success(`${customer.name} was deleted.`);
      history.replace('/app/add-customer');
    } catch (error) {
      toast.error(error.message || 'Could not delete customer.');
      setDeleting(false);
    }
  };

  if (loading) return <PageShell title="Edit Customer"><LoadingState label="Loading customer profile..." variant="form" /></PageShell>;

  if (!customer) {
    return (
      <PageShell title="Customer not found" subtitle="This customer may have been removed">
        <Button color="primary" onClick={() => history.replace('/app/add-customer')}>Back to customer management</Button>
      </PageShell>
    );
  }

  return (
    <PageShell title="Edit Customer" subtitle={`Update ${customer.name}'s contact and delivery details`}>
      <div className="edit-customer-actions">
        <Button color="link" type="button" onClick={() => history.push('/app/add-customer')}>
          <ArrowLeft size={17} aria-hidden="true" /> Back to customer management
        </Button>
      </div>

      <Widget className="edit-customer-card">
        <div className="edit-customer-hero">
          <div className="edit-customer-hero__glow" aria-hidden="true" />
          <div className="edit-customer-hero__avatar">
            {form.photo ? <img src={form.photo} alt="" /> : <UserRound size={32} aria-hidden="true" />}
          </div>
          <div className="edit-customer-hero__copy">
            <span>Customer workspace</span>
            <h2>{customer.name}</h2>
            <p>{customer.phone} · {(customer.purchaseHistory || []).length} recorded orders</p>
          </div>
          <div className="edit-customer-hero__status"><i /> Active account</div>
        </div>

        <div className="edit-customer-heading">
          <div className="edit-customer-heading__icon"><UserRound size={25} aria-hidden="true" /></div>
          <div><h2>Edit delivery profile</h2><p>Update contact and route information without affecting purchase history.</p></div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="edit-customer-photo">
            <div className="edit-customer-avatar">
              {form.photo ? <img src={form.photo} alt="Customer preview" /> : <span>{getInitials(form.name)}</span>}
            </div>
            <div>
              <Label className="edit-customer-photo-button" htmlFor="edit-customer-photo">
                <Camera size={17} aria-hidden="true" /> Change photo
              </Label>
              <Input id="edit-customer-photo" type="file" accept="image/*" onChange={handlePhoto} />
              <small>JPG, PNG or WebP up to 2 MB.</small>
            </div>
          </div>

          <Row>
            <Col md={6}>
              <FormGroup>
                <Label for="edit-customer-name">Full name *</Label>
                <Input id="edit-customer-name" value={form.name} onChange={(event) => setField('name', event.target.value)} invalid={!!errors.name} />
                <FormFeedback>{errors.name}</FormFeedback>
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label for="edit-customer-phone">Phone number *</Label>
                <Input id="edit-customer-phone" type="tel" value={form.phone} onChange={(event) => setField('phone', normalizePhone(event.target.value))} invalid={!!errors.phone} />
                <FormFeedback>{errors.phone}</FormFeedback>
              </FormGroup>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label for="edit-customer-email">Email address</Label>
                <Input id="edit-customer-email" type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} invalid={!!errors.email} />
                <FormFeedback>{errors.email}</FormFeedback>
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label for="edit-customer-address">Delivery address *</Label>
                <Input id="edit-customer-address" value={form.address} onChange={(event) => setField('address', event.target.value)} invalid={!!errors.address} />
                <FormFeedback>{errors.address}</FormFeedback>
              </FormGroup>
            </Col>
          </Row>

          <div className="edit-customer-footer">
            <Button className="edit-customer-delete" type="button" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={17} aria-hidden="true" /> Delete customer
            </Button>
            <div className="edit-customer-footer__spacer" />
            <Button color="secondary" type="button" onClick={() => history.push('/app/add-customer')}>Cancel</Button>
            <Button color="primary" type="submit" disabled={saving}>
              <Save size={17} aria-hidden="true" /> {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Widget>

      <Modal isOpen={deleteOpen} toggle={closeDeleteDialog} centered className="delete-customer-modal">
        <ModalHeader toggle={closeDeleteDialog}>Delete customer</ModalHeader>
        <ModalBody>
          <div className="delete-customer-warning">
            <AlertTriangle size={24} aria-hidden="true" />
            <div>
              <strong>This action cannot be undone.</strong>
              <p>Deleting this customer also permanently removes their sales history and saved invoices.</p>
            </div>
          </div>
          <FormGroup className="mb-0">
            <Label for="delete-customer-confirmation">
              Type <strong>{customer.name}</strong> to confirm
            </Label>
            <Input
              id="delete-customer-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete="off"
              disabled={deleting}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={closeDeleteDialog} disabled={deleting}>Cancel</Button>
          <Button
            color="danger"
            onClick={handleDelete}
            disabled={deleting || deleteConfirmation.trim() !== customer.name}
          >
            <Trash2 size={17} aria-hidden="true" /> {deleting ? 'Deleting…' : 'Permanently delete'}
          </Button>
        </ModalFooter>
      </Modal>
    </PageShell>
  );
}
