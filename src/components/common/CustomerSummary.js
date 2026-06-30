import React, { useMemo } from 'react';
import { Row, Col, Badge } from 'reactstrap';
import Widget from '../Widget/Widget';
import { filterTransactionsByPeriod, computePurchaseStats } from '../../utils/analytics';
import { formatCurrency, getInitials } from '../../utils/formatters';

export default function CustomerSummary({ customer }) {
  const stats = useMemo(() => {
    const history = customer?.purchaseHistory || [];
    return {
      daily: computePurchaseStats(filterTransactionsByPeriod(history, 'daily')),
      monthly: computePurchaseStats(filterTransactionsByPeriod(history, 'monthly')),
      all: computePurchaseStats(history),
    };
  }, [customer]);

  if (!customer) return null;

  return (
    <Widget title={<h5>{customer.name}</h5>} close className="customer-summary-card">
      <div className="customer-summary-hero">
        <div className="customer-summary-avatar">
          {customer.photo ? (
            <img src={customer.photo} alt="" />
          ) : (
            <span>{getInitials(customer.name)}</span>
          )}
        </div>
        <div className="customer-summary-main">
          <div className="customer-summary-title-row">
            <h4>{customer.name}</h4>
            <Badge color="success">Active</Badge>
          </div>
          <p><i className="fa fa-phone mr-2" />{customer.phone}</p>
          <p><i className="fa fa-map-marker mr-2" />{customer.address}</p>
        </div>
      </div>
      <Row className="customer-summary-stats">
        <Col xs={6} md={3}><div><small>Total Bottles</small><strong>{stats.all.totalBottles}</strong></div></Col>
        <Col xs={6} md={3}><div><small>This Month</small><strong>{stats.monthly.totalBottles}</strong></div></Col>
        <Col xs={6} md={3}><div><small>Today</small><strong>{stats.daily.totalBottles}</strong></div></Col>
        <Col xs={6} md={3}><div><small>Revenue</small><strong>{formatCurrency(stats.all.totalRevenue)}</strong></div></Col>
      </Row>
    </Widget>
  );
}
