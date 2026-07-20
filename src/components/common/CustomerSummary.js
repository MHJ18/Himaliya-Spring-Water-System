import React, { useMemo } from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { filterTransactionsByPeriod, computePurchaseStats } from '../../utils/analytics';
import { formatCurrency, getInitials } from '../../utils/formatters';

export default function CustomerSummary({ customer }) {
  const stats = useMemo(() => {
    const history = customer && customer.purchaseHistory ? customer.purchaseHistory : [];
    return {
      daily: computePurchaseStats(filterTransactionsByPeriod(history, 'daily')),
      monthly: computePurchaseStats(filterTransactionsByPeriod(history, 'monthly')),
      all: computePurchaseStats(history),
    };
  }, [customer]);

  if (!customer) return null;

  const metrics = [
    { label: 'Total bottles', value: stats.all.totalBottles },
    { label: 'This month', value: stats.monthly.totalBottles },
    { label: 'Today', value: stats.daily.totalBottles },
    { label: 'Revenue', value: formatCurrency(stats.all.totalRevenue) },
  ];

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Avatar
            src={customer.photo || undefined}
            alt=""
            sx={{ width: 68, height: 68, bgcolor: 'primary.main', fontWeight: 800 }}
          >
            {getInitials(customer.name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1}>
              <Typography variant="h4" sx={{ overflowWrap: 'anywhere' }}>{customer.name}</Typography>
              <Chip size="small" color={customer.active === false ? 'default' : 'success'} label={customer.active === false ? 'Inactive' : 'Active'} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} sx={{ mt: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.6} color="text.secondary">
                <PhoneOutlinedIcon fontSize="small" />
                <Typography variant="body2">{customer.phone || 'No phone'}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.6} color="text.secondary">
                <PlaceOutlinedIcon fontSize="small" />
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{customer.address || 'No address'}</Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
        <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
          {metrics.map((metric) => (
            <Grid item xs={6} md={3} key={metric.label}>
              <Box sx={{
                minHeight: 76,
                p: 1.25,
                bgcolor: 'rgba(29,155,240,.07)',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
              }}
              >
                <Typography variant="caption" color="text.secondary">{metric.label}</Typography>
                <Typography variant="h6" sx={{ mt: 0.4, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                  {metric.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}
