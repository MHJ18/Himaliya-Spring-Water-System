import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import InvoiceView from '../../components/invoice/InvoiceView';
import { invoiceApi } from '../../services/api/invoiceApi';
import LoadingState from '../../components/LoadingState/LoadingState';
import './PublicInvoice.css';

export default function PublicInvoice({ match }) {
  const invoiceNumber = match.params.invoiceNumber;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    invoiceApi.lookupByNumber(invoiceNumber)
      .then((data) => {
        if (!active) return;
        if (!data) {
          setError('Invoice not found. Check the invoice number and try again.');
          setInvoice(null);
        } else {
          setInvoice(data);
        }
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load this invoice right now.');
        setInvoice(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [invoiceNumber]);

  return (
    <main className="public-invoice-page">
      <div className="public-invoice-shell">
        <div className="public-invoice-top">
          <Link to="/login" className="public-invoice-brand">Himaliya Spring Water</Link>
          <span>Invoice verification</span>
        </div>

        {loading && <LoadingState label="Loading invoice..." compact variant="table" />}
        {!loading && error && <p className="public-invoice-status public-invoice-status--error">{error}</p>}
        {!loading && invoice && <InvoiceView invoice={invoice} />}
      </div>
    </main>
  );
}

PublicInvoice.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      invoiceNumber: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
