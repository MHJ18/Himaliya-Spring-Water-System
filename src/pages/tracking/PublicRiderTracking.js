import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Clock3,
  Droplets,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  ShieldCheck,
} from 'lucide-react';
import RiderMap from '../../components/RiderMap/RiderMap';
import { getPublicRiderTracking } from '../../services/api/customerPortalApi';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';
import './PublicRiderTracking.css';

const steps = [
  { key: 'assigned', label: 'Ready' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'delivered', label: 'Delivered' },
];

const statusCopy = {
  unassigned: ['Order received', 'Your delivery address is saved from your profile. We will mark it ready shortly.'],
  assigned: ['Your order is ready', 'Your water is packed and waiting for the rider to leave.'],
  picked_up: ['Rider has your order', 'Your gallons are on the way to the address on your profile.'],
  en_route: ['Your water is on the way', 'Follow the live rider position as the delivery moves toward you.'],
  nearby: ['Your rider is nearby', 'Please keep empty gallons ready and watch for the rider.'],
  delivered: ['Delivery completed', 'Your order has arrived. Thank you for choosing Himaliya Spring Water.'],
};

function stepIndexForStatus(status) {
  if (status === 'delivered') return 2;
  if (['picked_up', 'en_route', 'nearby'].includes(status)) return 1;
  if (status === 'assigned') return 0;
  return -1;
}

function dateLabel(value) {
  if (!value) return 'Scheduled by dispatch';
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function updateLabel(value) {
  if (!value) return 'Waiting for first rider location';
  return `Location updated ${new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function TrackingLoading() {
  return (
    <main className="public-tracking-page public-tracking-page--loading" aria-label="Loading delivery tracking" role="status">
      <div className="public-tracking-loading">
        <span />
        <i />
        <i />
        <div><i /><i /></div>
      </div>
      <span className="sr-only">Loading delivery tracking...</span>
    </main>
  );
}

export default function PublicRiderTracking({ match }) {
  const [tracking, setTracking] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState('');
  const requestRunning = React.useRef(false);

  const load = React.useCallback(async (initial = false) => {
    if (requestRunning.current) return;
    requestRunning.current = true;
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const next = await getPublicRiderTracking(match.params.trackingToken);
      setTracking(next);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'This tracking link is not available.');
    } finally {
      requestRunning.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [match.params.trackingToken]);

  React.useEffect(() => { load(true); }, [load]);

  React.useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) load(false);
    };
    const interval = window.setInterval(refreshWhenVisible, 15000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);

  if (loading) return <TrackingLoading />;

  if (error || !tracking) {
    return (
      <main className="public-tracking-page">
        <div className="public-tracking-error">
          <span className="public-tracking-error__icon"><Route /></span>
          <p>Delivery tracking</p>
          <h1>We couldn&apos;t open this route.</h1>
          <span>{error || 'Check the link and try again.'}</span>
          <div>
            <button type="button" onClick={() => load(true)}><RefreshCw size={17} /> Try again</button>
            <Link to="/"><ArrowLeft size={17} /> Back to Himaliya</Link>
          </div>
        </div>
      </main>
    );
  }

  const currentStep = stepIndexForStatus(tracking.trackingStatus);
  const copy = statusCopy[tracking.trackingStatus] || statusCopy.unassigned;
  const bottle = BOTTLE_TYPE_LABELS[tracking.bottleType] || tracking.bottleType;
  const hasLocation = tracking.riderLat !== null && tracking.riderLng !== null;

  return (
    <main className="public-tracking-page">
      <div className="public-tracking-shell">
        <header className="public-tracking-header">
          <Link to="/" className="public-tracking-brand">
            <span><Droplets size={23} /></span>
            <div><strong>Himaliya Spring</strong><small>Live delivery</small></div>
          </Link>
          <button type="button" onClick={() => load(false)} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? 'is-spinning' : ''} />
            <span>{refreshing ? 'Updating' : 'Refresh'}</span>
          </button>
        </header>

        <section className="public-tracking-hero">
          <div className="public-tracking-hero__copy">
            <span className={`public-tracking-status public-tracking-status--${tracking.trackingStatus}`}>
              <i />
              {tracking.trackingStatus === 'delivered' ? 'Route complete' : hasLocation ? 'Live route' : 'Dispatch update'}
            </span>
            <p>Order for {tracking.customerName}</p>
            <h1>{copy[0]}</h1>
            <div>{copy[1]}</div>
            <small><Clock3 size={15} /> {updateLabel(tracking.locationUpdatedAt)}</small>
          </div>
          <div className="public-tracking-hero__order">
            <Droplets />
            <span>Your order</span>
            <strong>{tracking.quantity} × {bottle}</strong>
            <small>{dateLabel(tracking.deliveryDate)}</small>
          </div>
        </section>

        <section className="public-tracking-progress" aria-label="Delivery progress">
          {steps.map((step, index) => {
            const complete = index < currentStep || tracking.trackingStatus === 'delivered';
            const current = index === currentStep && tracking.trackingStatus !== 'delivered';
            return (
              <div key={step.key} className={`${complete ? 'is-complete' : ''}${current ? ' is-current' : ''}`}>
                <span>{complete ? <Check size={15} /> : index + 1}</span>
                <strong>{step.label}</strong>
              </div>
            );
          })}
        </section>

        <div className="public-tracking-grid">
          <section className="public-tracking-map-card">
            <div className="public-tracking-section-heading">
              <div><Navigation size={19} /><span><strong>Live route map</strong><small>{hasLocation ? 'Rider and destination' : 'Destination ready'}</small></span></div>
              {hasLocation && <em>Auto-updates every 15s</em>}
            </div>
            <RiderMap
              riderLat={tracking.riderLat}
              riderLng={tracking.riderLng}
              riderName={tracking.riderName}
              destinationAddress={tracking.deliveryAddress}
            />
          </section>

          <aside className="public-tracking-details">
            <section>
              <span className="public-tracking-detail-icon"><Route size={19} /></span>
              <div>
                <small>Rider</small>
                <strong>{tracking.riderName || 'Himaliya rider'}</strong>
                <p>{tracking.riderPhone || 'Contact appears once the order is ready'}</p>
              </div>
              {tracking.riderPhone && (
                <a href={`tel:${tracking.riderPhone}`} aria-label={`Call ${tracking.riderName || 'rider'}`}>
                  <Phone size={18} />
                </a>
              )}
            </section>
            <section>
              <span className="public-tracking-detail-icon"><MapPin size={19} /></span>
              <div>
                <small>Delivering to</small>
                <strong>{tracking.deliveryAddress || 'Saved customer address'}</strong>
                <p>{dateLabel(tracking.deliveryDate)}</p>
              </div>
            </section>
            <div className="public-tracking-trust">
              <ShieldCheck size={21} />
              <span><strong>Private tracking link</strong><small>Only people with this link can view the route.</small></span>
            </div>
          </aside>
        </div>

        <footer className="public-tracking-footer">
          <span>Himaliya Spring Water · Sialkot Cantt</span>
          <span>Fresh water, tracked to your door.</span>
        </footer>
      </div>
    </main>
  );
}

PublicRiderTracking.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      trackingToken: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
