import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AdminPanelSettingsRounded,
  AlternateEmailRounded,
  ContentCopyRounded,
  DeleteOutlineRounded,
  KeyRounded,
  LockOutlined,
  PasswordRounded,
  PersonAddAltRounded,
  PersonOutlineRounded,
  PhoneRounded,
  RefreshRounded,
  ShieldOutlined,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import { mobileOptionalCellSx, responsiveTableContainerSx } from '../../components/tables/tableStyles';
import { useCustomers } from '../../context/CustomerContext';
import {
  createAdmin,
  deleteAdminWithOwnerPassword,
  getAdmins,
  getCurrentAdminProfile,
} from '../../utils/adminAuth';
import {
  deleteAdminCustomerProfile,
  getAdminCustomerProfiles,
} from '../../services/api/customerPortalApi';
import { adminResetCustomerPassword } from '../../services/cloud/supabaseClient';

const initialForm = {
  name: '',
  email: '',
  password: '',
  role: 'Admin',
};

const cardSx = {
  height: '100%',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  boxShadow: '0 18px 55px rgba(4, 18, 43, .1)',
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
    rows.push({ ...profile, userType: 'app', canRemove: true });
  });

  (manualCustomers || []).forEach((customer) => {
    const phone = phoneKey(customer.phone);
    const email = (customer.email || '').toLowerCase();
    if (seen.has(customer.id) || (phone && seen.has(phone)) || (email && seen.has(email))) return;
    rows.push({
      id: customer.id,
      name: customer.name,
      email: customer.email || 'Not provided',
      phone: customer.phone,
      active: true,
      createdAt: customer.createdAt,
      userType: 'admin',
      canRemove: false,
    });
  });

  return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function EmptyRow({ columns, children }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} align="center" sx={{ py: 6, color: 'text.secondary' }}>
        {children}
      </TableCell>
    </TableRow>
  );
}

