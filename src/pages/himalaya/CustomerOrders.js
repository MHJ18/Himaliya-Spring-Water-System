import React from 'react';
import { Button } from 'reactstrap';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import {
  getAdminCustomerOrders,
  updateAdminCustomerOrder,
} from '../../services/api/customerPortalApi';
import { getBottlePrices } from '../../services/api/bottlePriceApi';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';
import { resolveOrderPricing } from '../../utils/orderPricing';
import LoadingState from '../../components/LoadingState/LoadingState';
import './UtilityPages.css';

function formatDate(value) {
  if (!value) return 'No date selected';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusText(status) {
  if (status === 'accepted') return 'Accepted';
  if (status === 'delivered') return 'Delivered';
  if (status === 'rejected') return 'Rejected';
  if (status === 'canceled') return 'Canceled';
  return 'Pending';
}

function bottleLabel(type) {
  return BOTTLE_TYPE_LABELS[type] || type;
}

export default function CustomerOrders() {
  const [orders, setOrders] = React.useState([]);
  const [prices, setPrices] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const nextPrices = await getBottlePrices({});
      const nextOrders = await getAdminCustomerOrders(nextPrices);
      setOrders(nextOrders);
      setPrices(nextPrices || {});
    } catch (err) {
      toast.error(err.message || 'Could not load customer orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const updateStatus = async (order, status) => {
    setUpdating(order.id);
    try {
      const pricing = resolveOrderPricing(order, prices);
      const updated = await updateAdminCustomerOrder(order, status, '', pricing);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(`Order ${status}. Customer notification sent.`);
    } catch (err) {
      toast.error(err.message || 'Could not update order.');
    } finally {
      setUpdating('');
    }
  };

  const pendingCount = orders.filter((order) => order.status === 'pending').length;

  return (
    <PageShell title="Customer Orders" subtitle="Accept customer requests and keep customers updated">
      <motion.section className="water-page-card customer-orders-admin" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="water-page-card__header">
          <div>
            <span>Delivery app queue</span>
            <h2>{pendingCount} pending</h2>
          </div>
          <Button color="info" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        </div>
        {loading ? (
          <LoadingState label="Loading customer orders..." compact />
        ) : (
          <div className="customer-admin-order-list" tabIndex="0" role="region" aria-label="Scrollable customer order queue">
            {orders.map((order) => {
              const isCompactStatus = ['accepted', 'delivered', 'rejected', 'canceled'].includes(order.status);
              const isSettled = ['accepted', 'delivered', 'rejected', 'canceled'].includes(order.status);
              const pricing = resolveOrderPricing(order, prices);
              const dateLabel = order.status === 'delivered' ? 'Delivered' : 'Requested';
              const dateValue = order.status === 'delivered'
                ? (order.deliveredAt || order.acceptedAt || order.updatedAt || order.createdAt)
                : order.createdAt;
              return (
                <article key={order.id} className={`customer-admin-order customer-admin-order--${order.status}`}>
                  <div className="customer-admin-order__main">
                    <span>{order.profile?.name || 'Customer'} · {order.profile?.phone || 'No phone'}</span>
                    <h3>{order.quantity} × {bottleLabel(order.bottleType)}</h3>
                    {!isCompactStatus && <p>{order.deliveryAddress}</p>}
                    <strong className="customer-admin-order__total">PKR {pricing.totalAmount.toLocaleString()}</strong>
                    <small>{dateLabel} {formatDate(dateValue)}</small>
                    {!isSettled && order.notes && <em>{order.notes}</em>}
                  </div>
                  <div className="customer-admin-order__actions">
                    <strong>{statusText(order.status)}</strong>
                    {order.status === 'pending' && (
                      <>
                        <Button color="primary" size="sm" disabled={updating === order.id} onClick={() => updateStatus(order, 'accepted')}>Accept</Button>
                        <Button color="success" size="sm" disabled={updating === order.id} onClick={() => updateStatus(order, 'delivered')}>Delivered</Button>
                        <Button color="danger" outline size="sm" disabled={updating === order.id} onClick={() => updateStatus(order, 'rejected')}>Reject</Button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <Button color="success" size="sm" disabled={updating === order.id} onClick={() => updateStatus(order, 'delivered')}>Mark delivered</Button>
                    )}
                  </div>
                </article>
              );
            })}
            {!orders.length && <p className="p-4 mb-0">No customer orders yet.</p>}
          </div>
        )}
      </motion.section>
    </PageShell>
  );
}
