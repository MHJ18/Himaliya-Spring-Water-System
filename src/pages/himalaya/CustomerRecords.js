import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutlineRounded,
  DownloadRounded,
  EditRounded,
  ExpandMoreRounded,
  PaymentsOutlined,
  ReceiptLongRounded,
  RefreshRounded,
  SearchRounded,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import CustomerSummary from '../../components/common/CustomerSummary';
import PurchaseHistoryTable from '../../components/tables/PurchaseHistoryTable';
import { mobileOptionalCellSx, responsiveTableContainerSx } from '../../components/tables/tableStyles';
import { useCustomers } from '../../context/CustomerContext';
import { useSettings } from '../../context/SettingsContext';
import { useDebounce } from '../../hooks/useDebounce';
import { FILTER_PERIODS } from '../../data/constants';
import { filterTransactionsByPeriod, computePurchaseStats } from '../../utils/analytics';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { invoiceApi } from '../../services/api/invoiceApi';
import { customerApi } from '../../services/api/customerApi';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import LoadingState from '../../components/LoadingState/LoadingState';

const cardSx = {
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  boxShadow: '0 16px 48px rgba(4, 18, 43, .09)',
};

function Stat({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="subtitle1" fontWeight={850}>{value}</Typography>
    </Box>
  );
}

