import React, { useState, useMemo, useEffect } from 'react';
import {
  Grid, TextField, Button, Card, CardContent, CardHeader,
  List, ListItem, ListItemAvatar, ListItemText, Avatar,
  Typography, IconButton, InputAdornment, Divider, Chip,
  Fade, Box, CircularProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import SearchIcon from '@material-ui/icons/Search';
import PhoneIcon from '@material-ui/icons/Phone';
import EmailIcon from '@material-ui/icons/Email';
import LocationOnIcon from '@material-ui/icons/LocationOn';
import PersonIcon from '@material-ui/icons/Person';
import CloseIcon from '@material-ui/icons/Close';
import PhotoCameraIcon from '@material-ui/icons/PhotoCamera';
import EventIcon from '@material-ui/icons/Event';
import EditIcon from '@material-ui/icons/Edit';
import { toast } from 'react-toastify';
import { useCustomers } from '../../context/CustomerContext';
import { DEFAULT_COUNTRY_CODE } from '../../data/constants';
import { validateCustomerForm, normalizePhone } from '../../utils/validation';
import { getCustomerAvatar } from '../../utils/customerPhotos';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
    minHeight: '100%',
    color: 'var(--hs-page-text, #fff)',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2, 1.5),
    },
  },
  pageTitle: {
    color: 'var(--hs-page-text, #fff)',
    marginBottom: theme.spacing(3),
    fontWeight: 700,
    fontSize: '1.75rem',
    letterSpacing: '-0.5px',
  },
  pageSubtitle: {
    color: 'var(--hs-page-muted, rgba(255,255,255,0.5))',
    fontSize: '0.9rem',
    marginBottom: theme.spacing(3),
  },
  formCard: {
    background: 'var(--hs-card-bg, linear-gradient(145deg, rgba(30,37,65,0.95) 0%, rgba(22,27,48,0.98) 100%))',
    borderRadius: 16,
    border: '1px solid var(--hs-card-border, rgba(255,255,255,0.06))',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    overflow: 'visible',
  },
  cardHeader: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px 16px 0 0',
    padding: theme.spacing(2, 3),
    '& .MuiCardHeader-title': {
      color: '#fff',
      fontWeight: 600,
      fontSize: '1.1rem',
    },
    '& .MuiCardHeader-subheader': {
      color: 'rgba(255,255,255,0.7)',
      fontSize: '0.8rem',
    },
  },
  cardContent: {
    padding: theme.spacing(3),
  },
  textField: {
    marginBottom: theme.spacing(2.5),
    '& .MuiOutlinedInput-root': {
      borderRadius: 10,
      backgroundColor: 'var(--hs-input-bg, rgba(255,255,255,0.04))',
      color: 'var(--hs-page-text, #e0e0e0)',
      transition: 'all 0.3s ease',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.07)',
      },
      '&.Mui-focused': {
        backgroundColor: 'rgba(255,255,255,0.08)',
      },
      '& fieldset': {
        borderColor: 'var(--hs-input-border, rgba(255,255,255,0.12))',
        transition: 'border-color 0.3s ease',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(102,126,234,0.5)',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#667eea',
        borderWidth: 2,
      },
    },
    '& .MuiInputLabel-root': {
      color: 'var(--hs-page-muted, rgba(255,255,255,0.5))',
      '&.Mui-focused': {
        color: '#667eea',
      },
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': {
      color: 'var(--hs-icon-muted, rgba(255,255,255,0.3))',
    },
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    borderRadius: 10,
    padding: theme.spacing(1.4, 4),
    fontWeight: 600,
    textTransform: 'none',
    fontSize: '0.95rem',
    boxShadow: '0 4px 15px rgba(102,126,234,0.35)',
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: '0 6px 20px rgba(102,126,234,0.5)',
      transform: 'translateY(-1px)',
    },
    '&:disabled': {
      opacity: 0.6,
    },
  },
  avatarUpload: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: theme.spacing(3),
  },
  avatarLarge: {
    width: 88,
    height: 88,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontSize: '2rem',
    boxShadow: '0 4px 20px rgba(102,126,234,0.4)',
    cursor: 'pointer',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    '&:hover': {
      transform: 'scale(1.05)',
      boxShadow: '0 6px 25px rgba(102,126,234,0.5)',
    },
  },
  listCard: {
    background: 'var(--hs-card-bg, linear-gradient(145deg, rgba(30,37,65,0.95) 0%, rgba(22,27,48,0.98) 100%))',
    borderRadius: 16,
    border: '1px solid var(--hs-card-border, rgba(255,255,255,0.06))',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  listHeader: {
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    borderRadius: '16px 16px 0 0',
    padding: theme.spacing(2, 3),
  },
  listHeaderTitle: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '1.1rem',
  },
  listHeaderCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.8rem',
  },
  searchField: {
    margin: theme.spacing(2),
    '& .MuiOutlinedInput-root': {
      borderRadius: 10,
      backgroundColor: 'var(--hs-input-bg, rgba(255,255,255,0.04))',
      color: 'var(--hs-page-text, #e0e0e0)',
      '& fieldset': {
        borderColor: 'var(--hs-input-border, rgba(255,255,255,0.12))',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(17,153,142,0.5)',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#11998e',
      },
    },
    '& .MuiInputLabel-root': {
      color: 'var(--hs-page-muted, rgba(255,255,255,0.5))',
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': {
      color: 'var(--hs-icon-muted, rgba(255,255,255,0.3))',
    },
  },
  customerList: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: 300,
    padding: 0,
    [theme.breakpoints.down('sm')]: {
      maxHeight: 'none',
    },
    '&::-webkit-scrollbar': {
      width: 6,
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 3,
    },
  },
  customerItem: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'rgba(102,126,234,0.08)',
    },
  },
  customerItemSelected: {
    backgroundColor: 'rgba(102,126,234,0.15) !important',
    borderLeft: '3px solid #667eea',
  },
  customerAvatar: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    width: 42,
    height: 42,
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  customerName: {
    color: 'var(--hs-page-text, #e0e0e0)',
    fontWeight: 500,
    fontSize: '0.9rem',
  },
  customerPhone: {
    color: 'var(--hs-page-muted, rgba(255,255,255,0.4))',
    fontSize: '0.78rem',
  },
  detailCard: {
    background: 'var(--hs-card-bg, linear-gradient(145deg, rgba(30,37,65,0.95) 0%, rgba(22,27,48,0.98) 100%))',
    borderRadius: 16,
    border: '1px solid var(--hs-card-border, rgba(255,255,255,0.06))',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    marginTop: theme.spacing(2),
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: theme.spacing(2, 3),
  },
  detailAvatar: {
    width: 56,
    height: 56,
    border: '3px solid rgba(255,255,255,0.3)',
    marginRight: theme.spacing(2),
  },
  detailName: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '1.1rem',
  },
  detailBody: {
    padding: theme.spacing(3),
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    '&:last-child': {
      marginBottom: 0,
    },
  },
  detailIcon: {
    color: '#667eea',
    marginRight: theme.spacing(1.5),
    fontSize: '1.2rem',
  },
  detailLabel: {
    color: 'var(--hs-page-muted, rgba(255,255,255,0.4))',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    color: 'var(--hs-page-text, #e0e0e0)',
    fontSize: '0.9rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: 'var(--hs-page-muted, rgba(255,255,255,0.3))',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing(2),
    opacity: 0.3,
  },
}));

