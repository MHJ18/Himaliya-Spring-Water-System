import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import PageShell from '../../components/PageShell/PageShell';
import LoadingState from '../../components/LoadingState/LoadingState';
import { useAnalytics } from '../../context/AnalyticsContext';
import { filterTransactionsByPeriod } from '../../utils/analytics';
import { exportEntryHistoryToCsv } from '../../utils/exportCsv';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { responsiveTableContainerSx } from '../../components/tables/tableStyles';

const periodOptions = [
  { value: 'all', label: 'All time' },
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'Last 7 days' },
  { value: 'monthly', label: 'This month' },
];

const metricConfig = [
  { key: 'entries', label: 'Entries', icon: ReceiptLongRoundedIcon, color: '#078daf' },
  { key: 'bottles', label: 'Bottles moved', icon: WaterDropRoundedIcon, color: '#1875d1' },
  { key: 'revenue', label: 'Recorded revenue', icon: PaymentsRoundedIcon, color: '#0b9b72' },
  { key: 'customers', label: 'Customers', icon: Groups2RoundedIcon, color: '#8359d7' },
];

function bottleLabel(type) {
  return BOTTLE_TYPE_LABELS[type] || type;
}

export default function EntryHistory() {
  const { allTransactions, loading } = useAnalytics();
  const [query, setQuery] = React.useState('');
  const [period, setPeriod] = React.useState('all');
  const [bottleType, setBottleType] = React.useState('all');
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const filtered = React.useMemo(() => {
    const periodRows = period === 'all'
      ? allTransactions
      : filterTransactionsByPeriod(allTransactions, period);
    const normalizedQuery = query.trim().toLowerCase();
    return periodRows
      .filter((entry) => bottleType === 'all' || entry.bottleType === bottleType)
      .filter((entry) => !normalizedQuery || [
        entry.customerName,
        entry.bottleType,
        entry.notes,
        entry.id,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allTransactions, bottleType, period, query]);

  React.useEffect(() => { setPage(0); }, [bottleType, period, query]);

  const totals = React.useMemo(() => ({
    entries: filtered.length,
    bottles: filtered.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
    revenue: filtered.reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0),
    customers: new Set(filtered.map((entry) => entry.customerId)).size,
  }), [filtered]);

  const visibleRows = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <PageShell
      title="Entry history"
      subtitle="A complete, searchable ledger of every saved customer sale"
      actions={(
        <Button
          variant="contained"
          startIcon={<DownloadRoundedIcon />}
          onClick={() => exportEntryHistoryToCsv(filtered)}
          disabled={!filtered.length}
        >
          Export current view
        </Button>
      )}
    >
      {loading ? (
        <LoadingState label="Loading entry history..." variant="table" compact />
      ) : (
        <Stack spacing={2.5}>
          <Grid container spacing={2}>
            {metricConfig.map((metric) => {
              const Icon = metric.icon;
              const value = metric.key === 'revenue'
                ? formatCurrency(totals[metric.key])
                : totals[metric.key].toLocaleString();
              return (
                <Grid item xs={6} lg={3} key={metric.key}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ p: { xs: 1.7, sm: 2.25 } }}>
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={750}>
                            {metric.label}
                          </Typography>
                          <Typography
                            variant="h4"
                            sx={{ mt: 0.6, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}
                          >
                            {value}
                          </Typography>
                        </Box>
                        <Box sx={{
                          display: { xs: 'none', sm: 'grid' },
                          width: 42,
                          height: 42,
                          placeItems: 'center',
                          color: metric.color,
                          bgcolor: `${metric.color}14`,
                          borderRadius: 2,
                        }}
                        >
                          <Icon fontSize="small" />
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Card>
            <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                spacing={1.25}
                sx={{ mb: 2 }}
              >
                <TextField
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search customer, bottle, note or entry ID"
                  aria-label="Search entry history"
                  sx={{ flex: 1, minWidth: { md: 300 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment>
                    ),
                  }}
                />
                <TextField
                  select
                  label="Period"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  sx={{ minWidth: { md: 150 } }}
                >
                  {periodOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Bottle type"
                  value={bottleType}
                  onChange={(event) => setBottleType(event.target.value)}
                  sx={{ minWidth: { md: 170 } }}
                >
                  <MenuItem value="all">All bottle types</MenuItem>
                  {BOTTLE_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>{bottleLabel(type)}</MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Typography variant="body2" fontWeight={800}>
                  All ledger entries
                </Typography>
                <Chip
                  size="small"
                  color={filtered.length ? 'primary' : 'default'}
                  variant="outlined"
                  label={`${filtered.length} results`}
                />
              </Stack>

              <TableContainer sx={responsiveTableContainerSx}>
                <Table stickyHeader aria-label="Complete sales entry history" sx={{ minWidth: 760 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Bottle type</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit price</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleRows.map((entry) => (
                      <TableRow hover key={entry.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>{formatDate(entry.date)}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={800}>{entry.customerName || 'Customer'}</Typography>
                          <Typography variant="caption" color="text.secondary">#{String(entry.id || '').slice(-8)}</Typography>
                        </TableCell>
                        <TableCell><Chip size="small" variant="outlined" label={bottleLabel(entry.bottleType)} /></TableCell>
                        <TableCell align="right">{Number(entry.quantity || 0).toLocaleString()}</TableCell>
                        <TableCell align="right">{formatCurrency(entry.pricePerBottle)}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={850}>{formatCurrency(entry.totalAmount)}</Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {entry.notes || '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!visibleRows.length && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Box sx={{ py: 6, textAlign: 'center' }}>
                            <ReceiptLongRoundedIcon color="disabled" sx={{ fontSize: 44 }} />
                            <Typography variant="h6" sx={{ mt: 1 }}>No matching entries</Typography>
                            <Typography variant="body2" color="text.secondary">Try a different search or time period.</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filtered.length}
                page={Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1))}
                onPageChange={(event, nextPage) => setPage(nextPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </CardContent>
          </Card>
        </Stack>
      )}
    </PageShell>
  );
}
