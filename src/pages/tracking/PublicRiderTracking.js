import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock3,
  Droplets,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import RiderMap from '../../components/RiderMap/RiderMap';
import { getPublicRiderTracking } from '../../services/api/customerPortalApi';
import { subscribeToPublicDeliveryTracking } from '../../services/cloud/supabaseRealtime';
import { hasStoredSessionType } from '../../services/cloud/supabaseClient';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';
import useCustomerTheme from '../customer/useCustomerTheme';
import './PublicRiderTracking.css';

const statusCopy = {
  unassigned: ['Order received', 'Your delivery address is saved from your profile. We will mark it ready shortly.'],
  assigned: ['Your order is ready', 'Your water is packed and waiting for the rider to leave.'],
  picked_up: ['Rider has your order', 'Your gallons are on the way to the address on your profile.'],
  en_route: ['Your water is on the way', 'Follow the live rider position as the delivery moves toward you.'],
  nearby: ['Your rider is nearby', 'Please keep empty gallons ready and watch for the rider.'],
  delivered: ['Delivery completed', 'Your order has arrived. Thank you for choosing Himaliya Spring Water.'],
};

function progressForStatus(status) {
  return ({
    unassigned: 8,
    assigned: 25,
    picked_up: 50,
    en_route: 70,
    nearby: 90,
    delivered: 100,
  })[status] || 8;
}

const deliverySteps = ['Ready', 'Picked up', 'Delivered'];

