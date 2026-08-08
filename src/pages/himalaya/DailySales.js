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
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import { alpha } from '@mui/material/styles';
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

  // Rank results so the closest match is first and can be marked. Exact
  // name/phone beats "starts with", which beats a loose contains.
  const scoreMatch = (candidate, value) => {
    const q = value.trim().toLowerCase();
    const digits = value.replace(/\D/g, '');
    const name = String(candidate.name || '').toLowerCase();
    const phoneDigits = String(candidate.phone || '').replace(/\D/g, '');
    const email = String(candidate.email || '').toLowerCase();
    if (name === q) return 100;
    if (digits.length >= 4 && phoneDigits === digits) return 95;
    if (email === q) return 90;
    if (name.startsWith(q)) return 70;
    if (digits.length >= 3 && phoneDigits.startsWith(digits)) return 65;
    if (email.startsWith(q)) return 60;
    if (name.includes(q)) return 40;
    return 10;
  };

  const resolveMatches = (query) => {
    const value = query.trim();
    if (!value) return [];
    const hasEnoughPhoneDigits = value.replace(/\D/g, '').length >= 3;
    const exactPhoneMatch = hasEnoughPhoneDigits ? findByPhone(normalizePhone(value)) : null;
    if (exactPhoneMatch) return [exactPhoneMatch];
    return [...searchCustomers(value)]
      .map((item) => ({ item, score: scoreMatch(item, value) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
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
                startIcon={<SearchRoundedIcon />}
                sx={(theme) => ({
                  minHeight: 44,
                  minWidth: { sm: 140 },
                  width: { xs: '100%', sm: 'auto' },
                  fontWeight: 800,
                  letterSpacing: '.01em',
                  borderRadius: 2,
                  boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                  transition: 'box-shadow 180ms ease, transform 180ms ease, filter 180ms ease',
                  '&:hover': {
                    boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.4)}`,
                    filter: 'brightness(1.05)',
                    transform: 'translateY(-1px)',
                  },
                  '&:active': { transform: 'translateY(0) scale(.985)' },
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
                })}
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
                <Grid item component="li" xs={12} sm={6} xl={4} key={match.id} sx={{ maxWidth: { sm: 340 } }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setSelectedId(match.id)}
                    aria-label={`Select ${match.name}${index === 0 ? ' (best match)' : ''}`}
                    sx={(theme) => ({
                      position: 'relative',
                      width: '100%',
                      maxWidth: 340,
                      height: '100%',
                      p: { xs: 1.35, sm: 1.5 },
                      color: 'text.primary',
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: index === 0 ? 2 : 1,
                      borderColor: index === 0 ? 'primary.main' : 'divider',
                      borderRadius: 2.5,
                      bgcolor: index === 0 ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
                      boxShadow: index === 0 ? `0 10px 26px ${alpha(theme.palette.primary.main, 0.2)}` : 'none',
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
                    })}
                  >
                    {index === 0 && matches.length > 1 && (
                      <Chip
                        size="small"
                        color="primary"
                        label="Best match"
                        sx={{
                          position: 'absolute',
                          top: -9,
                          right: 10,
                          height: 18,
                          fontSize: '.68rem',
                          fontWeight: 800,
                        }}
                      />
                    )}
                    {/* Name and one contact line is all that is needed to pick
                        the right person; the full record opens once selected. */}
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar src={match.photo || getCustomerAvatar(index)} alt="" />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={800} noWrap>{match.name}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                          {match.phone || match.email || 'No contact details'}
                        </Typography>
                      </Box>
                    </Stack>
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
            <Card
              sx={{
                overflow: 'hidden',
                borderRadius: 3,
                boxShadow: '0 12px 34px rgba(16, 47, 66, .08)',
              }}
            >
              <Box
                sx={{
                  p: { xs: 2, sm: 2.25 },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--hs-primary) 10%, transparent), transparent 70%)',
                }}
              >
                <Stack direction="row" spacing={1.4} alignItems="center">
                  <Avatar
                    src={customer.photo || undefined}
                    alt=""
                    sx={{
                      width: 48,
                      height: 48,
                      border: '2px solid',
                      borderColor: 'background.paper',
                      boxShadow: '0 6px 16px rgba(16, 47, 66, .18)',
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={850}
                      sx={{ display: 'block', letterSpacing: '.06em', textTransform: 'uppercase' }}
                    >
                      Selected customer
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={870} noWrap sx={{ lineHeight: 1.22 }}>
                      {customer.name}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.7} sx={{ mt: 1.4 }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={customer.paymentSchedule === 'on_delivery' ? 'success' : 'primary'}
                    label={customer.paymentSchedule === 'on_delivery' ? 'Pays on delivery' : 'Monthly account'}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={customer.active === false ? 'default' : 'success'}
                    label={customer.active === false ? 'Inactive' : 'Active'}
                  />
                </Stack>
              </Box>
              {/* Only what is needed to confirm the right account is selected:
                  who to call and where it goes. Anything else belongs on the
                  customer record, not in the middle of a sale entry. */}
              <CardContent sx={{ py: 1.75 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1.1} alignItems="center">
                    <PhoneRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      {customer.phone || 'No phone number'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1.1} alignItems="flex-start">
                    <LocationOnRoundedIcon fontSize="small" sx={{ mt: 0.2, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      {customer.address || 'No delivery address'}
                    </Typography>
                  </Stack>
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
                    startIcon={<SwapHorizRoundedIcon />}
                    aria-label={`Change customer, currently ${customer.name}`}
                    onClick={() => {
                      setSelectedId(null);
                      setSearchTerm('');
                      setMatches([]);
                      setSearched(false);
                    }}
                    sx={(theme) => ({
                      minHeight: 38,
                      mt: 0.5,
                      px: 1.6,
                      color: 'var(--hs-primary)',
                      borderRadius: 999,
                      fontWeight: 850,
                      whiteSpace: 'nowrap',
                      // Transparent border plus a two-layer background paints a
                      // gradient ring; sliding the ring layer on hover/focus
                      // gives the border a travelling highlight without
                      // animating any layout property.
                      border: '1px solid transparent',
                      backgroundImage: `linear-gradient(${theme.palette.background.paper}, ${theme.palette.background.paper}), linear-gradient(90deg, color-mix(in srgb, var(--hs-primary) 45%, transparent), var(--hs-secondary), color-mix(in srgb, var(--hs-primary) 45%, transparent))`,
                      backgroundOrigin: 'border-box',
                      backgroundClip: 'padding-box, border-box',
                      backgroundSize: '100% 100%, 220% 100%',
                      backgroundPosition: '0 0, 0 0',
                      transition: 'color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                      '@keyframes hsChangeSweep': {
                        to: { backgroundPosition: '0 0, 220% 0' },
                      },
                      '&:hover, &:focus-visible': {
                        color: 'var(--hs-secondary)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 8px 20px color-mix(in srgb, var(--hs-primary) 22%, transparent)',
                        animation: 'hsChangeSweep 1.4s linear infinite',
                      },
                      '@media (prefers-reduced-motion: reduce)': {
                        transition: 'none',
                        '&:hover, &:focus-visible': { transform: 'none', animation: 'none' },
                      },
                    })}
                  >
                    Change
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
