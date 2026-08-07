import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@mui/material';
import { Link, withRouter } from 'react-router-dom';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import { motion } from 'motion/react';
import { Droplets, MapPin, Phone, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import { updateAdminCustomerOrder } from '../../services/api/customerPortalApi';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';
import { resolveOrderPricing } from '../../utils/orderPricing';
import LoadingState from '../../components/LoadingState/LoadingState';
import './UtilityPages.css';
import { useDeliveries } from '../../context/DeliveryContext';

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

function orderBottleSummary(order) {
  const items = Array.isArray(order.items) && order.items.length
    ? order.items
    : [{ bottleType: order.bottleType, quantity: order.quantity }];
  return items.map((item) => `${item.quantity} × ${bottleLabel(item.bottleType)}`).join(' + ');
}

function CustomerOrders({ location }) {
  const { orders, prices, loading, refresh, updateOrder } = useDeliveries();
  const [updating, setUpdating] = React.useState('');
  const focusedOrderId = location.state && location.state.focusOrderId;

  React.useEffect(() => {
    if (!focusedOrderId || loading || !orders.some((order) => order.id === focusedOrderId)) return undefined;
    const timer = window.setTimeout(() => {
      const target = document.querySelector(`[data-customer-order-id="${focusedOrderId}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusedOrderId, loading, orders]);

  const updateStatus = async (order, status) => {
    setUpdating(order.id);
    try {
      const pricing = resolveOrderPricing(order, prices);
      const updated = await updateAdminCustomerOrder(order, status, '', pricing);
      updateOrder(updated);
      toast.success(
        status === 'accepted'
          ? 'Order accepted. It is now available in Delivery routes.'
          : `Order ${status}. Customer notification sent.`,
      );
    } catch (err) {
      toast.error(err.message || 'Could not update order.');
    } finally {
      setUpdating('');
    }
  };

  const pendingCount = orders.filter((order) => order.status === 'pending').length;

  return (
    <PageShell
      title="Customer Orders"
      subtitle="Accept customer requests and keep customers updated"
      actions={(
        <Button component={Link} to="/app/rider-tracking" variant="contained" startIcon={<RouteRoundedIcon />}>
          Open delivery tracker
        </Button>
      )}
    >
      <motion.section className="water-page-card customer-orders-admin" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="water-page-card__header">
          <div>
            <span>Customer orders</span>
            <h2>Delivery queue</h2>
          </div>
          <div className="customer-order-queue-controls">
            <span className="customer-order-pending-count">{pendingCount} pending</span>
            <button type="button" className="customer-order-refresh" onClick={refresh} disabled={loading} aria-label="Refresh delivery queue" title="Refresh delivery queue">
              <RefreshCw size={19} className={loading ? 'is-spinning' : ''} />
            </button>
          </div>
        </div>
        {loading ? (
          <LoadingState label="Loading customer orders..." compact variant="table" />
        ) : (
          <div className="customer-admin-order-list" tabIndex="0" role="region" aria-label="Scrollable customer order queue">
            {orders.map((order) => {
              const showAddress = ['pending', 'accepted'].includes(order.status);
              const pricing = resolveOrderPricing(order, prices);
              const dateLabel = order.status === 'delivered' ? 'Delivered' : 'Requested';
              const dateValue = order.status === 'delivered'
                ? (order.deliveredAt || order.acceptedAt || order.updatedAt || order.createdAt)
                : order.createdAt;
              return (
                <article
                  key={order.id}
                  data-customer-order-id={order.id}
                  className={`customer-admin-order customer-admin-order--${order.status}${focusedOrderId === order.id ? ' is-notification-focus' : ''}`}
                >
                  <div className="customer-admin-order__main">
                    <header>
                      <div>
                        <strong>{order.profile?.name || 'Customer'}</strong>
                        <small><Phone size={13} /> {order.profile?.phone || 'No phone'}</small>
                      </div>
                      <span className={`customer-admin-order__status customer-admin-order__status--${order.status}`}>{statusText(order.status)}</span>
                    </header>
                    <div className="customer-admin-order__summary">
                      <span><Droplets /></span>
                      <div><strong>{orderBottleSummary(order)}</strong><small>{dateLabel} {formatDate(dateValue)}</small></div>
                      <strong className="customer-admin-order__total">PKR {pricing.totalAmount.toLocaleString()}</strong>
                    </div>
                    {showAddress && <p className="customer-admin-order__address"><MapPin size={15} /> {order.deliveryAddress || 'Address missing'}</p>}
                    {order.status === 'pending' && order.notes && <em>{order.notes}</em>}
                  </div>
                  <div className="customer-admin-order__actions">
                    {order.status === 'pending' && (
                      <>
                        <Button variant="contained" color="primary" size="small" disabled={updating === order.id} onClick={() => updateStatus(order, 'accepted')}>Accept</Button>
                        <Button variant="outlined" color="error" size="small" disabled={updating === order.id} onClick={() => updateStatus(order, 'rejected')}>Reject</Button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <Button
                        component={Link}
                        to={{ pathname: '/app/rider-tracking', state: { focusOrderId: order.id } }}
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<RouteRoundedIcon />}
                      >
                        Manage route
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
            {!orders.length && <p style={{ margin: 0, padding: '1.5rem' }}>No customer orders yet.</p>}
          </div>
        )}
      </motion.section>
    </PageShell>
  );
}

CustomerOrders.propTypes = {
  location: PropTypes.shape({ state: PropTypes.object }).isRequired,
};

export default withRouter(CustomerOrders);
