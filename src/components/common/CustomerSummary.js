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
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
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
    { label: 'Lifetime sales', value: formatCurrency(stats.all.totalRevenue), color: 'primary.main' },
    { label: 'Outstanding', value: formatCurrency(stats.all.totalDue), color: stats.all.totalDue > 0 ? 'warning.main' : 'success.main' },
    { label: 'Bottles held', value: Number(customer.bottlesHeld) || 0, color: 'text.primary' },
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
              <Chip
                size="small"
                color={customer.paymentSchedule === 'on_delivery' ? 'success' : 'secondary'}
                variant="outlined"
                icon={customer.paymentSchedule === 'on_delivery' ? <PaymentsOutlinedIcon /> : <CalendarMonthRoundedIcon />}
                label={customer.paymentSchedule === 'on_delivery' ? 'Pays on delivery' : 'Monthly account'}
              />
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
            <Grid item xs={4} key={metric.label}>
              <Box sx={{
                minHeight: 72,
                p: 1.25,
                bgcolor: 'action.hover',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
              }}
              >
                <Typography variant="caption" color="text.secondary">{metric.label}</Typography>
                <Typography color={metric.color} variant="h6" sx={{ mt: 0.4, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
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
