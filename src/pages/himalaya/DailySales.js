import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import SalesForm from '../../components/forms/SalesForm';
import { useCustomers } from '../../context/CustomerContext';
import { useSales } from '../../context/SalesContext';
import { normalizePhone } from '../../utils/validation';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import LoadingState from '../../components/LoadingState/LoadingState';
import { getCustomerBottlePrices } from '../../services/api/customerBottlePriceApi';

export default function DailySales() {
  const {
    customers, findByPhone, searchCustomers, loading, recordMonthlyPayment,
  } = useCustomers();
  const { recordSale } = useSales();
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searched, setSearched] = useState(false);
  const [saleLoading, setSaleLoading] = useState(false);
  const [assignedPrices, setAssignedPrices] = useState({});

  const customer = useMemo(() => (
    selectedId ? customers.find((item) => item.id === selectedId) || null : null
  ), [customers, selectedId]);
  const monthlyLedger = useMemo(() => {
    if (!customer) return { balance: 0, paid: 0 };
    return (customer.purchaseHistory || [])
      .filter((entry) => entry.paymentSchedule !== 'on_delivery')
      .reduce((summary, sale) => {
        const total = Number(sale.totalAmount) || 0;
        const paid = Math.min(total, Math.max(0, Number(sale.amountPaid) || 0));
        return {
          balance: summary.balance + Math.max(0, total - paid),
          paid: summary.paid + paid,
        };
      }, { balance: 0, paid: 0 });
  }, [customer]);

  useEffect(() => {
    let active = true;
    if (!selectedId) {
      setAssignedPrices({});
      return () => { active = false; };
    }
    getCustomerBottlePrices(selectedId)
      .then((prices) => { if (active) setAssignedPrices(prices); })
      .catch((error) => {
        if (active) toast.error(error.message || 'Could not load this customer\'s saved prices.');
      });
    return () => { active = false; };
  }, [selectedId]);

  const resolveMatches = (query) => {
    const value = query.trim();
    if (!value) return [];
    const hasEnoughPhoneDigits = value.replace(/\D/g, '').length >= 3;
    const exactPhoneMatch = hasEnoughPhoneDigits ? findByPhone(normalizePhone(value)) : null;
    return exactPhoneMatch ? [exactPhoneMatch] : searchCustomers(value);
  };

  const search = (query, selectSingle = false) => {
    const nextMatches = resolveMatches(query);
    setMatches(nextMatches);
    setSearched(Boolean(query.trim()));
    setSelectedId(selectSingle && nextMatches.length === 1 ? nextMatches[0].id : null);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    search(searchTerm, true);
  };

  const handleSale = async (form) => {
    if (!customer) return;
    setSaleLoading(true);
    try {
      await recordSale({ customerId: customer.id, ...form });
      setAssignedPrices((current) => ({
        ...current,
        [form.bottleType]: Number(form.pricePerBottle) || 0,
      }));
      toast.success('Sale recorded successfully.');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to record sale.');
      return false;
    } finally {
      setSaleLoading(false);
    }
  };

  const handleMonthlyPayment = async (amount) => {
    if (!customer) return false;
    setSaleLoading(true);
    try {
      const result = await recordMonthlyPayment(customer.id, amount);
      toast.success(`Payment recorded. ${result.balanceAfter > 0 ? `Remaining balance: PKR ${result.balanceAfter.toLocaleString()}.` : 'Customer is fully paid.'}`);
      return true;
    } catch (error) {
      toast.error(error.message || 'Could not record the monthly payment.');
      return false;
    } finally {
      setSaleLoading(false);
    }
  };

  if (loading) {
    return <PageShell title="Daily sales"><LoadingState label="Loading sales counter..." variant="form" /></PageShell>;
  }

  return (
    <PageShell
      title="Daily sales"
      subtitle="Find a customer and record a delivery in one focused flow"
      actions={customer ? (
        <Chip
          avatar={<Avatar src={customer.photo || undefined} alt="" />}
          label={`Sales for ${customer.name}`}
          color="primary"
          sx={{
            minHeight: 36,
            maxWidth: '100%',
            px: 0.5,
            fontWeight: 800,
            '& .MuiChip-label': {
              minWidth: 0,
              overflow: 'hidden',
              px: 1.25,
              textOverflow: 'ellipsis',
            },
          }}
          aria-label={`Selected customer: ${customer.name}`}
        />
      ) : null}
    >
      <Card sx={{ mb: 3, overflow: 'hidden' }}>
        <CardHeader
          title="Find customer"
          subheader="Search by name, email, or phone number"
          sx={{
            '& .MuiCardHeader-content': { minWidth: 0 },
            '& .MuiCardHeader-title, & .MuiCardHeader-subheader': { overflowWrap: 'anywhere' },
          }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Box component="form" onSubmit={handleSearch}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  const nextSearch = event.target.value;
                  setSearchTerm(nextSearch);
                  search(nextSearch);
                }}
                placeholder="Start typing a customer name or phone..."
                InputProps={{
                  inputProps: { 'aria-label': 'Search customers' },
                  startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment>,
                  endAdornment: searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="Clear customer search"
                        onClick={() => {
                          setSearchTerm('');
                          setMatches([]);
                          setSearched(false);
                        }}
                        sx={{ width: 44, height: 44 }}
                      >
                        <CloseRoundedIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { minHeight: 48 } }}
              />
              <Button
                type="submit"
                variant="contained"
                sx={{ minHeight: 48, minWidth: { sm: 150 }, width: { xs: '100%', sm: 'auto' } }}
              >
                Search
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {searched && !customer && matches.length === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No customer matched that name, email, or phone number.
        </Alert>
      )}

      {searched && !customer && matches.length > 0 && (
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          <CardHeader
            title="Select customer"
            subheader={`${matches.length} matching customer${matches.length === 1 ? '' : 's'}`}
          />
          <CardContent sx={{ pt: 0 }}>
            <Grid
              container
              component="ul"
              spacing={1.5}
              sx={{ p: 0, m: 0, listStyle: 'none' }}
              aria-label="Matching customers"
            >
              {matches.map((match, index) => (
                <Grid item component="li" xs={12} sm={6} xl={4} key={match.id}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setSelectedId(match.id)}
                    aria-label={`Select ${match.name}`}
                    sx={{
                      width: '100%',
                      height: '100%',
                      p: { xs: 1.5, sm: 1.75 },
                      color: 'text.primary',
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2.5,
                      bgcolor: 'background.paper',
                      transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: '0 12px 28px rgba(13, 97, 128, 0.12)',
                        transform: { sm: 'translateY(-2px)' },
                      },
                      '&:focus-visible': {
                        outline: '3px solid rgba(47, 125, 255, .28)',
                        outlineOffset: 2,
                        borderColor: 'primary.main',
                      },
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Avatar src={match.photo || getCustomerAvatar(index)} alt="" />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={800} noWrap>{match.name}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>{match.phone || match.email || 'No contact details'}</Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 0.25, overflowWrap: 'anywhere' }}
                        >
                          {match.address || 'No delivery address'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      size="small"
                      label={`${(match.purchaseHistory || []).length} deliveries`}
                      sx={{ mt: 1.5, pointerEvents: 'none' }}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {customer && (
        <Grid container spacing={{ xs: 2, md: 2.5 }} alignItems="flex-start">
          <Grid item xs={12} lg={4}>
            <Card sx={{ overflow: 'hidden' }}>
              <Box
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  color: 'common.white',
                  background: 'linear-gradient(135deg, var(--hs-primary) 0%, var(--hs-secondary) 100%)',
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    src={customer.photo || undefined}
                    alt=""
                    sx={{ width: 54, height: 54, border: '2px solid rgba(255,255,255,.5)' }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h6" noWrap sx={{ color: 'inherit' }}>{customer.name}</Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.78)' }}>Selected customer</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
                  <Chip
                    size="small"
                    label={customer.paymentSchedule === 'on_delivery' ? 'Pays on delivery' : 'Monthly account'}
                    sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)' }}
                  />
                  <Chip
                    size="small"
                    label={customer.active === false ? 'Inactive' : 'Active'}
                    sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)' }}
                  />
                </Stack>
              </Box>
              <CardContent>
                <Stack component="dl" spacing={1.5} divider={<Divider flexItem />} sx={{ m: 0 }}>
                  <Box component="div">
                    <Typography component="dt" variant="caption" color="text.secondary" fontWeight={800}>Phone</Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>{customer.phone || 'No phone number'}</Typography>
                  </Box>
                  <Box component="div">
                    <Typography component="dt" variant="caption" color="text.secondary" fontWeight={800}>Delivery address</Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>{customer.address || 'No delivery address'}</Typography>
                  </Box>
                  <Box component="div">
                    <Typography component="dt" variant="caption" color="text.secondary" fontWeight={800}>Previous deliveries</Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.25 }}>{(customer.purchaseHistory || []).length}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} lg={8} sx={{ minWidth: 0 }}>
            <Card
              sx={{
                minWidth: 0,
                overflow: 'hidden',
                '& .MuiButton-root': { minHeight: 44 },
                '& .MuiOutlinedInput-root': { minHeight: 44 },
              }}
            >
              <CardHeader
                title="Record sale"
                subheader={`Add this delivery to ${customer.name}'s history`}
                action={(
                  <Button
                    type="button"
                    variant="outlined"
                    startIcon={<SwapHorizRoundedIcon />}
                    onClick={() => {
                      setSelectedId(null);
                      setSearchTerm('');
                      setMatches([]);
                      setSearched(false);
                    }}
                    sx={{
                      minHeight: 40,
                      mt: 0.5,
                      px: 1.75,
                      color: 'var(--hs-primary)',
                      borderColor: 'color-mix(in srgb, var(--hs-primary) 38%, transparent)',
                      borderRadius: 999,
                      fontWeight: 850,
                      whiteSpace: 'nowrap',
                      background: 'color-mix(in srgb, var(--hs-primary) 7%, transparent)',
                      '&:hover': {
                        color: '#fff',
                        borderColor: 'transparent',
                        background: 'linear-gradient(135deg, var(--hs-primary), var(--hs-secondary))',
                      },
                    }}
                  >
                    Change customer
                  </Button>
                )}
                sx={{
                  '& .MuiCardHeader-content': { minWidth: 0 },
                  '& .MuiCardHeader-action': { alignSelf: 'center', m: 0, ml: 1 },
                  '& .MuiCardHeader-title, & .MuiCardHeader-subheader': { overflowWrap: 'anywhere' },
                }}
              />
              <CardContent sx={{ pt: 0, minWidth: 0 }}>
                <SalesForm
                  key={customer.id}
                  onSubmit={handleSale}
                  loading={saleLoading}
                  assignedPrices={assignedPrices}
                  paymentSchedule={customer.paymentSchedule}
                  monthlyBalance={monthlyLedger.balance}
                  monthlyPaid={monthlyLedger.paid}
                  onRecordMonthlyPayment={handleMonthlyPayment}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </PageShell>
  );
}