export default function CustomerRecords({ history, location }) {
  const {
    customers,
    loading,
    deleteTransaction,
    refresh,
  } = useCustomers();
  const { settings } = useSettings();
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const [selectedId, setSelectedId] = useState(null);
  const [period, setPeriod] = useState(FILTER_PERIODS.MONTHLY);
  const [exporting, setExporting] = useState(false);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceUpdating, setInvoiceUpdating] = useState('');
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState('');
  const debouncedQuery = useDebounce(query);

  const matchesQuery = useCallback((customer) => {
    const normalizedQuery = (debouncedQuery || '').trim().toLowerCase();
    if (!normalizedQuery) return true;
    const digits = normalizedQuery.replace(/\D/g, '');
    return (customer.name || '').toLowerCase().includes(normalizedQuery)
      || (customer.email || '').toLowerCase().includes(normalizedQuery)
      || (digits && String(customer.phone || '').replace(/\D/g, '').includes(digits));
  }, [debouncedQuery]);

  const filteredCustomers = useMemo(
    () => customers
      .filter(matchesQuery)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [customers, matchesQuery],
  );

  const loadAllInvoices = useCallback(async () => {
    try {
      setAllInvoices(await invoiceApi.getAll());
    } catch (error) {
      setAllInvoices([]);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { loadAllInvoices(); }, [loadAllInvoices]);

  const selected = customers.find((customer) => customer.id === selectedId);
  const selectedInvoiceKey = selected && [
    selected.id,
    selected.linkedCustomerId,
    selected.portalProfileId,
  ].filter(Boolean).join('|');
  const selectedInvoiceRef = useRef(selected);
  selectedInvoiceRef.current = selected;

  useEffect(() => {
    const invoiceCustomer = selectedInvoiceRef.current;
    if (!invoiceCustomer) {
      setCustomerInvoices([]);
      return undefined;
    }
    let active = true;
    setInvoicesLoading(true);
    invoiceApi.getByCustomer(invoiceCustomer)
      .then((rows) => { if (active) setCustomerInvoices(rows); })
      .catch(() => { if (active) setCustomerInvoices([]); })
      .finally(() => { if (active) setInvoicesLoading(false); });
    return () => { active = false; };
  }, [selectedInvoiceKey]);

  const displayHistory = useMemo(() => {
    if (!selected) return [];
    const sorted = [...(selected.purchaseHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    return filterTransactionsByPeriod(sorted, period);
  }, [selected, period]);

  const periodStats = useMemo(
    () => (selected ? computePurchaseStats(displayHistory) : null),
    [selected, displayHistory],
  );

  const handleExport = async () => {
    if (!selected || exporting) return;
    setExporting(true);
    try {
      let invoiceCustomer = selected;
      if (selected.source === 'portal' || String(selected.id || '').startsWith('portal:')) {
        invoiceCustomer = {
          ...selected,
          id: selected.linkedCustomerId || selected.portalProfileId || String(selected.id).replace(/^portal:/, ''),
          source: 'both',
          purchaseHistory: selected.purchaseHistory || [],
        };
        await customerApi.saveOne(invoiceCustomer);
      }
      const { exportCustomerHistoryPdf } = await import('../../utils/exportPdf');
      const invoice = await exportCustomerHistoryPdf(
        invoiceCustomer,
        displayHistory,
        (customer, historyItems) => invoiceApi.createFromCustomer(customer, historyItems, settings),
      );
      toast.success(`Invoice ${invoice.invoiceNumber} created and downloaded.`);
      const [rows, nextAllInvoices] = await Promise.all([
        invoiceApi.getByCustomer(invoiceCustomer),
        invoiceApi.getAll(),
      ]);
      setCustomerInvoices(rows);
      setAllInvoices(nextAllInvoices);
      refresh();
    } catch (error) {
      toast.error(error.message || 'Could not export the invoice.');
    } finally {
      setExporting(false);
    }
  };

  const updateCustomerInvoice = async (invoice, action) => {
    setInvoiceUpdating(`${invoice.id}-${action}`);
    try {
      const updatedInvoice = action === 'paid'
        ? await invoiceApi.markAsPaid(invoice.id)
        : await invoiceApi.setValidated(invoice.id, true);
      toast.success(
        action === 'paid'
          ? `Invoice ${invoice.invoiceNumber} marked as paid.`
          : `Invoice ${invoice.invoiceNumber} validated.`,
      );
      if (updatedInvoice) {
        setCustomerInvoices((current) => current.map((item) => (
          item.id === updatedInvoice.id ? updatedInvoice : item
        )));
        setAllInvoices((current) => current.map((item) => (
          item.id === updatedInvoice.id ? updatedInvoice : item
        )));
      }
      const [rows, nextAllInvoices] = await Promise.all([
        invoiceApi.getByCustomer(selected),
        invoiceApi.getAll(),
      ]);
      setCustomerInvoices(rows);
      setAllInvoices(nextAllInvoices);
    } catch (error) {
      toast.error(error.message || 'Could not update the invoice.');
    } finally {
      setInvoiceUpdating('');
    }
  };

  const closeDeleteTransactionDialog = () => {
    if (deletingTransactionId) return;
    setTransactionToDelete(null);
  };

  const handleDeleteTransaction = async () => {
    if (!selected || !transactionToDelete) return;
    setDeletingTransactionId(transactionToDelete.id);
    try {
      await deleteTransaction(selected.id, transactionToDelete.id);
      toast.success('Sale entry deleted.');
      setTransactionToDelete(null);
    } catch (error) {
      toast.error(error.message || 'Could not delete the sale entry.');
    } finally {
      setDeletingTransactionId('');
    }
  };

  if (loading) {
    return (
      <PageShell title="Customer records">
        <LoadingState label="Loading customer records…" variant="table" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Customer records"
      subtitle="Review customer profiles, purchase history, and invoice status."
      actions={(
        <Tooltip title="Refresh customer records">
          <IconButton aria-label="Refresh customer records" onClick={refresh}>
            <RefreshRounded />
          </IconButton>
        </Tooltip>
      )}
    >
      <Card sx={{ ...cardSx, mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            type="search"
            placeholder="Search by name, phone, or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }}
          />
        </CardContent>
      </Card>

      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} lg={4}>
          <Card sx={cardSx}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              p: { xs: selected ? 1.5 : 2.5, sm: 2.5 },
              pb: { xs: selected ? 0.75 : 1.5, sm: 1.5 },
            }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">{selected ? 'Selected customer' : 'All customers'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selected ? 'Tap change to choose another record' : `${filteredCustomers.length} matching records`}
                </Typography>
              </Box>
              {selected && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedId(null)}
                  sx={{ display: { xs: 'inline-flex', sm: 'none' }, flex: '0 0 auto' }}
                >
                  Change
                </Button>
              )}
            </Box>
            {filteredCustomers.length === 0 ? (
              <Typography color="text.secondary" sx={{ px: 2.5, py: 5, textAlign: 'center' }}>No customers found.</Typography>
            ) : (
              <List
                disablePadding
                sx={{
                  maxHeight: {
                    xs: selected ? 76 : 'min(52vh, 420px)',
                    sm: 'min(52vh, 520px)',
                    lg: 'min(64vh, 660px)',
                  },
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  transition: 'max-height 180ms ease',
                }}
              >
                {filteredCustomers.map((customer, index) => (
                  <ListItem
                    key={customer.id}
                    disablePadding
                    divider
                    sx={{
                      display: selectedId && selectedId !== customer.id
                        ? { xs: 'none', sm: 'flex' }
                        : 'flex',
                    }}
                  >
                    <ListItemButton
                      selected={selectedId === customer.id}
                      onClick={() => setSelectedId(customer.id)}
                      sx={{ px: 2.5, py: 1.25 }}
                    >
                      <ListItemAvatar>
                        <Avatar src={customer.photo || getCustomerAvatar(index)}>
                          {(customer.name || '?').charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={customer.name}
                        secondary={customer.phone || customer.email}
                        primaryTypographyProps={{ fontWeight: 800, noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                      <Chip
                        size="small"
                        color={customer.source === 'portal' ? 'info' : 'default'}
                        variant="outlined"
                        label={customer.source === 'both' ? 'Admin + app' : customer.source === 'portal' ? 'App' : 'Admin'}
                        sx={{ ml: 1 }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          {!selected ? (
            <Card sx={cardSx}>
              <Stack alignItems="center" spacing={1.5} sx={{ p: { xs: 4, sm: 7 }, textAlign: 'center' }}>
                <Avatar sx={{ width: 58, height: 58, bgcolor: 'primary.main' }}><ReceiptLongRounded /></Avatar>
                <Typography variant="h6">Choose a customer</Typography>
                <Typography variant="body2" color="text.secondary">
                  Their contact details, invoices, and purchase history will appear here.
                </Typography>
              </Stack>
            </Card>
          ) : (
            <Stack spacing={3}>
              <CustomerSummary customer={selected} />

              <Card sx={cardSx}>
                <CardContent>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} gap={2}>
                    <Box>
                      <Typography variant="h6">Reporting period</Typography>
                      <Typography variant="body2" color="text.secondary">Filter the ledger before generating an invoice.</Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <ToggleButtonGroup
                        value={period}
                        exclusive
                        size="small"
                        onChange={(event, value) => { if (value) setPeriod(value); }}
                        aria-label="Purchase history period"
                      >
                        {Object.values(FILTER_PERIODS).map((value) => (
                          <ToggleButton key={value} value={value} sx={{ textTransform: 'capitalize' }}>{value}</ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                      <Button
                        variant="contained"
                        startIcon={exporting ? <CircularProgress size={17} color="inherit" /> : <DownloadRounded />}
                        onClick={handleExport}
                        disabled={exporting}
                      >
                        {exporting ? 'Creating…' : 'Export invoice'}
                      </Button>
                    </Stack>
                  </Stack>
                  {periodStats && (
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6} sm={3}><Stat label="Orders" value={periodStats.totalOrders} /></Grid>
                      <Grid item xs={6} sm={3}><Stat label="Bottles" value={periodStats.totalBottles} /></Grid>
                      <Grid item xs={6} sm={3}><Stat label="Top type" value={periodStats.mostPurchased} /></Grid>
                      <Grid item xs={6} sm={3}><Stat label="Revenue" value={formatCurrency(periodStats.totalRevenue)} /></Grid>
                    </Grid>
                  )}
                </CardContent>
              </Card>

              <Card sx={cardSx}>
                <Box sx={{ p: 2.5, pb: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">Customer invoices</Typography>
                      <Typography variant="body2" color="text.secondary">{customerInvoices.length} invoices linked to this customer</Typography>
                    </Box>
                    <Button size="small" startIcon={<EditRounded />} onClick={() => history.push(`/app/customers/${selected.id}/edit`)}>
                      Edit customer
                    </Button>
                  </Stack>
                </Box>
                {invoicesLoading ? (
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 2.5 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">Loading invoices…</Typography>
                  </Stack>
                ) : customerInvoices.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 3 }}>No invoices generated for this customer yet.</Typography>
                ) : (
                  <Stack
                    divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}
                    role="region"
                    tabIndex={0}
                    aria-label="Scrollable customer invoices"
                    sx={{
                      maxHeight: { xs: 320, md: 420 },
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      scrollbarGutter: 'stable',
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                      },
                    }}
                  >
                    {customerInvoices.map((invoice) => (
                      <Box key={invoice.id} sx={{ px: 2.5, py: 1.75 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5}>
                          <Box>
                            <Typography variant="subtitle2">{invoice.invoiceNumber}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(invoice.invoiceDate)} · {formatCurrency(invoice.totalAmount)}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip size="small" color={invoice.paymentStatus === 'paid' ? 'success' : 'warning'} label={invoice.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'} />
                            {invoice.validated && <Chip size="small" color="info" variant="outlined" label="Validated" />}
                            {invoice.paymentStatus !== 'paid' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<PaymentsOutlined />}
                                disabled={Boolean(invoiceUpdating)}
                                onClick={() => updateCustomerInvoice(invoice, 'paid')}
                              >
                                Mark paid
                              </Button>
                            )}
                            {!invoice.validated && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CheckCircleOutlineRounded />}
                                disabled={Boolean(invoiceUpdating)}
                                onClick={() => updateCustomerInvoice(invoice, 'validate')}
                              >
                                Validate
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Card>

              <Card sx={cardSx}>
                <Box sx={{ p: 2.5, pb: 1.5 }}>
                  <Typography variant="h6">Purchase history</Typography>
                  <Typography variant="body2" color="text.secondary">{displayHistory.length} transactions in this period</Typography>
                </Box>
                <Box sx={{ px: { xs: 1, sm: 2.5 }, pb: 2.5 }}>
                  <PurchaseHistoryTable
                    transactions={displayHistory}
                    onDelete={setTransactionToDelete}
                    deletingTransactionId={deletingTransactionId}
                  />
                </Box>
              </Card>
            </Stack>
          )}
        </Grid>
      </Grid>

      <Accordion sx={{ ...cardSx, mt: 3, '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <ReceiptLongRounded color="primary" />
            <Box>
              <Typography variant="subtitle1" fontWeight={850}>Invoice register</Typography>
              <Typography variant="caption" color="text.secondary">{allInvoices.length} invoices across all customers</Typography>
            </Box>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <TableContainer
            role="region"
            tabIndex={0}
            aria-label="Scrollable invoice register"
            sx={{ ...responsiveTableContainerSx, maxHeight: 'min(60vh, 560px)' }}
          >
            <Table stickyHeader aria-label="Invoice register" sx={{ minWidth: { xs: 520, sm: 680 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell sx={mobileOptionalCellSx}>Generated</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allInvoices.map((invoice) => (
                  <TableRow key={invoice.id || invoice.invoiceNumber} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={800}>{invoice.invoiceNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">{invoice.validated ? 'Validated' : 'Not validated'}</Typography>
                    </TableCell>
                    <TableCell>{(invoice.customer && invoice.customer.name) || invoice.customerId || 'Customer'}</TableCell>
                    <TableCell sx={mobileOptionalCellSx}>{formatDate(invoice.invoiceDate)}</TableCell>
                    <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                    <TableCell><Chip size="small" color={invoice.paymentStatus === 'paid' ? 'success' : 'warning'} label={invoice.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'} /></TableCell>
                  </TableRow>
                ))}
                {!allInvoices.length && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>No invoices generated yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      <Dialog open={Boolean(transactionToDelete)} onClose={closeDeleteTransactionDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Delete sale entry</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {`This will permanently remove the ${
              transactionToDelete ? formatCurrency(transactionToDelete.totalAmount) : ''
            } sale from ${selected ? selected.name : 'this customer'}'s purchase history.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={closeDeleteTransactionDialog} disabled={Boolean(deletingTransactionId)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteTransaction} disabled={Boolean(deletingTransactionId)}>
            {deletingTransactionId ? 'Deleting...' : 'Delete entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
