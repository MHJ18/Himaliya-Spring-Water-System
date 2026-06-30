import React from 'react';
import PropTypes from 'prop-types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import './InvoiceView.css';

function safeText(value, fallback = '—') {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || fallback;
}

export default function InvoiceView({ invoice, showStatus }) {
  if (!invoice) return null;

  const company = invoice.company || {};
  const customer = invoice.customer || {};
  const preparedBy = invoice.preparedBy || {};
  const history = Array.isArray(invoice.history) ? invoice.history : [];
  const summary = invoice.summary || {};
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber || '—';
  const invoiceDate = invoice.invoice_date || invoice.invoiceDate;
  const paymentStatus = invoice.payment_status || invoice.paymentStatus;
  const validated = invoice.validated === true;

  return (
    <article className="invoice-view">
      <header className="invoice-view__header">
        <div>
          <p className="invoice-view__eyebrow">Himaliya Spring Water</p>
          <h1>{safeText(company.name, 'Himaliya Spring Water')}</h1>
          <p className="invoice-view__meta">{safeText(company.address, 'Sialkot Cantt')}</p>
          <p className="invoice-view__meta">{safeText(company.phone)}</p>
        </div>
        <div className="invoice-view__badge">
          <span>Invoice</span>
          <strong>{invoiceNumber}</strong>
          <small>{invoiceDate ? formatDate(invoiceDate) : '—'}</small>
          {showStatus && paymentStatus && (
            <div className="invoice-view__status-row">
              <span className={`invoice-view__status invoice-view__status--${paymentStatus}`}>
                {paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
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
        <div><span>Entries</span><strong>{summary.entryCount || history.length}</strong></div>
        <div><span>Quantity</span><strong>{summary.totalQty || 0}</strong></div>
        <div><span>Total</span><strong>{formatCurrency(summary.totalAmount || 0)}</strong></div>
      </section>

      <div className="invoice-view__table-wrap">
        <table className="invoice-view__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bottle type</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {history.length ? history.map((item, index) => (
              <tr key={`${item.date}-${index}`}>
                <td>{formatDate(item.date)}</td>
                <td>{safeText(item.bottleType)}</td>
                <td>{item.quantity || 0}</td>
                <td>{formatCurrency(item.pricePerBottle)}</td>
                <td>{formatCurrency(item.totalAmount)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>No transactions recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="invoice-view__footer">
        <div>
          <p>Payment on delivery or monthly account.</p>
          <p>Sanitized bottles, sealed delivery, and routine quality checks.</p>
        </div>
        <div className="invoice-view__total">
          <span>Amount due</span>
          <strong>{formatCurrency(summary.totalAmount || 0)}</strong>
        </div>
      </footer>
    </article>
  );
}

InvoiceView.propTypes = {
  invoice: PropTypes.object,
  showStatus: PropTypes.bool,
};

InvoiceView.defaultProps = {
  invoice: null,
  showStatus: false,
};