function activeDeliveryStep(status) {
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

function updateLabel(value, status) {
  if (status === 'delivered') return 'Delivery route closed';
  if (!value) return 'Live GPS starts when the rider begins the route';
  return `Location updated ${new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function TrackingLoading({ theme }) {
  return (
    <main
      className={`public-tracking-page public-tracking-page--${theme}${theme !== 'light' ? ' public-tracking-page--dark' : ''} public-tracking-page--loading`}
      aria-label="Loading delivery tracking"
      role="status"
    >
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

TrackingLoading.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark', 'dark-gradient']).isRequired,
};

export default function PublicRiderTracking({ match }) {
  const { theme } = useCustomerTheme();
  const [tracking, setTracking] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState('');
  const requestRunning = React.useRef(false);
  const hiddenAt = React.useRef(0);
  const reduceMotion = useReducedMotion();
  const customerSignedIn = hasStoredSessionType('customer');
  const homeTarget = customerSignedIn ? '/customer/app' : '/';
  const homeLabel = customerSignedIn ? 'Back to dashboard' : 'Back to home';

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
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else if (Date.now() - hiddenAt.current > 120000) {
        load(false);
      }
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);

  React.useEffect(() => (
    subscribeToPublicDeliveryTracking(match.params.trackingToken, (delta) => {
      setTracking((current) => {
        if (!current || !delta || delta.orderId !== current.orderId) return current;
        const changed = (value, fallback) => (value === undefined ? fallback : value);
        return {
          ...current,
          trackingStatus: changed(delta.trackingStatus, current.trackingStatus),
          riderLat: changed(delta.riderLat, current.riderLat),
          riderLng: changed(delta.riderLng, current.riderLng),
          riderHeading: changed(delta.riderHeading, current.riderHeading),
          locationUpdatedAt: changed(delta.locationUpdatedAt, current.locationUpdatedAt),
          deliveredAt: changed(delta.deliveredAt, current.deliveredAt),
        };
      });
    })
  ), [match.params.trackingToken]);

  const pageClassName = `public-tracking-page public-tracking-page--${theme}${theme !== 'light' ? ' public-tracking-page--dark' : ''}`;

  if (loading) return <TrackingLoading theme={theme} />;

  if (error || !tracking) {
    return (
      <main className={pageClassName}>
        <div className="public-tracking-error">
          <span className="public-tracking-error__icon"><Route /></span>
          <p>Delivery tracking</p>
          <h1>We couldn&apos;t open this route.</h1>
          <span>{error || 'Check the link and try again.'}</span>
          <div>
            <button type="button" onClick={() => load(true)}><RefreshCw size={17} /> Try again</button>
            <Link to={homeTarget}><ArrowLeft size={17} /> {homeLabel}</Link>
          </div>
        </div>
      </main>
    );
  }

  const progress = progressForStatus(tracking.trackingStatus);
  const activeStep = activeDeliveryStep(tracking.trackingStatus);
  const copy = statusCopy[tracking.trackingStatus] || statusCopy.unassigned;
  const bottleSummary = (Array.isArray(tracking.items) && tracking.items.length
    ? tracking.items
    : [{ bottleType: tracking.bottleType, quantity: tracking.quantity }])
    .map((item) => `${item.quantity} × ${BOTTLE_TYPE_LABELS[item.bottleType] || item.bottleType}`)
    .join(' + ');
  const hasLocation = tracking.riderLat !== null && tracking.riderLng !== null;

  return (
    <main className={pageClassName}>
      <div className="public-tracking-shell">
        <motion.header
          className="public-tracking-header"
          initial={reduceMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link to="/" className="public-tracking-brand">
            <span><Droplets size={23} /></span>
            <div><strong>Himaliya Spring</strong><small>Live delivery</small></div>
          </Link>
          <div className="public-tracking-actions">
            <Link to={homeTarget} className="public-tracking-home">
              <ArrowLeft size={17} />
              <span>{homeLabel}</span>
            </Link>
            <button type="button" onClick={() => load(false)} disabled={refreshing}>
              <RefreshCw size={17} className={refreshing ? 'is-spinning' : ''} />
              <span>{refreshing ? 'Updating' : 'Refresh'}</span>
            </button>
          </div>
        </motion.header>

        <motion.section
          className="public-tracking-hero"
          initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.992 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="public-tracking-hero__copy">
            <span className={`public-tracking-status public-tracking-status--${tracking.trackingStatus}`}>
              <i />
              {tracking.trackingStatus === 'delivered' ? 'Route complete' : hasLocation ? 'Live route' : 'Dispatch update'}
            </span>
            <p>Order for {tracking.customerName}</p>
            <h1>{copy[0]}</h1>
            <div>{copy[1]}</div>
          </div>
          <div className="public-tracking-hero__order">
            <Droplets />
            <span>Your order</span>
            <strong>{bottleSummary}</strong>
            <small>{dateLabel(tracking.deliveryDate)}</small>
          </div>
        </motion.section>

        <motion.section
          className="public-tracking-progress-card"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: reduceMotion ? 0 : 0.05 }}
        >
          <div className="public-tracking-progress-card__heading">
            <span>
              <strong>Delivery progress</strong>
              <small><Clock3 size={15} /> {updateLabel(tracking.locationUpdatedAt, tracking.trackingStatus)}</small>
            </span>
            <em>{progress}%</em>
          </div>
          <div
            className="public-tracking-progress"
            role="progressbar"
            aria-label="Delivery progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
            <i /><i /><i />
            <strong className="sr-only">Delivery is {progress}% complete</strong>
          </div>
          <ol className="public-tracking-status-steps" aria-label="Delivery status steps">
            {deliverySteps.map((step, index) => (
              <li key={step} className={`${index < activeStep ? 'is-complete' : ''}${index === activeStep ? ' is-current' : ''}`}>
                <span>{index < activeStep ? '✓' : index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.div
          className="public-tracking-grid"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.08 }}
        >
          <motion.section className="public-tracking-map-card" layout>
            <div className="public-tracking-section-heading">
              <div>
                <Navigation size={19} />
                <span>
                  <strong>Interactive delivery map</strong>
                  <small>{hasLocation ? 'Live rider and destination' : 'Destination preview'}</small>
                </span>
              </div>
              {hasLocation && <em><i /> Live GPS</em>}
            </div>
            <RiderMap
              riderLat={tracking.riderLat}
              riderLng={tracking.riderLng}
              riderName={tracking.riderName}
              destinationAddress={tracking.deliveryAddress}
              destinationId={tracking.orderId}
              simplifiedControls
              preferDark={theme !== 'light'}
            />
          </motion.section>

          <motion.aside className="public-tracking-details" layout>
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
          </motion.aside>
        </motion.div>

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
