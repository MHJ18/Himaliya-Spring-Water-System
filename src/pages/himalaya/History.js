import React from 'react';
import { motion } from 'framer-motion';
import PageShell from '../../components/PageShell/PageShell';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useCustomers } from '../../context/CustomerContext';
import { formatCurrency } from '../../utils/formatters';
import LoadingState from '../../components/LoadingState/LoadingState';
import './UtilityPages.css';

export default function History() {
  const { allTransactions, loading } = useAnalytics();
  const { customers } = useCustomers();
  const deliveries = [...allTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <PageShell title="Delivery History" subtitle="Past orders and completed routes">
      <motion.section className="water-page-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="water-page-card__header">
          <div><span>Order archive</span><h2>{deliveries.length} deliveries</h2></div>
        </div>
        {loading ? <LoadingState label="Loading deliveries..." variant="table" compact /> : (
          <div className="water-table-wrap">
            <table className="water-data-table">
              <thead><tr><th>Date</th><th>Customer / Location</th><th>Quantity</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {deliveries.map((delivery) => {
                  const customer = customers.find((item) => item.id === delivery.customerId);
                  const rejected = delivery.status === 'rejected';
                  const canceled = delivery.status === 'canceled' || delivery.status === 'cancelled';
                  const failed = canceled || rejected;
                  return <tr key={delivery.id}>
                    <td data-label="Date">{new Date(delivery.date).toLocaleDateString('en-GB')}</td>
                    <td data-label="Customer / Location"><strong>{delivery.customerName}</strong><small>{customer?.address || delivery.bottleType || 'Location not recorded'}</small></td>
                    <td data-label="Quantity">{delivery.quantity} units</td>
                    <td data-label="Amount">{formatCurrency(delivery.totalAmount)}</td>
                    <td data-label="Status"><span className={`water-status ${failed ? 'water-status--danger' : 'water-status--success'}`}>{rejected ? 'Rejected' : canceled ? 'Canceled' : 'Delivered'}</span></td>
                  </tr>;
                })}
                {!deliveries.length && <tr><td colSpan="5" className="water-empty">No delivery history yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>
    </PageShell>
  );
}
