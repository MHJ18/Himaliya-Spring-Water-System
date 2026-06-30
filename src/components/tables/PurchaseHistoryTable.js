import React from 'react';
import { Table } from 'reactstrap';
import { formatCurrency, formatDate } from '../../utils/formatters';
import s from '../../pages/dashboard/Dashboard.module.scss';

export default function PurchaseHistoryTable({ transactions }) {
  if (!transactions?.length) {
    return <p className="text-muted mb-0 py-2">No purchases in this period.</p>;
  }
  return (
    <div className={`widget-table-overflow ${s.table || ''}`}>
      <Table striped size="sm" className="mb-0">
        <thead className="no-bd">
          <tr>
            <th>Date</th>
            <th>Bottle Type</th>
            <th>Qty</th>
            <th>Price</th>
            <th className="text-align-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td className="text-nowrap">{formatDate(t.date)}</td>
              <td>{t.bottleType}</td>
              <td>{t.quantity}</td>
              <td>{formatCurrency(t.pricePerBottle)}</td>
              <td className="text-align-right fw-semi-bold">{formatCurrency(t.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
