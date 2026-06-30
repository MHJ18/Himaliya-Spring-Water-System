import React, {
  useState, useMemo, useEffect, useCallback,
} from 'react';
import { Row, Col, Input, Button, ButtonGroup, Badge } from 'reactstrap';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import CustomerSummary from '../../components/common/CustomerSummary';
import PurchaseHistoryTable from '../../components/tables/PurchaseHistoryTable';
import { useCustomers } from '../../context/CustomerContext';
import { useSettings } from '../../context/SettingsContext';
import { useDebounce } from '../../hooks/useDebounce';
import { FILTER_PERIODS } from '../../data/constants';
import { filterTransactionsByPeriod, computePurchaseStats } from '../../utils/analytics';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportCustomerHistoryPdf } from '../../utils/exportPdf';
import { invoiceApi } from '../../services/api/invoiceApi';
import { customerApi } from '../../services/api/customerApi';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import LoadingState from '../../components/LoadingState/LoadingState';
import './CustomerRecords.css';

export default function CustomerRecords({ location }) {
  const {
    customers,
    loading,
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
  const debouncedQuery = useDebounce(query);
  const matchesQuery = useCallback((customer) => {
    const q = (debouncedQuery || '').trim().toLowerCase();
    if (!q) return true;
    const digits = q.replace(/\D/g, '');
    return (customer.name || '').toLowerCase().includes(q) ||
      (customer.email || '').toLowerCase().includes(q) ||
      (digits && String(customer.phone || '').replace(/\D/g, '').includes(digits));
  }, [debouncedQuery]);
  const filteredCustomers = useMemo(
    () => customers.filter(matchesQuery).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [customers, matchesQuery],
  );
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    invoiceApi.getAll()
      .then((rows) => { if (active) setAllInvoices(rows); })
      .catch(() => { if (active) setAllInvoices([]); });
    return () => { active = false; };
  }, []);

  const selected = customers.find((c) => c.id === selectedId);
  const selectedInvoiceKey = selected && [
    selected.id,
    selected.linkedCustomerId,
    selected.portalProfileId,
  ].filter(Boolean).join('|');

  useEffect(() => {
    if (!selected) {
      setCustomerInvoices([]);
      return undefined;
    }
    let active = true;
    setInvoicesLoading(true);
    invoiceApi.getByCustomer(selected)
      .then((rows) => { if (active) setCustomerInvoices(rows); })
      .catch(() => { if (active) setCustomerInvoices([]); })
      .finally(() => { if (active) setInvoicesLoading(false); });
    return () => { active = false; };
  }, [selected, selectedInvoiceKey]);
  const periodStats = useMemo(() => {
    if (!selected) return null;
    return computePurchaseStats(filterTransactionsByPeriod(selected.purchaseHistory || [], period));
  }, [selected, period]);

  const displayHistory = useMemo(() => {
    if (!selected) return [];
    const sorted = [...(selected.purchaseHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    return filterTransactionsByPeriod(sorted, period);
  }, [selected, period]);

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
      toast.error(error.message || 'Could not export invoice.');
    } finally {
      setExporting(false);
    }
  };

  const updateCustomerInvoice = async (invoice, action) => {
    setInvoiceUpdating(`${invoice.id}-${action}`);
    try {
      let updatedInvoice;
      if (action === 'paid') {
        updatedInvoice = await invoiceApi.markAsPaid(invoice.id);
        toast.success(`Invoice ${invoice.invoiceNumber} marked as paid.`);
      } else {
        updatedInvoice = await invoiceApi.setValidated(invoice.id, true);
        toast.success(`Invoice ${invoice.invoiceNumber} validated.`);
      }
      if (updatedInvoice) {
        setCustomerInvoices((current) => current.map((item) => (
          item.id === updatedInvoice.id ? updatedInvoice : item
        )));
        setAllInvoices((current) => current.map((item) => (
          item.id === updatedInvoice.id ? updatedInvoice : item
        )));
      }
      const rows = await invoiceApi.getByCustomer(selected);
      const nextAllInvoices = await invoiceApi.getAll();
      setCustomerInvoices(rows);
      setAllInvoices(nextAllInvoices);
    } catch (err) {
      toast.error(err.message || 'Could not update invoice.');
    } finally {
      setInvoiceUpdating('');
    }
  };

  const invoiceRegister = (
    <Widget className="mt-4 customer-invoice-register" title={<h6>Invoice Register ({allInvoices.length})</h6>} bodyClass="p-0" collapse collapsed>
      {allInvoices.length === 0 ? (
        <p className="text-muted p-3 mb-0">No invoices generated yet.</p>
      ) : (
        <div className="customer-invoice-register-table">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Generated</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allInvoices.map((invoice) => (
                <tr key={invoice.id || invoice.invoiceNumber}>
                  <td>
                    <strong>{invoice.invoiceNumber}</strong>
                    <small>{invoice.validated ? 'Validated' : 'Not validated'}</small>
                  </td>
                  <td>{invoice.customer?.name || invoice.customerId || 'Customer'}</td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td>{formatCurrency(invoice.totalAmount)}</td>
                  <td>
                    <Badge color={invoice.paymentStatus === 'paid' ? 'success' : 'warning'}>
                      {invoice.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Widget>
  );

  if (loading) return <PageShell title="Customer Records"><LoadingState label="Loading customer records..." variant="table" /></PageShell>;

  return (
    <PageShell title="Customer Records" subtitle="Search and view purchase history">
      <Widget className="mb-4">
        <Input type="search" placeholder="Search by name, phone, or email..." value={query} onChange={(e) => setQuery(e.target.value)} className="bg-custom-dark border-0" />
      </Widget>
      <Row>
        <Col lg={4}>
          <Widget title={<h6>All Customers ({filteredCustomers.length})</h6>} collapse bodyClass="p-0">
            <div className="list-group list-group-lg mb-0 customer-record-scroll-list" tabIndex="0" role="region" aria-label="Scrollable customer list">
              {filteredCustomers.length === 0 ? (
                <p className="text-muted p-3 mb-0">No customers found</p>
              ) : filteredCustomers.map((c, idx) => (
                <button key={c.id} type="button" className={`customer-record-list-item list-group-item list-group-item-action text-left ${selectedId === c.id ? 'active' : ''}`} onClick={() => setSelectedId(c.id)}>
                  <span className="customer-record-list-avatar">
                    <img src={c.photo || getCustomerAvatar(idx)} alt="" />
                    <i className={`status status-bottom ${c.source === 'portal' ? 'bg-info' : 'bg-success'}`} />
                  </span>
                  <div className="customer-record-list-copy">
                    <h6 className="m-0">{c.name}</h6>
                    <small className="text-muted">{c.phone || c.email}</small>
                    <span className="customer-record-source">
                      {c.source === 'both' ? 'Admin + portal' : c.source === 'portal' ? 'Portal signup' : 'Admin'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Widget>
        </Col>
        <Col lg={8}>
          {!selected ? (
            <Widget title={<h6>Details</h6>}><p className="text-muted mb-0">Select a customer to view details.</p></Widget>
          ) : (
            <>
              <CustomerSummary customer={selected} />
              <Widget className="mt-4 customer-record-tools" title={<h6>Filter & Export</h6>}>
                <div className="customer-record-toolbar">
                  <ButtonGroup className="customer-record-filter">
                  {Object.values(FILTER_PERIODS).map((p) => (
                    <Button key={p} color={period === p ? 'primary' : 'secondary'} size="sm" onClick={() => setPeriod(p)} className="text-capitalize">{p}</Button>
                  ))}
                  </ButtonGroup>
                  <Button color="info" size="sm" className="customer-export-btn" onClick={handleExport} disabled={exporting}>
                    <i className="fa fa-download mr-1" /> {exporting ? 'Creating...' : 'Export PDF'}
                  </Button>
                </div>
                {periodStats && (
                  <Row className="mt-4">
                    <Col xs={6} md={3}><small className="text-muted d-block">Orders</small><span className="fw-bold">{periodStats.totalOrders}</span></Col>
                    <Col xs={6} md={3}><small className="text-muted d-block">Bottles</small><span className="fw-bold">{periodStats.totalBottles}</span></Col>
                    <Col xs={6} md={3}><small className="text-muted d-block">Top Type</small><span className="fw-bold">{periodStats.mostPurchased}</span></Col>
                    <Col xs={6} md={3}><small className="text-muted d-block">Revenue</small><span className="fw-bold">{formatCurrency(periodStats.totalRevenue)}</span></Col>
                  </Row>
                )}
              </Widget>
              <Widget className="mt-4" title={<h6>Customer Invoices ({customerInvoices.length})</h6>} bodyClass="p-0">
                {invoicesLoading ? (
                  <p className="text-muted p-3 mb-0">Loading invoices...</p>
                ) : customerInvoices.length === 0 ? (
                  <p className="text-muted p-3 mb-0">No invoices generated for this customer yet.</p>
                ) : (
                  <div className="customer-record-invoice-list">
                    {customerInvoices.map((invoice) => (
                      <article key={invoice.id} className="customer-record-invoice-item">
                        <div>
                          <strong>{invoice.invoiceNumber}</strong>
                          <small>{formatDate(invoice.invoiceDate)} · {formatCurrency(invoice.totalAmount)}</small>
                        </div>
                        <div className="customer-record-invoice-meta">
                          <Badge color={invoice.paymentStatus === 'paid' ? 'success' : 'warning'}>
                            {invoice.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                          </Badge>
                          {invoice.validated && <Badge color="info">Validated</Badge>}
                        </div>
                        <div className="customer-record-invoice-actions">
                          {invoice.paymentStatus !== 'paid' && (
                            <Button
                              size="sm"
                              color="success"
                              disabled={Boolean(invoiceUpdating)}
                              onClick={() => updateCustomerInvoice(invoice, 'paid')}
                            >
                              Mark paid
                            </Button>
                          )}
                          {!invoice.validated && (
                            <Button
                              size="sm"
                              color="info"
                              outline
                              disabled={Boolean(invoiceUpdating)}
                              onClick={() => updateCustomerInvoice(invoice, 'validate')}
                            >
                              Validate
                            </Button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </Widget>
              <Widget className="mt-4" title={<h6>Purchase History ({displayHistory.length})</h6>} refresh bodyClass="p-0">
                <div className="p-3"><PurchaseHistoryTable transactions={displayHistory} /></div>
              </Widget>
            </>
          )}
        </Col>
      </Row>
      {invoiceRegister}
    </PageShell>
  );
}