export default function AdminUsers() {
  const { customers: manualCustomers } = useCustomers();
  const [admins, setAdmins] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [ownerPassword, setOwnerPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [customerDeleteTarget, setCustomerDeleteTarget] = useState(null);
  const [customerDeletePhrase, setCustomerDeletePhrase] = useState('');
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [resetOwnerPassword, setResetOwnerPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const [adminResult, profileResult, currentResult] = await Promise.allSettled([
      getAdmins(),
      getAdminCustomerProfiles(),
      getCurrentAdminProfile(),
    ]);
    setAdmins(adminResult.status === 'fulfilled' ? adminResult.value : []);
    setProfiles(profileResult.status === 'fulfilled' ? profileResult.value : []);
    setCurrentAdmin(currentResult.status === 'fulfilled' ? currentResult.value : null);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
    window.addEventListener('focus', loadUsers);
    return () => window.removeEventListener('focus', loadUsers);
  }, []);

  const customers = useMemo(
    () => buildAllCustomerUsers(profiles, manualCustomers),
    [profiles, manualCustomers],
  );

  const updateForm = (field, value) => {
    setFormError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormError('Name, email, and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Use a password with at least 8 characters.');
      return;
    }
    if (!currentAdmin || currentAdmin.role !== 'Owner') {
      setFormError('Only an active owner can create administrator accounts.');
      return;
    }
    const email = form.email.trim().toLowerCase();
    if (customers.some((customer) => String(customer.email || '').trim().toLowerCase() === email)) {
      setFormError('This email belongs to a customer account. Customer identities cannot be promoted to administrators.');
      return;
    }
    if (admins.some((admin) => String(admin.email || '').trim().toLowerCase() === email)) {
      setFormError('An administrator already uses this email address.');
      return;
    }
    setCreatingAdmin(true);
    try {
      const admin = await createAdmin(form);
      setAdmins((current) => [...current, admin]);
      setForm(initialForm);
      toast.success('Admin account created.');
    } catch (error) {
      setFormError(error.message || 'Could not create the admin.');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const closeAdminDelete = () => {
    setDeleteTarget(null);
    setOwnerPassword('');
    setDeleteError('');
  };

  const handleDeleteAdmin = async () => {
    if (!ownerPassword) {
      setDeleteError('Enter the owner password to continue.');
      return;
    }
    try {
      const nextAdmins = await deleteAdminWithOwnerPassword(deleteTarget.id, ownerPassword);
      setAdmins(nextAdmins);
      toast.success('Admin account removed.');
      closeAdminDelete();
    } catch (error) {
      setDeleteError(error.message || 'Could not remove the admin.');
    }
  };

  const closeCustomerDelete = () => {
    setCustomerDeleteTarget(null);
    setCustomerDeletePhrase('');
  };

  const handleDeleteCustomerProfile = async () => {
    if (customerDeletePhrase !== 'DELETE') {
      toast.error('Type DELETE exactly to confirm.');
      return;
    }
    try {
      await deleteAdminCustomerProfile(customerDeleteTarget.id);
      setProfiles((current) => current.filter((customer) => customer.id !== customerDeleteTarget.id));
      toast.success('Customer app profile removed.');
      closeCustomerDelete();
    } catch (error) {
      toast.error(error.message || 'Could not remove the customer profile.');
    }
  };

  const generateTemporaryPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    const values = window.crypto.getRandomValues(new Uint32Array(12));
    setTemporaryPassword(Array.from(values, (value) => alphabet[value % alphabet.length]).join(''));
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      toast.success('Temporary password copied.');
    } catch (error) {
      toast.info('Select the password and copy it manually.');
    }
  };

  const closePasswordDialog = () => {
    setPasswordTarget(null);
    setTemporaryPassword('');
    setResetOwnerPassword('');
  };

  const resetCustomerPassword = async () => {
    if (!temporaryPassword || temporaryPassword.length < 8) {
      toast.error('Use a temporary password with at least 8 characters.');
      return;
    }
    if (!resetOwnerPassword) {
      toast.error('Enter the owner password to authorize this change.');
      return;
    }
    setResettingPassword(true);
    try {
      await adminResetCustomerPassword(passwordTarget.id, temporaryPassword, resetOwnerPassword);
      toast.success(`Temporary password set for ${passwordTarget.name}.`);
      closePasswordDialog();
    } catch (error) {
      toast.error(error.message || 'Could not reset the customer password.');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <PageShell
      title="Users & access"
      subtitle="Manage dashboard administrators and customer app accounts from one workspace."
      actions={(
        <Tooltip title="Refresh users">
          <IconButton aria-label="Refresh users" onClick={loadUsers} disabled={loading}>
            <RefreshRounded />
          </IconButton>
        </Tooltip>
      )}
    >
      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} lg={5}>
          <Card sx={cardSx}>
            <Box sx={{ p: { xs: 2.25, sm: 3 }, color: 'common.white', background: 'linear-gradient(135deg, #155eef, #5538d8)' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,.15)' }}><ShieldOutlined /></Avatar>
                <Box>
                  <Typography variant="h6">Create admin access</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.74)' }}>
                    Dashboard access only. Use the customer app for delivery accounts.
                  </Typography>
                </Box>
              </Stack>
            </Box>
            <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Stack spacing={2}>
                  {currentAdmin && currentAdmin.role !== 'Owner' && (
                    <Alert severity="info">Only an Owner can create or promote administrator accounts.</Alert>
                  )}
                  {formError && <Alert severity="error">{formError}</Alert>}
                  <TextField
                    label="Full name"
                    value={form.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                    autoComplete="name"
                    required
                    InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlineRounded /></InputAdornment> }}
                  />
                  <TextField
                    label="Email address"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    autoComplete="email"
                    required
                    InputProps={{ startAdornment: <InputAdornment position="start"><AlternateEmailRounded /></InputAdornment> }}
                  />
                  <TextField
                    label="Temporary password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateForm('password', event.target.value)}
                    autoComplete="new-password"
                    required
                    helperText="Minimum 8 characters. Ask the admin to change it after signing in."
                    InputProps={{ startAdornment: <InputAdornment position="start"><PasswordRounded /></InputAdornment> }}
                  />
                  <TextField
                    select
                    label="Access role"
                    value={form.role}
                    onChange={(event) => updateForm('role', event.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><AdminPanelSettingsRounded /></InputAdornment> }}
                  >
                    <MenuItem value="Admin">Admin</MenuItem>
                    <MenuItem value="Manager">Manager</MenuItem>
                    <MenuItem value="Owner">Owner</MenuItem>
                  </TextField>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={creatingAdmin ? <CircularProgress size={18} color="inherit" /> : <PersonAddAltRounded />}
                    disabled={creatingAdmin || !currentAdmin || currentAdmin.role !== 'Owner'}
                    sx={{ minHeight: 48 }}
                  >
                    {creatingAdmin ? 'Creating secure account…' : 'Create admin'}
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Card sx={cardSx}>
            <Box sx={{ p: { xs: 2.25, sm: 3 }, pb: 1.5 }}>
              <Typography variant="h6">Dashboard administrators</Typography>
              <Typography variant="body2" color="text.secondary">{admins.length} accounts with operational access</Typography>
            </Box>
            <TableContainer
              role="region"
              tabIndex={0}
              aria-label="Scrollable administrator accounts"
              sx={{ ...responsiveTableContainerSx, maxHeight: 520 }}
            >
              <Table stickyHeader aria-label="Dashboard administrators" sx={{ minWidth: { xs: 500, sm: 620 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Administrator</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell sx={mobileOptionalCellSx}>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main', fontSize: '.9rem' }}>
                            {(admin.name || '?').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={800} noWrap>{admin.name}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{admin.email}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{admin.role}</TableCell>
                      <TableCell sx={mobileOptionalCellSx}><Chip size="small" color="success" label="Allowed" /></TableCell>
                      <TableCell align="right">
                        <Tooltip title={currentAdmin && currentAdmin.id === admin.id ? 'You cannot remove your current account' : 'Remove admin'}>
                          <span>
                            <IconButton
                              aria-label={`Remove ${admin.name}`}
                              color="error"
                              disabled={Boolean(currentAdmin && currentAdmin.id === admin.id)}
                              onClick={() => setDeleteTarget(admin)}
                            >
                              <DeleteOutlineRounded />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!admins.length && <EmptyRow columns={4}>{loading ? 'Loading administrators…' : 'No administrators found.'}</EmptyRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ ...cardSx, mt: 3, height: 'auto' }}>
        <Box sx={{ p: { xs: 2.25, sm: 3 }, pb: 1.5 }}>
          <Typography variant="h6">All customer accounts</Typography>
          <Typography variant="body2" color="text.secondary">
            Signed-up app users and admin-created customers are shown together.
          </Typography>
        </Box>
        <TableContainer
          role="region"
          tabIndex={0}
          aria-label="Scrollable customer accounts"
          sx={{ ...responsiveTableContainerSx, maxHeight: 'min(62vh, 620px)' }}
        >
          <Table stickyHeader aria-label="All customer accounts" sx={{ minWidth: { xs: 560, sm: 780 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell sx={mobileOptionalCellSx}>Phone</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={`${customer.userType}-${customer.id}`} hover>
                  <TableCell sx={mobileOptionalCellSx}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ width: 38, height: 38, bgcolor: 'info.main', fontSize: '.9rem' }}>
                        {(customer.name || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={800} noWrap>{customer.name}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{customer.email}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <PhoneRounded sx={{ fontSize: 17, color: 'text.secondary' }} />
                      <Typography variant="body2" noWrap>{customer.phone || 'Not provided'}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={customer.userType === 'app' ? 'info' : 'default'}
                      label={customer.userType === 'app' ? 'Customer app signup' : 'Added by admin'}
                    />
                  </TableCell>
                  <TableCell><Chip size="small" color={customer.active ? 'success' : 'default'} label={customer.active ? 'Active' : 'Inactive'} /></TableCell>
                  <TableCell align="right">
                    {customer.canRemove ? (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {currentAdmin && currentAdmin.role === 'Owner' && (
                          <Tooltip title="Set temporary password">
                            <IconButton
                              aria-label={`Reset password for ${customer.name}`}
                              color="primary"
                              onClick={() => {
                                setPasswordTarget(customer);
                                setTemporaryPassword('');
                                setResetOwnerPassword('');
                              }}
                            >
                              <KeyRounded />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Remove customer app profile">
                          <IconButton aria-label={`Remove ${customer.name}`} color="error" onClick={() => setCustomerDeleteTarget(customer)}>
                            <DeleteOutlineRounded />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Manage in Customers</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!customers.length && <EmptyRow columns={5}>{loading ? 'Loading customer accounts…' : 'No customer accounts yet.'}</EmptyRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={Boolean(deleteTarget)} onClose={closeAdminDelete} fullWidth maxWidth="xs">
        <DialogTitle>Remove administrator?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              This immediately removes dashboard access for <strong>{deleteTarget && deleteTarget.name}</strong>.
            </Alert>
            <TextField
              label="Owner password"
              type="password"
              value={ownerPassword}
              onChange={(event) => { setOwnerPassword(event.target.value); setDeleteError(''); }}
              autoComplete="current-password"
              error={Boolean(deleteError)}
              helperText={deleteError}
              InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment> }}
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAdminDelete}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteAdmin}>Remove admin</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(passwordTarget)} onClose={resettingPassword ? undefined : closePasswordDialog} fullWidth maxWidth="sm">
        <DialogTitle>Set temporary password</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            <Alert severity="info">
              Reset access for <strong>{passwordTarget && passwordTarget.name}</strong>. Share the new password through a trusted channel.
            </Alert>
            <TextField
              label="Temporary password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              autoComplete="off"
              helperText="Minimum 8 characters."
              InputProps={{
                startAdornment: <InputAdornment position="start"><PasswordRounded /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copy password">
                      <IconButton aria-label="Copy temporary password" edge="end" onClick={copyTemporaryPassword} disabled={!temporaryPassword}>
                        <ContentCopyRounded />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
            <Button variant="outlined" onClick={generateTemporaryPassword}>Generate strong password</Button>
            <TextField
              label="Owner password"
              type="password"
              value={resetOwnerPassword}
              onChange={(event) => setResetOwnerPassword(event.target.value)}
              autoComplete="current-password"
              InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment> }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap' }}>
          <Button onClick={closePasswordDialog} disabled={resettingPassword}>Cancel</Button>
          <Button variant="contained" onClick={resetCustomerPassword} disabled={resettingPassword} startIcon={resettingPassword ? <CircularProgress size={17} color="inherit" /> : <KeyRounded />}>
            {resettingPassword ? 'Updating…' : 'Set password'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(customerDeleteTarget)} onClose={closeCustomerDelete} fullWidth maxWidth="sm">
        <DialogTitle>Remove customer app profile?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="error">
              This removes <strong>{customerDeleteTarget && customerDeleteTarget.name}</strong> and their operational app records. Reset their password instead if they only lost access.
            </Alert>
            <TextField
              label="Type DELETE to confirm"
              value={customerDeletePhrase}
              onChange={(event) => setCustomerDeletePhrase(event.target.value)}
              autoComplete="off"
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCustomerDelete}>Cancel</Button>
          <Button color="error" variant="contained" disabled={customerDeletePhrase !== 'DELETE'} onClick={handleDeleteCustomerProfile}>
            Remove profile
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
