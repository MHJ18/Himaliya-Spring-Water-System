import React, { useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Button, FormGroup, Label, Input, Table, Badge, Alert,
} from 'reactstrap';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import { useCustomers } from '../../context/CustomerContext';
import {
  createAdmin, deleteAdminWithOwnerPassword, getAdmins, getCurrentAdminProfile,
} from '../../utils/adminAuth';
import {
  deleteAdminCustomerProfile,
  getAdminCustomerProfiles,
} from '../../services/api/customerPortalApi';

const initialForm = {
  name: '',
  email: '',
  password: '',
  role: 'Admin',
};

function phoneKey(phone) {
  return (phone || '').replace(/\D/g, '');
}

function buildAllCustomerUsers(profiles, manualCustomers) {
  const seen = new Set();
  const rows = [];

  (profiles || []).forEach((profile) => {
    seen.add(profile.id);
    if (profile.linkedCustomerId) seen.add(profile.linkedCustomerId);
    const phone = phoneKey(profile.phone);
    const email = (profile.email || '').toLowerCase();
    if (phone) seen.add(phone);
    if (email) seen.add(email);
    rows.push({
      ...profile,
      userType: 'app',
      canRemove: true,
    });
  });

  (manualCustomers || []).forEach((customer) => {
    const phone = phoneKey(customer.phone);
    const email = (customer.email || '').toLowerCase();
    if (seen.has(customer.id) || (phone && seen.has(phone)) || (email && seen.has(email))) {
      return;
    }
    rows.push({
      id: customer.id,
      name: customer.name,
      email: customer.email || '—',
      phone: customer.phone,
      companyName: 'Manual customer',
      contractLabel: 'Added in Customer Records',
      active: true,
      createdAt: customer.createdAt,
      userType: 'admin',
      canRemove: false,
    });
  });

  return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export default function AdminUsers() {
  const { customers: manualCustomers } = useCustomers();
  const [admins, setAdmins] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [customerDeleteTarget, setCustomerDeleteTarget] = useState(null);
  const [customerDeletePhrase, setCustomerDeletePhrase] = useState('');

  const loadAdmins = () => {
    getAdmins().then(setAdmins).catch(() => setAdmins([]));
    getCurrentAdminProfile().then(setCurrentAdmin).catch(() => setCurrentAdmin(null));
  };

  const loadProfiles = () => {
    getAdminCustomerProfiles().then(setProfiles).catch(() => setProfiles([]));
  };

  useEffect(() => {
    loadAdmins();
    loadProfiles();
    window.addEventListener('focus', loadProfiles);
    return () => window.removeEventListener('focus', loadProfiles);
  }, []);

  const customers = useMemo(
    () => buildAllCustomerUsers(profiles, manualCustomers),
    [profiles, manualCustomers],
  );

  const updateForm = (field, value) => {
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      const admin = await createAdmin(form);
      setAdmins((current) => [...current, admin]);
      setForm(initialForm);
      toast.success('Admin created');
    } catch (err) {
      setError(err.message || 'Could not create admin.');
    }
  };

  const openDeleteModal = (admin) => {
    setDeleteTarget(admin);
    setOwnerPassword('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setOwnerPassword('');
    setDeleteError('');
  };

  const handleDeleteAdmin = async () => {
    if (!deleteTarget) return;
    if (!ownerPassword) {
      setDeleteError('Enter the owner password to delete this admin.');
      return;
    }

    try {
      const nextAdmins = await deleteAdminWithOwnerPassword(deleteTarget.id, ownerPassword);
      setAdmins(nextAdmins);
      toast.success('Admin deleted');
      closeDeleteModal();
    } catch (err) {
      setDeleteError(err.message || 'Could not delete admin.');
    }
  };

  const closeCustomerDelete = () => {
    setCustomerDeleteTarget(null);
    setCustomerDeletePhrase('');
  };

  const handleDeleteCustomerProfile = async () => {
    if (!customerDeleteTarget) return;
    if (customerDeletePhrase !== 'DELETE') {
      toast.error('Type DELETE to confirm removing this customer app profile.');
      return;
    }
    try {
      await deleteAdminCustomerProfile(customerDeleteTarget.id);
      setProfiles((current) => current.filter((customer) => customer.id !== customerDeleteTarget.id));
      toast.success('Customer app profile removed.');
      closeCustomerDelete();
    } catch (err) {
      toast.error(err.message || 'Could not remove customer profile.');
    }
  };

  return (
    <PageShell title="All Users" subtitle="Manage admin accounts and signed-up customer app users">
      <Row>
        <Col xl={5} lg={6}>
          <Widget title={<h5>New Admin</h5>} className="admin-access-card">
            <div className="admin-access-intro">
              <span className="admin-access-icon"><i className="fa fa-shield" /></span>
              <div>
                <h4>Dashboard access only</h4>
                <p>Only admins created here can sign in to the Himaliya Spring dashboard.</p>
              </div>
            </div>
            {error && <Alert color="danger" className="alert-sm">{error}</Alert>}
            <form onSubmit={handleSubmit}>
              <FormGroup>
                <Label for="admin-name">Full Name</Label>
                <Input id="admin-name" value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="e.g. Hassan Admin" />
              </FormGroup>
              <FormGroup>
                <Label for="admin-email">Email</Label>
                <Input id="admin-email" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} placeholder="admin@example.com" />
              </FormGroup>
              <FormGroup>
                <Label for="admin-password">Password</Label>
                <Input id="admin-password" type="password" value={form.password} onChange={(e) => updateForm('password', e.target.value)} placeholder="Minimum 6 characters" />
              </FormGroup>
              <FormGroup>
                <Label for="admin-role">Role</Label>
                <Input id="admin-role" type="select" value={form.role} onChange={(e) => updateForm('role', e.target.value)}>
                  <option>Admin</option>
                  <option>Manager</option>
                  <option>Owner</option>
                </Input>
              </FormGroup>
              <Button color="primary" type="submit" className="admin-access-submit">Create Admin</Button>
            </form>
          </Widget>
        </Col>
        <Col xl={7} lg={6}>
          <Widget title={<h5>Admin Users</h5>} className="admin-list-card">
            <div className="table-responsive admin-users-scroll" tabIndex="0" role="region" aria-label="Scrollable administrator table">
              <Table className="admin-users-table mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id}>
                      <td><div className="admin-user-cell"><span>{admin.name.charAt(0).toUpperCase()}</span><strong>{admin.name}</strong></div></td>
                      <td>{admin.email}</td>
                      <td>{admin.role}</td>
                      <td><Badge color="success">Allowed</Badge></td>
                      <td className="text-right">
                        <Button color="danger" size="sm" outline className="admin-delete-btn" disabled={currentAdmin && currentAdmin.id === admin.id} onClick={() => openDeleteModal(admin)}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {deleteTarget && (
              <div className={`admin-delete-panel ${deleteError ? 'is-invalid' : ''}`}>
                <div className="admin-delete-panel-head">
                  <span className="admin-delete-icon"><i className="fa fa-lock" /></span>
                  <div>
                    <h4>Confirm admin removal</h4>
                    <p>Enter the owner password to delete <strong>{deleteTarget.name}</strong>.</p>
                  </div>
                </div>
                <Row form className="align-items-end">
                  <Col md={7}>
                    <FormGroup className="mb-md-0">
                      <Label for="owner-password">Owner Password</Label>
                      <Input id="owner-password" type="password" value={ownerPassword} className={deleteError ? 'is-invalid' : ''} onChange={(e) => { setOwnerPassword(e.target.value); setDeleteError(''); }} placeholder="Enter owner password" />
                    </FormGroup>
                  </Col>
                  <Col md={5}>
                    <div className="admin-delete-actions">
                      <Button color="secondary" outline onClick={closeDeleteModal}>Cancel</Button>
                      <Button color="danger" onClick={handleDeleteAdmin}>Delete Admin</Button>
                    </div>
                  </Col>
                </Row>
              </div>
            )}
          </Widget>
        </Col>
      </Row>

      <Widget title={<h5>All Customer Users</h5>} className="admin-list-card mt-4">
        <div className="table-responsive admin-users-scroll" tabIndex="0" role="region" aria-label="Scrollable customer user table">
          <Table className="admin-users-table mb-0">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={`${customer.userType}-${customer.id}`}>
                  <td><div className="admin-user-cell"><span>{(customer.name || '?').charAt(0).toUpperCase()}</span><strong>{customer.name}</strong></div></td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.userType === 'app' ? 'Customer app signup' : 'Added by admin'}</td>
                  <td><Badge color={customer.active ? 'success' : 'secondary'}>{customer.active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="text-right">
                    {customer.canRemove ? (
                      <Button color="danger" size="sm" outline className="admin-delete-btn" onClick={() => setCustomerDeleteTarget(customer)}>Remove</Button>
                    ) : (
                      <span className="text-muted small">Manage in Customers</span>
                    )}
                  </td>
                </tr>
              ))}
              {!customers.length && (
                <tr><td colSpan="6" className="text-muted text-center py-4">No customer users yet. Add customers or wait for app signups.</td></tr>
              )}
            </tbody>
          </Table>
        </div>
        {customerDeleteTarget && (
          <div className="admin-delete-panel">
            <div className="admin-delete-panel-head">
              <span className="admin-delete-icon"><i className="fa fa-user-times" /></span>
              <div>
                <h4>Remove customer app profile</h4>
                <p>
                  Type <strong>DELETE</strong> to remove <strong>{customerDeleteTarget.name}</strong> from the app tables.
                  Supabase Auth login removal needs a secure server/admin action.
                </p>
              </div>
            </div>
            <Row form className="align-items-end">
              <Col md={7}>
                <FormGroup className="mb-md-0">
                  <Label for="delete-customer-confirm">Security Check</Label>
                  <Input id="delete-customer-confirm" value={customerDeletePhrase} onChange={(e) => setCustomerDeletePhrase(e.target.value)} placeholder="Type DELETE" />
                </FormGroup>
              </Col>
              <Col md={5}>
                <div className="admin-delete-actions">
                  <Button color="secondary" outline onClick={closeCustomerDelete}>Cancel</Button>
                  <Button color="danger" onClick={handleDeleteCustomerProfile}>Remove Profile</Button>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Widget>
    </PageShell>
  );
}
