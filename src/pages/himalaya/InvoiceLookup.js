import React, { useState } from 'react';
import { withRouter } from 'react-router-dom';
import { Input, Button, Badge } from 'reactstrap';
import { toast } from 'react-toastify';
import {
  Search,
  ExternalLink,
  FileText,
  Loader2,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import InvoiceView from '../../components/invoice/InvoiceView';
import { invoiceApi } from '../../services/api/invoiceApi';
import './InvoiceLookup.css';

function InvoiceLookup({ history }) {
  const [query, setQuery] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState('');
  const [error, setError] = useState('');

  const invoiceNumber = invoice && (invoice.invoice_number || invoice.invoiceNumber);
  const paymentStatus = invoice && (invoice.payment_status || invoice.paymentStatus || 'unpaid');
  const isValidated = invoice && invoice.validated === true;

  const handleSearch = async (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;

    setLoading(true);
    setError('');
    setInvoice(null);

    try {
      const data = await invoiceApi.lookupByNumber(value, { authenticatedFallback: true });
      if (!data) {
        setError('No invoice found for that number.');
        return;
      }
      setInvoice(data);
    } catch (lookupError) {
      setError(lookupError.message || 'Could not look up that invoice.');
    } finally {
      setLoading(false);
    }
  };

  const refreshInvoice = async () => {
    if (!invoiceNumber) return;
    const data = await invoiceApi.lookupByNumber(invoiceNumber, { authenticatedFallback: true });
    if (data) setInvoice(data);
  };

  const updatePayment = async (nextStatus) => {
    if (!invoice) return;
    setUpdating(nextStatus);
    try {
      const action = nextStatus === 'paid' ? invoiceApi.markAsPaid : invoiceApi.markAsUnpaid;
      await action.call(invoiceApi, invoice.id || invoiceNumber);
      await refreshInvoice();
      toast.success(nextStatus === 'paid' ? 'Invoice marked as paid.' : 'Invoice marked as unpaid.');
    } catch (err) {
      toast.error(err.message || 'Could not update invoice.');
    } finally {
      setUpdating('');
    }
  };

  const handleValidate = async () => {
    if (!invoice) return;
    setUpdating('validate');
    try {
      await invoiceApi.setValidated(invoice.id || invoiceNumber, true);
      await refreshInvoice();
      toast.success('Invoice validated for the customer.');
    } catch (err) {
      toast.error(err.message || 'Could not validate invoice.');
    } finally {
      setUpdating('');
    }
  };

  return (
    <PageShell title="Invoice Lookup" subtitle="Search invoices, validate them, and manage payment status">
      <Widget className="mb-4 invoice-lookup-card">
        <div className="invoice-lookup-card__intro">
          <span className="invoice-lookup-card__icon" aria-hidden="true"><FileText size={24} /></span>
          <div>
            <h2>Find a customer invoice</h2>
            <p>Search by invoice number, review details, validate the bill, and control whether customers can see it.</p>
          </div>
        </div>

        <form className="invoice-lookup-form" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="invoice-number">Invoice number</label>
          <div className="invoice-lookup-form__control">
            <Search size={20} aria-hidden="true" />
            <Input
              id="invoice-number"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value.toUpperCase())}
              placeholder="e.g. HSW-8K2P4M7N"
              autoComplete="off"
              aria-describedby={error ? 'invoice-lookup-error' : undefined}
            />
          </div>
          <Button color="primary" type="submit" disabled={loading || !query.trim()}>
            {loading ? <><Loader2 className="invoice-search-spinner" size={18} aria-hidden="true" /> Searching...</> : 'Find invoice'}
          </Button>
        </form>

        {loading && (
          <div className="invoice-lookup-loading" role="status" aria-live="polite">
            <span className="invoice-lookup-loading__pulse" aria-hidden="true" />
            Searching securely for invoice {query.trim()}...
          </div>
        )}

        {error && <p id="invoice-lookup-error" role="alert" className="invoice-lookup-error">{error}</p>}

        {invoice && (
          <div className="invoice-lookup-card__result">
            <div className="invoice-lookup-result-copy">
              <span>Invoice found</span>
              <strong>{invoiceNumber}</strong>
              <small>{paymentStatus === 'paid' ? 'Visible in the customer portal' : 'Hidden from the customer portal until paid'}</small>
            </div>

            <div className="invoice-lookup-status-row">
              <Badge color={paymentStatus === 'paid' ? 'success' : 'warning'} className="invoice-lookup-badge">
                {paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
              </Badge>
              {isValidated && (
                <Badge color="info" className="invoice-lookup-badge">
                  <CheckCircle2 size={12} aria-hidden="true" /> Validated
                </Badge>
              )}
            </div>

            <div className="invoice-lookup-actions">
              {paymentStatus !== 'paid' ? (
                <Button className="invoice-action-btn invoice-action-btn--paid" disabled={Boolean(updating)} onClick={() => updatePayment('paid')}>
                  <CreditCard size={16} aria-hidden="true" />
                  {updating === 'paid' ? 'Saving...' : 'Mark paid'}
                </Button>
              ) : (
                <Button className="invoice-action-btn invoice-action-btn--unpaid" disabled={Boolean(updating)} onClick={() => updatePayment('unpaid')}>
                  <RotateCcw size={16} aria-hidden="true" />
                  {updating === 'unpaid' ? 'Saving...' : 'Mark unpaid'}
                </Button>
              )}

              {!isValidated && (
                <Button className="invoice-action-btn invoice-action-btn--validate" disabled={Boolean(updating)} onClick={handleValidate}>
                  <ShieldCheck size={16} aria-hidden="true" />
                  {updating === 'validate' ? 'Saving...' : 'Validate'}
                </Button>
              )}

              <Button
                className="invoice-action-btn invoice-action-btn--open"
                type="button"
                onClick={() => history.push(`/invoice/${invoiceNumber || query.trim()}`)}
              >
                Public view <ExternalLink size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Widget>

      {invoice && <InvoiceView invoice={invoice} showStatus />}
    </PageShell>
  );
}

export default withRouter(InvoiceLookup);