const initial = { name: '', phone: DEFAULT_COUNTRY_CODE, address: '', email: '', photo: '' };

export default function AddCustomer({ history }) {
  const classes = useStyles();
  const { customers, addCustomer, loading: ctxLoading, refresh } = useCustomers();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [preview, setPreview] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        c.phone.includes(q.replace(/\D/g, ''))
    );
  }, [customers, search]);

  const selected = customers.find((c) => c.id === selectedId);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setForm((p) => ({ ...p, photo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateCustomerForm(form);
    if (Object.keys(err).length) {
      setErrors(err);
      return;
    }
    setSaving(true);
    try {
      await addCustomer(form);
      toast.success('Customer added successfully!');
      setFormKey((k) => k + 1);
      setForm(initial);
      setPreview('');
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${classes.root} himalaya-add-customer`}>
      <Typography className={classes.pageTitle}>
        Add Customer
      </Typography>
      <Typography className={classes.pageSubtitle}>
        Register new delivery customers and manage existing ones
      </Typography>

      <Grid container spacing={3}>
        {/* ── LEFT COLUMN: Form ── */}
        <Grid item xs={12} md={5}>
          <Card className={classes.formCard} elevation={0}>
            <CardHeader
              className={classes.cardHeader}
              avatar={<PersonAddIcon style={{ color: '#fff' }} />}
              title="New Customer"
              subheader="Fill in the details below"
            />
            <CardContent className={classes.cardContent}>
              <form onSubmit={handleSubmit} key={formKey}>
                {/* Avatar Upload */}
                <div className={classes.avatarUpload}>
                  <input
                    type="file"
                    accept="image/*"
                    id="customer-photo"
                    style={{ display: 'none' }}
                    onChange={handleImage}
                  />
                  <label htmlFor="customer-photo">
                    <Avatar
                      src={preview || undefined}
                      className={classes.avatarLarge}
                    >
                      {preview ? null : <PhotoCameraIcon style={{ fontSize: 32 }} />}
                    </Avatar>
                  </label>
                  <Typography
                    variant="caption"
                    style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8 }}
                  >
                    Click to upload photo
                  </Typography>
                </div>

                <TextField
                  className={classes.textField}
                  label="Full Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  required
                  error={!!errors.name}
                  helperText={errors.name}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  className={classes.textField}
                  label="Phone (+92)"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => {
                    const nextPhone = e.target.value;
                    setForm((p) => ({
                      ...p,
                      phone: normalizePhone(nextPhone),
                    }));
                  }}
                  variant="outlined"
                  fullWidth
                  required
                  error={!!errors.phone}
                  helperText={errors.phone}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  className={classes.textField}
                  label="Address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  required
                  multiline
                  rows={3}
                  error={!!errors.address}
                  helperText={errors.address}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationOnIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  className={classes.textField}
                  label="Email (optional)"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  error={!!errors.email}
                  helperText={errors.email}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  type="submit"
                  className={classes.submitBtn}
                  fullWidth
                  disabled={saving}
                  startIcon={
                    saving ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <PersonAddIcon />
                    )
                  }
                >
                  {saving ? 'Saving...' : 'Add Customer'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* ── RIGHT COLUMN: Customer List + Details ── */}
        <Grid item xs={12} md={7}>
          <div className={classes.listCard}>
            <div className={classes.listHeader}>
              <Typography className={classes.listHeaderTitle}>
                Existing Customers
              </Typography>
              <Typography className={classes.listHeaderCount}>
                {customers.length} registered
              </Typography>
            </div>

            <TextField
              className={classes.searchField}
              placeholder="Search by name or phone..."
              variant="outlined"
              size="small"
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}>
                      <CloseIcon style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />

            {ctxLoading ? (
              <Box className={classes.emptyState}>
                <CircularProgress size={32} style={{ color: '#667eea' }} />
                <Typography style={{ marginTop: 16, color: 'rgba(255,255,255,0.4)' }}>
                  Loading customers...
                </Typography>
              </Box>
            ) : filtered.length === 0 ? (
              <Box className={classes.emptyState}>
                <PersonIcon className={classes.emptyIcon} />
                <Typography>
                  {search ? 'No customers match your search' : 'No customers yet'}
                </Typography>
              </Box>
            ) : (
              <List className={classes.customerList}>
                {filtered.map((c, idx) => (
                  <ListItem
                    key={c.id}
                    className={`${classes.customerItem} ${
                      selectedId === c.id ? classes.customerItemSelected : ''
                    }`}
                    onClick={() => setSelectedId(c.id)}
                    button
                  >
                    <ListItemAvatar>
                      <Avatar
                        src={c.photo || getCustomerAvatar(idx)}
                        className={classes.customerAvatar}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <span className={classes.customerName}>{c.name}</span>
                      }
                      secondary={
                        <span className={classes.customerPhone}>{c.phone}</span>
                      }
                    />
                    {(c.source === 'portal' || c.source === 'both') && (
                      <Chip
                        label={c.source === 'both' ? 'Admin + app' : 'App signup'}
                        size="small"
                        style={{
                          backgroundColor: 'rgba(56,239,125,0.15)',
                          color: '#38ef7d',
                          fontWeight: 600,
                          fontSize: '0.68rem',
                          marginRight: 6,
                        }}
                      />
                    )}
                    {c.purchaseHistory && c.purchaseHistory.length > 0 && (
                      <Chip
                        label={`${c.purchaseHistory.length} orders`}
                        size="small"
                        style={{
                          backgroundColor: 'rgba(102,126,234,0.15)',
                          color: '#667eea',
                          fontWeight: 500,
                          fontSize: '0.7rem',
                        }}
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </div>

          {/* ── Customer Detail Card ── */}
          {selected && (
            <Fade in={!!selected}>
              <Card className={classes.detailCard} elevation={0}>
                <div className={classes.detailHeader}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar
                      src={selected.photo || getCustomerAvatar(0)}
                      className={classes.detailAvatar}
                    >
                      {selected.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <Typography className={classes.detailName}>
                        {selected.name}
                      </Typography>
                      <Typography
                        style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}
                      >
                        Customer Details
                      </Typography>
                    </div>
                  </div>
                  <IconButton
                    size="small"
                    onClick={() => setSelectedId(null)}
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    <CloseIcon />
                  </IconButton>
                </div>

                <div className={classes.detailBody}>
                  <div className={classes.detailRow}>
                    <PhoneIcon className={classes.detailIcon} />
                    <div>
                      <Typography className={classes.detailLabel}>Phone</Typography>
                      <Typography className={classes.detailValue}>
                        {selected.phone}
                      </Typography>
                    </div>
                  </div>

                  <Divider
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      margin: '12px 0',
                    }}
                  />

                  <div className={classes.detailRow}>
                    <LocationOnIcon className={classes.detailIcon} />
                    <div>
                      <Typography className={classes.detailLabel}>Address</Typography>
                      <Typography className={classes.detailValue}>
                        {selected.address}
                      </Typography>
                    </div>
                  </div>

                  {selected.email && (
                    <>
                      <Divider
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          margin: '12px 0',
                        }}
                      />
                      <div className={classes.detailRow}>
                        <EmailIcon className={classes.detailIcon} />
                        <div>
                          <Typography className={classes.detailLabel}>
                            Email
                          </Typography>
                          <Typography className={classes.detailValue}>
                            {selected.email}
                          </Typography>
                        </div>
                      </div>
                    </>
                  )}

                  <Divider
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      margin: '12px 0',
                    }}
                  />

                  <div className={classes.detailRow}>
                    <EventIcon className={classes.detailIcon} />
                    <div>
                      <Typography className={classes.detailLabel}>
                        Date Added
                      </Typography>
                      <Typography className={classes.detailValue}>
                        {selected.createdAt
                          ? new Date(selected.createdAt).toLocaleDateString('en-PK', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </Typography>
                    </div>
                  </div>

                  {selected.purchaseHistory &&
                    selected.purchaseHistory.length > 0 && (
                      <>
                        <Divider
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            margin: '12px 0',
                          }}
                        />
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <Typography className={classes.detailLabel}>
                              Total Orders
                            </Typography>
                            <Typography
                              className={classes.detailValue}
                              style={{ fontWeight: 600, fontSize: '1.2rem' }}
                            >
                              {selected.purchaseHistory.length}
                            </Typography>
                          </div>
                          <Chip
                            label="Active"
                            size="small"
                            style={{
                              backgroundColor: 'rgba(56,239,125,0.15)',
                              color: '#38ef7d',
                              fontWeight: 600,
                            }}
                          />
                        </div>
                      </>
                    )}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => history.push(`/app/customers/${selected.id}/edit`)}
                    style={{
                      marginTop: 16,
                      padding: '6px 12px',
                      color: '#72dcff',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      textTransform: 'none',
                      border: '1px solid rgba(114,220,255,0.45)',
                      borderRadius: 999,
                      background: 'rgba(36,119,255,0.1)',
                      boxShadow: '0 8px 20px rgba(3,20,45,0.12)',
                    }}
                  >
                    Edit profile
                  </Button>
                </div>
              </Card>
            </Fade>
          )}
        </Grid>
      </Grid>
    </div>
  );
}
