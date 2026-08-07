import React from 'react';
import PropTypes from 'prop-types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { resolveInvoiceDocument } from '../../utils/invoiceTotals';
import './InvoiceView.css';

function safeText(value, fallback = '—') {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || fallback;
}

export default function InvoiceView({ invoice = null, showStatus = false }) {
  if (!invoice) return null;

  const document = resolveInvoiceDocument(invoice);
  const payload = document.payload;
  const company = payload.company || invoice.company || {};
  const customer = payload.customer || invoice.customer || {};
  const preparedBy = payload.preparedBy || invoice.preparedBy || {};
  const history = document.history;
  const summary = document.summary;
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber || '—';
  const invoiceDate = invoice.invoice_date || invoice.invoiceDate;
  const paymentStatus = invoice.payment_status || invoice.paymentStatus;
  const paymentStatusLabel = paymentStatus === 'void'
    ? 'Void'
    : paymentStatus === 'paid' ? 'Paid' : 'Unpaid';
  const validated = invoice.validated === true;
  const isMonthlyAccountInvoice = history.length > 0
    && history.every((item) => item.paymentSchedule !== 'on_delivery');
  const showPaidColumn = history.some((item) => item.paymentSchedule === 'on_delivery');
  const paymentSummaryLabel = isMonthlyAccountInvoice
    ? 'Account payments'
    : 'Payments applied';

  return (
    <article className="invoice-view">
      <header className="invoice-view__header">
        <div>
          <p className="invoice-view__eyebrow">Himaliya Spring Water</p>
          <h1>{safeText(company.name, 'Himaliya Spring Water')}</h1>
          <p className="invoice-view__meta">{safeText(company.address, 'Sialkot Cantt')}</p>
          <p className="invoice-view__meta">{safeText(company.phone)}</p>
          {company.email && <p className="invoice-view__meta">{safeText(company.email)}</p>}
        </div>
        <div className="invoice-view__badge">
          <span>Invoice</span>
          <strong>{invoiceNumber}</strong>
          <small>{invoiceDate ? formatDate(invoiceDate) : '—'}</small>
          {showStatus && paymentStatus && (
            <div className="invoice-view__status-row">
              <span className={`invoice-view__status invoice-view__status--${paymentStatus}`}>
                {paymentStatusLabel}
              </span>
              {validated && <span className="invoice-view__status invoice-view__status--validated">Validated</span>}
            </div>
          )}
        </div>
      </header>

      <section className="invoice-view__grid">
        <div>
          <h2>Bill to</h2>
          <p className="invoice-view__name">{safeText(customer.name, 'Customer')}</p>
          <p>{safeText(customer.phone)}</p>
          <p>{safeText(customer.address)}</p>
        </div>
        <div>
          <h2>Prepared by</h2>
          <p className="invoice-view__name">{safeText(preparedBy.name, 'Admin')}</p>
          <p>{safeText(preparedBy.role, 'Owner')}</p>
          <p>{safeText(preparedBy.email)}</p>
        </div>
      </section>

      <section className="invoice-view__summary">
        <div><span>Sales</span><strong>{summary.entryCount}</strong></div>
        <div><span>Gross</span><strong>{formatCurrency(summary.grossAmount)}</strong></div>
        <div><span>{paymentSummaryLabel}</span><strong>{formatCurrency(summary.amountPaid)}</strong></div>
        <div><span>Amount due</span><strong>{formatCurrency(summary.totalAmount)}</strong></div>
      </section>

      <div className="invoice-view__table-wrap">
        <table className="invoice-view__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bottle type</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Gross</th>
               {showPaidColumn && <th>Paid on delivery</th>}
              <th>Due</th>
              <th>Terms</th>
            </tr>
          </thead>
          <tbody>
            {history.length ? history.map((item, index) => (
              <tr key={`${item.date}-${index}`}>
                <td>{formatDate(item.date)}</td>
                <td>{safeText(item.bottleType)}</td>
                <td>{item.quantity || 0}</td>
                <td>{formatCurrency(item.pricePerBottle)}</td>
                <td>{formatCurrency(item.grossAmount)}</td>
                {showPaidColumn && (
                  <td>{item.paymentSchedule === 'on_delivery' ? formatCurrency(item.amountPaid) : '—'}</td>
                )}
                <td>{formatCurrency(item.balanceDue)}</td>
                <td>{item.paymentSchedule === 'on_delivery' ? 'Paid at delivery' : 'Monthly account'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={showPaidColumn ? 8 : 7}>No transactions recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="invoice-view__footer">
        <div>
          <p>{safeText(company.footer, 'Payment on delivery or monthly account.')}</p>
          <p>Sanitized bottles, sealed delivery, and routine quality checks.</p>
        </div>
        <div className="invoice-view__total">
          <span>Amount due</span>
          <strong>{formatCurrency(summary.totalAmount)}</strong>
        </div>
      </footer>
    </article>
  );
}

InvoiceView.propTypes = {
  invoice: PropTypes.object,
  showStatus: PropTypes.bool,
};
