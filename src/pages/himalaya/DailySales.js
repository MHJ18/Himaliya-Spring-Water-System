import React, { useMemo, useState } from 'react';
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
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import CustomerSummary from '../../components/common/CustomerSummary';
import SalesForm from '../../components/forms/SalesForm';
import { useCustomers } from '../../context/CustomerContext';
import { useSales } from '../../context/SalesContext';
import { normalizePhone } from '../../utils/validation';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import LoadingState from '../../components/LoadingState/LoadingState';

export default function DailySales() {
  const {
    customers, findByPhone, searchCustomers, loading,
  } = useCustomers();
  const { recordSale } = useSales();
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searched, setSearched] = useState(false);
  const [saleLoading, setSaleLoading] = useState(false);

  const customer = useMemo(() => (
    selectedId ? customers.find((item) => item.id === selectedId) || null : null
  ), [customers, selectedId]);

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
      toast.success('Sale recorded successfully.');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to record sale.');
      return false;
    } finally {
      setSaleLoading(false);
    }
  };

  if (loading) {
    return <PageShell title="Daily sales"><LoadingState label="Loading sales counter..." variant="form" /></PageShell>;
  }

  return (
    <PageShell title="Daily sales" subtitle="Find a customer and record a delivery in one focused flow">
      <Card sx={{
        mb: 3,
        overflow: 'hidden',
        color: '#f6fcff',
        background: 'linear-gradient(125deg, #075b84 0%, #0a81ad 58%, #35b7d7 100%)',
      }}
      >
        <CardContent sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
          <WaterDropOutlinedIcon sx={{
            position: 'absolute', right: { xs: 14, md: 34 }, bottom: -34,
            fontSize: { xs: 120, md: 170 }, color: 'rgba(255,255,255,.1)',
          }}
          />
          <Typography variant="overline" sx={{ color: '#bff3ff', fontWeight: 800 }}>Sales counter</Typography>
          <Typography variant="h3" sx={{ maxWidth: 700, mt: 0.5, color: '#fff' }}>
            Record the delivery while the customer is in front of you.
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 660, mt: 1, color: '#d9f6ff' }}>
            Search by customer name or phone, set the agreed bottle price for this entry, and add it to their cloud history.
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardHeader title="Find customer" subheader="Name, email, or phone number" />
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
                  startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment>,
                }}
                fullWidth
              />
              <Button type="submit" variant="contained" sx={{ minWidth: { sm: 150 } }}>Search</Button>
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
        <Card sx={{ mb: 3 }}>
          <CardHeader title="Select customer" subheader={`${matches.length} matching customer${matches.length === 1 ? '' : 's'}`} />
          <CardContent sx={{ pt: 0 }}>
            <Grid container spacing={1.5}>
              {matches.map((match, index) => (
                <Grid item xs={12} sm={6} xl={4} key={match.id}>
                  <Button
                    color="inherit"
                    onClick={() => setSelectedId(match.id)}
                    sx={{
                      width: '100%',
                      minHeight: 82,
                      justifyContent: 'flex-start',
                      gap: 1.25,
                      p: 1.25,
                      textAlign: 'left',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <Avatar src={match.photo || getCustomerAvatar(index)} alt="" />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={800} noWrap>{match.name}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>{match.phone || match.email}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>{match.address}</Typography>
                    </Box>
                    <Chip size="small" label={`${(match.purchaseHistory || []).length} orders`} />
                  </Button>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {customer && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <CustomerSummary customer={customer} />
          </Grid>
          <Grid item xs={12}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title="Record sale"
                subheader={`Set this entry's bottle price and add the purchase to ${customer.name}'s history`}
              />
              <CardContent sx={{ pt: 0 }}>
                <SalesForm onSubmit={handleSale} loading={saleLoading} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </PageShell>
  );
}
