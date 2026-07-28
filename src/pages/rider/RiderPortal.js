import React from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Bike,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Droplets,
  Layers3,
  History,
  LogOut,
  MapPin,
  MessageCircle,
  Minus,
  Moon,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  Route,
  Save,
  Settings,
  Sun,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import LoadingState from '../../components/LoadingState/LoadingState';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';
import { getStableCustomerCoordinates } from '../../utils/coordinates';
import { compressImageFile } from '../../utils/imageCompression';
import {
  getRiderOrders,
  getRiderOrder,
  getRiderProfile,
  signOutRider,
  updateRiderStop,
  updateRiderStopLocation,
  updateRiderProfile,
} from '../../services/api/riderApi';
import { subscribeToRiderWorkspace } from '../../services/cloud/supabaseRealtime';
import { groupRiderStops } from '../../utils/riderStops';
import './RiderPortal.css';

const RiderMap = React.lazy(() => import('../../components/RiderMap/RiderMap'));

const ACTIVE_STATUSES = new Set(['assigned', 'picked_up', 'en_route', 'nearby']);
const LIVE_LOCATION_STATUSES = new Set(['picked_up', 'en_route', 'nearby']);
const DELIVERY_STEPS = [
  { status: 'assigned', label: 'Pick up' },
  { status: 'picked_up', label: 'Drive' },
  { status: 'en_route', label: 'Nearby' },
  { status: 'nearby', label: 'Deliver' },
];

function statusLabel(status) {
  return ({
    assigned: 'Ready',
    picked_up: 'Picked up',
    en_route: 'Driving',
    nearby: 'Nearby',
    delivered: 'Delivered',
  })[status] || 'Ready';
}

function nextAction(status) {
  if (status === 'assigned') {
    return {
      status: 'picked_up',
      label: 'Picked up',
      help: 'Tap after the full bottles are on your vehicle.',
      icon: <Droplets size={22} />,
    };
  }
  if (status === 'picked_up') {
    return {
      status: 'en_route',
      label: 'Start driving',
      help: 'Tap when you leave for this customer.',
      icon: <Navigation size={22} />,
    };
  }
  if (status === 'en_route') {
    return {
      status: 'nearby',
      label: 'I am nearby',
      help: 'Tap when you are close to the address.',
      icon: <MapPin size={22} />,
    };
  }
  if (status === 'nearby') {
    return {
      status: 'delivered',
      label: 'Finish delivery',
      help: 'You will confirm the bottle numbers next.',
      icon: <CheckCircle2 size={22} />,
    };
  }
  return null;
}

function timeLabel(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function bottleLabel(type) {
  return BOTTLE_TYPE_LABELS[type] || type;
}

function bottleAcronym(type) {
  const normalized = String(bottleLabel(type) || '').toLowerCase();
  if (normalized.includes('19l') || normalized.includes('gallon')) return '19L';
  if (normalized.includes('small')) return 'S';
  if (normalized.includes('medium')) return 'M';
  if (normalized.includes('large')) return 'L';
  return String(bottleLabel(type) || 'H2O').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
}

function orderBottleSummary(order) {
  const items = Array.isArray(order.items) && order.items.length
    ? order.items
    : [{ bottleType: order.bottleType, quantity: order.quantity }];
  return items.map((item) => `${item.quantity} × ${bottleLabel(item.bottleType)}`).join(' + ');
}

function stopBottleSummary(stop) {
  return stop.items.map((item) => `${item.quantity} × ${bottleLabel(item.bottleType)}`).join(' + ');
}

function distanceInMeters(first, second) {
  if (!first || !second) return Infinity;
  const toRadians = (value) => value * (Math.PI / 180);
  const earthRadius = 6371000;
  const latDelta = toRadians(second.lat - first.lat);
  const lngDelta = toRadians(second.lng - first.lng);
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lngDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function RiderAvatar({ profile }) {
  if (profile && profile.photo) return <img src={profile.photo} alt="" />;
  return <span>{profile && profile.name ? profile.name.charAt(0).toUpperCase() : 'R'}</span>;
}

RiderAvatar.propTypes = { profile: PropTypes.object };
RiderAvatar.defaultProps = { profile: null };

function DeliveryProgress({ status }) {
  const activeIndex = Math.max(0, DELIVERY_STEPS.findIndex((step) => step.status === status));
  return (
    <ol className="rider-progress" aria-label="Delivery progress">
      {DELIVERY_STEPS.map((step, index) => (
        <li
          key={step.status}
          className={`${index < activeIndex ? 'is-done' : ''}${index === activeIndex ? ' is-current' : ''}`}
          aria-current={index === activeIndex ? 'step' : undefined}
        >
          <span>{index < activeIndex ? <Check size={15} /> : index + 1}</span>
          <strong>{step.label}</strong>
        </li>
      ))}
    </ol>
  );
}

DeliveryProgress.propTypes = { status: PropTypes.string.isRequired };

function BottleCountField({ label, value, max, onChange }) {
  const hasMaximum = Number.isFinite(max);
  const changeBy = (amount) => {
    const current = Number(value) || 0;
    const next = Math.max(0, current + amount);
    onChange(hasMaximum ? Math.min(max, next) : next);
  };
  return (
    <div className="rider-count-field">
      <span>{label}</span>
      <div>
        <button type="button" onClick={() => changeBy(-1)} disabled={Number(value) <= 0} aria-label={`Remove one from ${label}`}>
          <Minus />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max={hasMaximum ? max : undefined}
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            const next = Math.max(0, Number(value) || 0);
            onChange(hasMaximum ? Math.min(max, next) : next);
          }}
        />
        <button type="button" onClick={() => changeBy(1)} disabled={hasMaximum && Number(value) >= max} aria-label={`Add one to ${label}`}>
          <Plus />
        </button>
      </div>
    </div>
  );
}

BottleCountField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  max: PropTypes.number,
  onChange: PropTypes.func.isRequired,
};
BottleCountField.defaultProps = { max: null };

function DeliveryConfirmation({ stop, counts, setCounts, saving, onCancel, onConfirm }) {
  if (!stop) return null;
  const collectedValid = String(counts.collected) !== ''
    && Number(counts.collected) >= 0;
  const deliveredTotal = stop.items.reduce(
    (sum, item) => sum + Number(counts.items[item.bottleType] || 0),
    0,
  );
  const droppedValid = deliveredTotal > 0 && stop.items.every((item) => (
    Number(counts.items[item.bottleType] || 0) <= item.quantity
  ));
  return (
    <div className="rider-modal-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="rider-delivery-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="rider-modal-close" type="button" onClick={onCancel} aria-label="Close"><X /></button>
        <span className="rider-modal-icon"><Droplets /></span>
        <h2 id="delivery-confirm-title">Finish this stop</h2>
        <p>
          Confirm all bottles for <strong>{stop.customer && stop.customer.name}</strong>.
          {stop.orders.length > 1 ? ` This stop contains ${stop.orders.length} orders.` : ''}
        </p>
        <div className="rider-modal-counts">
          {stop.items.map((item) => (
            <BottleCountField
              key={item.bottleType}
              label={`Full ${bottleLabel(item.bottleType)} given`}
              value={counts.items[item.bottleType] || 0}
              max={item.quantity}
              onChange={(value) => setCounts((current) => ({
                ...current,
                items: { ...current.items, [item.bottleType]: value },
              }))}
            />
          ))}
          <BottleCountField
            label="Empty bottles taken back"
            value={counts.collected}
            onChange={(value) => setCounts((current) => ({ ...current, collected: value }))}
          />
        </div>
        <small>Empty returns may include bottles from older deliveries. Full bottles cannot exceed the grouped orders.</small>
        <div className="rider-modal-actions">
          <button type="button" className="rider-secondary-action" onClick={onCancel} disabled={saving}>Go back</button>
          <button type="button" className="rider-primary-action" onClick={onConfirm} disabled={!collectedValid || !droppedValid || saving}>
            <CheckCircle2 /> {saving ? 'Saving…' : 'Yes, delivered'}
          </button>
        </div>
      </section>
    </div>
  );
}

DeliveryConfirmation.propTypes = {
  stop: PropTypes.object,
  counts: PropTypes.shape({
    collected: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    items: PropTypes.object,
  }).isRequired,
  setCounts: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
DeliveryConfirmation.defaultProps = { stop: null };

function HistoryDetails({ order }) {
  if (!order) {
    return (
      <aside className="rider-history-detail rider-history-detail--empty">
        <History />
        <strong>Select a delivery</strong>
        <span>Its full details will appear here.</span>
      </aside>
    );
  }
  return (
      <aside className="rider-history-detail" aria-labelledby="history-detail-title">
        <span className="rider-modal-icon rider-modal-icon--success"><CheckCircle2 /></span>
        <small>Completed delivery</small>
        <h2 id="history-detail-title">{(order.customer && order.customer.name) || 'Customer'}</h2>
        <p className="rider-history-detail__date">Delivered {timeLabel(order.deliveredAt || order.createdAt)}</p>
        <div className="rider-history-detail__grid">
          <div><Droplets /><span><small>Order</small><strong>{orderBottleSummary(order)}</strong></span></div>
          <div><MapPin /><span><small>Address</small><strong>{order.deliveryAddress || 'No address recorded'}</strong></span></div>
          <div><CheckCircle2 /><span><small>Full bottles given</small><strong>{order.bottlesDroppedOff}</strong></span></div>
          <div><History /><span><small>Empty bottles taken back</small><strong>{order.bottlesCollected}</strong></span></div>
          {order.customer && order.customer.phone && (
            <div><Phone /><span><small>Customer phone</small><strong>{order.customer.phone}</strong></span></div>
          )}
        </div>
        {order.notes && <div className="rider-order-note"><strong>Customer note</strong><p>{order.notes}</p></div>}
        {order.deliveryAddress && (
          <a
            className="rider-history-route"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation /> Open address in Google Maps
          </a>
        )}
      </aside>
  );
}

HistoryDetails.propTypes = { order: PropTypes.object };
HistoryDetails.defaultProps = { order: null };

function DeliveryCelebration({ customerName }) {
  return (
    <div className="rider-delivered-celebration" role="status" aria-live="polite">
      <div className="rider-delivered-burst"><i /><i /><i /><i /><i /><i /></div>
      <span><CheckCircle2 /></span>
      <h2>Delivered!</h2>
      <p>{customerName}&apos;s bottles are recorded.</p>
    </div>
  );
}

DeliveryCelebration.propTypes = { customerName: PropTypes.string.isRequired };

function RiderPortal({ history: routerHistory }) {
  const [profile, setProfile] = React.useState(null);
  const [profileForm, setProfileForm] = React.useState({ name: '', phone: '', photo: '', theme: 'light' });
  const [profileMenu, setProfileMenu] = React.useState(false);
  const [profileEditing, setProfileEditing] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [orders, setOrders] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [tab, setTab] = React.useState('deliveries');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const [counts, setCounts] = React.useState({ collected: 0, items: {} });
  const [deliveryConfirmStop, setDeliveryConfirmStop] = React.useState(null);
  const [historyDetail, setHistoryDetail] = React.useState(null);
  const [celebration, setCelebration] = React.useState('');
  const [mapOpen, setMapOpen] = React.useState(false);
  const [locationState, setLocationState] = React.useState('idle');
  const profileEditingRef = React.useRef(false);
  const requestRunning = React.useRef(false);
  const selectedRef = React.useRef(null);
  const locationSavingRef = React.useRef(false);
  const lastLocationRef = React.useRef(null);
  const ordersRef = React.useRef([]);
  profileEditingRef.current = profileEditing;
  ordersRef.current = orders;

  const loadWorkspace = React.useCallback(async (silent = false) => {
    if (requestRunning.current) return;
    requestRunning.current = true;
    if (!silent) setLoading(true);
    try {
      const [nextProfile, nextOrders] = await Promise.all([
        getRiderProfile(),
        getRiderOrders(),
      ]);
      setProfile(nextProfile);
      if (!profileEditingRef.current) {
        setProfileForm({
          name: nextProfile.name,
          phone: nextProfile.phone,
          photo: nextProfile.photo,
          theme: nextProfile.preferences && nextProfile.preferences.theme === 'dark' ? 'dark' : 'light',
        });
      }
      setOrders(nextOrders);
      setSelectedId((current) => (
        current && nextOrders.some((order) => order.id === current && ACTIVE_STATUSES.has(order.trackingStatus))
          ? current
          : ((nextOrders.find((order) => ACTIVE_STATUSES.has(order.trackingStatus)) || {}).id || '')
      ));
    } catch (error) {
      if (!silent) toast.error(error.message || 'Could not load your rider workspace.');
    } finally {
      requestRunning.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadWorkspace(false); }, [loadWorkspace]);
  React.useEffect(() => {
    if (!profile || !profile.id) return undefined;
    return subscribeToRiderWorkspace(profile.id, {
      onOrderChange: (payload) => {
        const orderId = (payload.new && payload.new.id) || (payload.old && payload.old.id);
        if (!orderId) return;
        if (payload.eventType === 'DELETE') {
          setOrders((current) => current.filter((order) => order.id !== orderId));
          return;
        }
        getRiderOrder(orderId).then((changedOrder) => {
          if (!changedOrder) return;
          const isNew = !ordersRef.current.some((order) => order.id === changedOrder.id);
          setOrders((current) => (
            current.some((order) => order.id === changedOrder.id)
              ? current.map((order) => (order.id === changedOrder.id ? changedOrder : order))
              : [changedOrder, ...current]
          ));
          if (isNew && ACTIVE_STATUSES.has(changedOrder.trackingStatus)) {
            setSelectedId(changedOrder.id);
            toast.info(`New delivery for ${(changedOrder.customer && changedOrder.customer.name) || 'a customer'}.`);
          }
        }).catch(() => {});
      },
    });
  }, [profile]);
  React.useEffect(() => () => document.body.classList.remove('rider-dark-active'), []);

  const theme = profile && profile.preferences && profile.preferences.theme === 'dark' ? 'dark' : 'light';
  React.useEffect(() => { document.body.classList.toggle('rider-dark-active', theme === 'dark'); }, [theme]);

  const activeStops = React.useMemo(() => groupRiderStops(orders), [orders]);
  const selectedStop = activeStops.find((stop) => stop.orderIds.includes(selectedId))
    || activeStops[0]
    || null;
  const selected = selectedStop ? selectedStop.primaryOrder : null;
  selectedRef.current = selectedStop;
  React.useEffect(() => { setMapOpen(false); }, [selectedId]);
  React.useEffect(() => {
    if (!selectedStop) return;
    setCounts({
      collected: selectedStop.bottlesCollected,
      items: Object.fromEntries(selectedStop.items.map((item) => [item.bottleType, item.quantity])),
    });
  }, [selectedStop]);

  const historyOrders = orders.filter((order) => order.trackingStatus === 'delivered')
    .sort((a, b) => new Date(b.deliveredAt || b.createdAt) - new Date(a.deliveredAt || a.createdAt));
  React.useEffect(() => {
    if (tab !== 'history') return;
    const completed = orders.filter((order) => order.trackingStatus === 'delivered')
      .sort((a, b) => new Date(b.deliveredAt || b.createdAt) - new Date(a.deliveredAt || a.createdAt));
    setHistoryDetail((current) => (
      (current && completed.find((order) => order.id === current.id))
      || completed[0]
      || null
    ));
  }, [orders, tab]);
  const selectedStopNumber = activeStops.findIndex((stop) => stop.key === (selectedStop && selectedStop.key)) + 1;
  const mapStops = activeStops.map((stop) => {
    const order = stop.primaryOrder;
    const coords = getStableCustomerCoordinates({
      id: order.customerId,
      address: order.deliveryAddress,
      name: order.customer && order.customer.name,
    });
    return {
      id: stop.key,
      label: (stop.customer && stop.customer.name) || 'Customer',
      address: stop.deliveryAddress,
      lat: coords.lat,
      lng: coords.lng,
      selected: stop.key === (selectedStop && selectedStop.key),
    };
  });

  const saveOrder = async (update, successMessage) => {
    if (!selectedStop || updating) return null;
    setUpdating(true);
    try {
      const changedOrders = await updateRiderStop(selectedStop, {
        ...update,
        bottlesCollected: Math.max(0, Number(counts.collected) || 0),
      });
      const changedById = new Map(changedOrders.map((order) => [order.id, order]));
      setOrders((current) => current.map((order) => changedById.get(order.id) || order));
      toast.success(successMessage);
      return changedOrders;
    } catch (error) {
      toast.error(error.message || 'Could not save the delivery update.');
      return null;
    } finally {
      setUpdating(false);
    }
  };

  const openDeliveryConfirmation = () => {
    if (!selectedStop) return;
    setCounts({
      collected: selectedStop.bottlesCollected,
      items: Object.fromEntries(selectedStop.items.map((item) => [item.bottleType, item.quantity])),
    });
    setDeliveryConfirmStop(selectedStop);
  };

  const completeDelivery = async () => {
    if (!selectedStop) return;
    const deliveredItems = selectedStop.items.map((item) => ({
      bottleType: item.bottleType,
      quantity: Number(counts.items[item.bottleType] || 0),
    })).filter((item) => item.quantity > 0);
    const completed = await saveOrder(
      { trackingStatus: 'delivered', deliveredItems },
      'Delivery completed. Dispatch has been notified.',
    );
    if (!completed) return;
    const customerName = (selectedStop.customer && selectedStop.customer.name) || 'Customer';
    const completedStopKey = selectedStop.key;
    setDeliveryConfirmStop(null);
    setCelebration(customerName);
    window.setTimeout(() => setCelebration(''), 2400);
    const nextActive = activeStops.find((stop) => stop.key !== completedStopKey);
    setSelectedId(nextActive ? nextActive.primaryOrder.id : '');
  };

  const publishLocation = React.useCallback(async (position, announce = false) => {
    const stop = selectedRef.current;
    if (!stop || locationSavingRef.current) return;
    const point = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: Date.now(),
    };
    const previous = lastLocationRef.current;
    const elapsed = previous ? point.timestamp - previous.timestamp : Infinity;
    const moved = distanceInMeters(previous, point);
    if (!announce && elapsed < 30000) return;
    if (!announce && elapsed < 120000 && moved < 50) return;

    locationSavingRef.current = true;
    setLocationState('sharing');
    try {
      const next = await updateRiderStopLocation(stop, {
        riderLat: point.lat,
        riderLng: point.lng,
        riderHeading: position.coords.heading,
      });
      lastLocationRef.current = point;
      setOrders((current) => current.map((item) => (
        next.orderIds.includes(item.id) ? {
          ...item,
          riderLat: next.riderLat,
          riderLng: next.riderLng,
          riderHeading: next.riderHeading,
        } : item
      )));
      setLocationState('live');
      if (announce) toast.success('Live location is on.');
    } catch (error) {
      setLocationState('error');
      if (announce) toast.error(error.message || 'Could not share your location.');
    } finally {
      locationSavingRef.current = false;
    }
  }, []);

  const shareLocation = React.useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState('error');
      toast.error('Location sharing is unavailable on this device.');
      return;
    }
    setLocationState('starting');
    navigator.geolocation.getCurrentPosition(
      (position) => publishLocation(position, true),
      (error) => {
        setLocationState('error');
        toast.error(error.message || 'Allow location access to share the live route.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  }, [publishLocation]);

  const selectedTrackingStatus = selectedStop ? selectedStop.trackingStatus : '';
  const shouldShareLocation = Boolean(
    selectedStop && tab === 'deliveries' && LIVE_LOCATION_STATUSES.has(selectedTrackingStatus),
  );
  React.useEffect(() => {
    if (!shouldShareLocation) {
      setLocationState(selectedId ? 'paused' : 'idle');
      return undefined;
    }
    if (!navigator.geolocation) {
      setLocationState('error');
      return undefined;
    }

    setLocationState('starting');
    const watchId = navigator.geolocation.watchPosition(
      (position) => publishLocation(position),
      () => setLocationState('error'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [publishLocation, selectedId, shouldShareLocation]);

  const saveProfile = async (event) => {
    if (event) event.preventDefault();
    if (!profileForm.name.trim() || savingProfile) return;
    setSavingProfile(true);
    try {
      const updated = await updateRiderProfile(profileForm);
      setProfile(updated);
      setProfileEditing(false);
      toast.success('Profile settings updated.');
    } catch (error) {
      toast.error(error.message || 'Could not update your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const choosePhoto = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const photo = await compressImageFile(file, { maxBytes: 220 * 1024, maxDimension: 720 });
      setProfileForm((current) => ({ ...current, photo }));
      setProfileEditing(true);
    } catch (error) {
      toast.error(error.message || 'Could not prepare that photo.');
    }
    event.target.value = '';
  };

  const toggleTheme = async () => {
    if (!profile) return;
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    try {
      const updated = await updateRiderProfile({ ...profile, theme: nextTheme });
      setProfile(updated);
      setProfileForm((current) => ({ ...current, theme: nextTheme }));
    } catch (error) {
      toast.error(error.message || 'Could not change the theme.');
    }
  };

  const refreshWorkspace = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadWorkspace(true);
    setRefreshing(false);
  };

  const logout = async () => {
    await signOutRider();
    routerHistory.replace('/login');
  };

  if (loading) return <LoadingState label="Preparing today’s deliveries..." variant="rider-portal" />;
  const action = selectedStop ? nextAction(selectedStop.trackingStatus) : null;
  const activeBottleTotal = activeStops.reduce((sum, stop) => sum + stop.totalQuantity, 0);

  return (
    <main className={`rider-app rider-theme--${theme}`}>
      <header className="rider-app-header">
        <div className="rider-app-brand">
          <span><Bike /></span>
          <div><strong>Rider</strong><small>{profile ? profile.name : 'Delivery workspace'}</small></div>
        </div>
        <div className="rider-header-actions">
          <button type="button" className="rider-header-refresh" onClick={refreshWorkspace} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'is-spinning' : ''} />
            <span>Refresh</span>
          </button>
          <div className="rider-account">
            <button
              type="button"
              className="rider-profile-button"
              onClick={() => setProfileMenu((value) => !value)}
              aria-label="Open rider profile menu"
              aria-expanded={profileMenu}
            >
              <RiderAvatar profile={profile} />
            </button>
            {profileMenu && (
              <div className="rider-account-menu">
                <div><RiderAvatar profile={profile} /><span><strong>{profile && profile.name}</strong><small>{profile && profile.email}</small></span></div>
                <button type="button" onClick={() => { setTab('profile'); setProfileMenu(false); }}><Settings /> Profile and settings</button>
                <button type="button" onClick={toggleTheme}>{theme === 'dark' ? <Sun /> : <Moon />} {theme === 'dark' ? 'Use light mode' : 'Use dark mode'}</button>
                <button type="button" onClick={logout}><LogOut /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="rider-tabs" aria-label="Rider workspace">
        <button type="button" className={tab === 'deliveries' ? 'is-active' : ''} onClick={() => setTab('deliveries')}><Truck /> Today <em>{activeStops.length}</em></button>
        <button type="button" className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}><History /> History</button>
        <button type="button" className={tab === 'profile' ? 'is-active' : ''} onClick={() => setTab('profile')}><UserRound /> Me</button>
      </nav>

      <div key={tab} className="rider-tab-view">
      {tab === 'deliveries' && (
        <>
          <section className="rider-day-summary" aria-label="Today route summary">
            <div>
              <small>Today&apos;s route</small>
              <strong>{activeStops.length ? `${activeStops.length} stops left` : 'Route complete'}</strong>
              <span>Repeat orders at one address are grouped into one stop.</span>
            </div>
            <dl>
              <div><dt>Stops</dt><dd>{activeStops.length}</dd></div>
              <div><dt>Bottles</dt><dd>{activeBottleTotal}</dd></div>
              <div><dt>Updates</dt><dd><i /> Live</dd></div>
            </dl>
          </section>
          <div className="rider-workspace">
          <aside className="rider-order-list">
            <div className="rider-section-title">
              <div><span>Next addresses</span><h1>{activeStops.length} stops</h1></div>
              <Route />
            </div>
            <div className="rider-order-scroll">
              {activeStops.map((stop, index) => (
                <button
                  type="button"
                  key={stop.key}
                  className={`rider-order-card${stop.key === (selectedStop && selectedStop.key) ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(stop.primaryOrder.id)}
                  aria-pressed={stop.key === (selectedStop && selectedStop.key)}
                >
                  <span className="rider-order-number">{index + 1}</span>
                  <span>
                    <strong>{(stop.customer && stop.customer.name) || 'Customer'}</strong>
                  </span>
                  <i className={`rider-status rider-status--${stop.trackingStatus}`}>{statusLabel(stop.trackingStatus)}</i>
                  <ChevronRight />
                </button>
              ))}
              {!activeStops.length && (
                <div className="rider-empty">
                  <CheckCircle2 />
                  <strong>All deliveries are done</strong>
                  <span>Open History to see completed work.</span>
                </div>
              )}
            </div>
          </aside>

          <section className="rider-route-panel">
            {!selectedStop ? (
              <div className="rider-empty rider-empty--large">
                <Route />
                <strong>Choose a stop</strong>
                <span>Tap a customer from the list.</span>
              </div>
            ) : (
              <>
                <header className="rider-route-heading">
                  <div>
                    <span>Stop {selectedStopNumber} of {activeStops.length}</span>
                    <h2>{selectedStop.customer && selectedStop.customer.name}</h2>
                    <p>{stopBottleSummary(selectedStop)}</p>
                    {selectedStop.orders.length > 1 && (
                      <em className="rider-group-pill"><Layers3 /> {selectedStop.orders.length} orders at this address</em>
                    )}
                  </div>
                  <div className="rider-route-statuses" aria-live="polite">
                    <i className={`rider-status rider-status--${selectedStop.trackingStatus}`}>{statusLabel(selectedStop.trackingStatus)}</i>
                    <button
                      type="button"
                      className={`rider-location-pill rider-location-pill--${locationState}`}
                      onClick={locationState === 'error' ? shareLocation : undefined}
                      disabled={locationState !== 'error'}
                      aria-label={locationState === 'error' ? 'Location needs attention. Retry GPS.' : undefined}
                    >
                      <i />
                      <MapPin />
                      <span>
                        {locationState === 'live' ? 'Location live' : locationState === 'error' ? 'Retry GPS' : locationState === 'paused' ? 'GPS after pickup' : 'Starting GPS'}
                      </span>
                    </button>
                  </div>
                </header>

                <DeliveryProgress status={selectedStop.trackingStatus} />

                {action && (
                  <section className="rider-next-action">
                    <div className="rider-next-action__icon">{action.icon}</div>
                    <div>
                      <span>Next step</span>
                      <h3>{action.label}</h3>
                      <p>{action.help}</p>
                    </div>
                    <div className="rider-next-action__contacts" aria-label="Customer contact shortcuts">
                      {selectedStop.customer && selectedStop.customer.phone ? (
                        <>
                          <a href={`tel:${selectedStop.customer.phone}`} aria-label="Call customer" title="Call customer"><Phone /></a>
                          <a href={`sms:${selectedStop.customer.phone}`} aria-label="Text customer" title="SMS customer"><MessageCircle /></a>
                          <a
                            href={`https://wa.me/${String(selectedStop.customer.phone).replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="WhatsApp customer"
                            title="WhatsApp customer"
                            className="rider-contact-wa"
                          >
                            <MessageCircle />
                          </a>
                        </>
                      ) : (
                        <>
                          <span aria-label="Customer phone unavailable"><Phone /></span>
                          <span aria-label="Customer messaging unavailable"><MessageCircle /></span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      className="rider-primary-action"
                      disabled={updating}
                      onClick={() => (
                        action.status === 'delivered'
                          ? openDeliveryConfirmation()
                          : saveOrder({ trackingStatus: action.status }, `${action.label} saved.`)
                      )}
                    >
                      <span className="rider-primary-action__label">{updating ? 'Saving…' : action.label}</span>
                      <span className="rider-primary-action__orb">{action.icon}</span>
                    </button>
                  </section>
                )}

                {selectedStop.orders && selectedStop.orders.length > 0 && (
                  <section className={`rider-order-breakdown-card${selectedStop.orders.length > 1 ? ' is-multi-order' : ''}`}>
                    <header className="rider-breakdown-header">
                      <div className="rider-breakdown-title">
                        <span className="rider-breakdown-title__icon" aria-hidden="true"><Layers3 size={17} /></span>
                        <div>
                          <small>Order breakdown</small>
                          <strong>{selectedStop.orders.length} {selectedStop.orders.length === 1 ? 'order' : 'orders'} at this stop</strong>
                        </div>
                      </div>
                      {selectedStop.orders.length > 1 && (
                        <span className="rider-breakdown-badge">
                          <Layers3 size={13} /> {selectedStop.orders.length} grouped
                        </span>
                      )}
                    </header>
                    <div className="rider-breakdown-list">
                      {selectedStop.orders.map((subOrder, subIdx) => (
                        <article key={subOrder.id || subIdx} className="rider-suborder-item">
                          <div className="rider-suborder-top">
                            <span className="rider-suborder-index">{subIdx + 1}</span>
                            <div className="rider-suborder-meta">
                              <span className="rider-suborder-id">Order #{String(subOrder.id || '').slice(-6).toUpperCase() || (subIdx + 1)}</span>
                              <time className="rider-suborder-time">{timeLabel(subOrder.createdAt || subOrder.deliveryDate)}</time>
                            </div>
                          </div>
                          <div className="rider-suborder-summary">
                            <Droplets size={15} aria-hidden="true" />
                            <span>{orderBottleSummary(subOrder)}</span>
                          </div>
                          {subOrder.notes ? (
                            <p className="rider-suborder-note">
                              <small>Customer note</small>
                              {subOrder.notes}
                            </p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rider-stop-load" aria-label="Bottle load for this stop">
                  <header><span><Droplets /></span><div><small>Items</small><strong>{selectedStop.totalQuantity} bottles</strong></div></header>
                  <div>
                    {selectedStop.items.map((item) => {
                      const code = bottleAcronym(item.bottleType);
                      return (
                        <p
                          key={item.bottleType}
                          className={`rider-item-chip rider-item-chip--${code.toLowerCase()}`}
                          aria-label={`${item.quantity} ${bottleLabel(item.bottleType)}`}
                        >
                          <span>{code}</span><strong>×{item.quantity}</strong>
                        </p>
                      );
                    })}
                  </div>
                </section>

                <p className="rider-deliver-label">Deliver to</p>
                <div className="rider-contact-grid rider-contact-grid--single">
                  <div>
                    <MapPin />
                    <span><strong>{selectedStop.deliveryAddress || 'Address missing'}</strong></span>
                    {selectedStop.deliveryAddress && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedStop.deliveryAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Navigation /> Open route
                      </a>
                    )}
                  </div>
                </div>

                <details
                  className="rider-map-details"
                  open={mapOpen}
                  onToggle={(event) => setMapOpen(event.currentTarget.open)}
                >
                  <summary>
                    <Navigation />
                    <span><strong>Map and directions</strong><small>Open the route only when you need it</small></span>
                    <ChevronDown />
                  </summary>
                  {mapOpen && (
                    <div className="rider-map-card">
                      <React.Suspense fallback={<div className="rider-map-loading"><LoadingState label="Opening map..." variant="form" compact /></div>}>
                        <RiderMap
                          riderLat={selected.riderLat}
                          riderLng={selected.riderLng}
                          riderName={profile && profile.name}
                          stops={mapStops}
                          className="rider-full-map"
                        />
                      </React.Suspense>
                      <div className="rider-map-actions">
                        <span><i /> Location updates automatically</span>
                        <button type="button" onClick={shareLocation}><MapPin /> Refresh GPS</button>
                      </div>
                    </div>
                  )}
                </details>

                {selectedStop.notes.length > 0 && <div className="rider-order-note"><strong>Customer note</strong><p>{selectedStop.notes.join('\n')}</p></div>}

              </>
            )}
          </section>
          </div>
        </>
      )}

      {tab === 'history' && (
        <section className="rider-history-page">
          <header>
            <span><History /></span>
            <div><small>Finished</small><h1>Delivery history</h1><p>Tap any delivery to see all details.</p></div>
          </header>
          {historyOrders.length ? (
            <div className="rider-history-layout">
              <div className="rider-history-grid" aria-label="Completed deliveries">
                {historyOrders.map((order) => (
                  <button
                    type="button"
                    className={`rider-history-card${historyDetail && historyDetail.id === order.id ? ' is-selected' : ''}`}
                    key={order.id}
                    onClick={() => setHistoryDetail(order)}
                    aria-pressed={Boolean(historyDetail && historyDetail.id === order.id)}
                  >
                    <div className="rider-history-check"><CheckCircle2 /></div>
                    <div className="rider-history-main">
                      <span>{timeLabel(order.deliveredAt || order.createdAt)}</span>
                      <h2>{order.customer && order.customer.name}</h2>
                      <p>{orderBottleSummary(order)}</p>
                      <strong>View details</strong>
                    </div>
                    <ChevronRight />
                  </button>
                ))}
              </div>
              <HistoryDetails order={historyDetail} />
            </div>
          ) : (
            <div className="rider-empty rider-empty--large">
              <Clock3 />
              <strong>No completed deliveries yet</strong>
              <span>Your finished deliveries will appear here.</span>
            </div>
          )}
        </section>
      )}

      {tab === 'profile' && (
        <section className="rider-profile-page">
          <header>
            <span><UserRound /></span>
            <div><small>My account</small><h1>Profile and settings</h1><p>Change your photo, phone number, or screen color.</p></div>
          </header>
          <form className="rider-profile-layout" onSubmit={saveProfile}>
            <section className="rider-profile-card rider-profile-card--identity">
              <div className="rider-profile-photo">
                <div className="rider-profile-photo__frame">
                  <RiderAvatar profile={{ ...profile, photo: profileForm.photo, name: profileForm.name }} />
                </div>
                <div className="rider-profile-photo__meta">
                  <strong>{profileForm.name || (profile && profile.name) || 'Rider'}</strong>
                  <small>{profile && profile.email}</small>
                </div>
                <label className="rider-profile-photo__upload">
                  <Camera /> Change photo
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
                </label>
                {profileForm.photo && (
                  <button type="button" className="rider-profile-photo__remove" onClick={() => { setProfileForm((current) => ({ ...current, photo: '' })); setProfileEditing(true); }}>
                    Remove photo
                  </button>
                )}
              </div>
            </section>
            <section className="rider-profile-card rider-profile-card--details">
              <header className="rider-profile-card__header">
                <span><UserRound size={18} /></span>
                <div><small>Personal info</small><strong>Account details</strong></div>
              </header>
              <div className="rider-profile-fields">
                <label>Full name <span>*</span><input value={profileForm.name} onChange={(event) => { setProfileForm((current) => ({ ...current, name: event.target.value })); setProfileEditing(true); }} required /></label>
                <label>Email address<input value={profile ? profile.email : ''} disabled /></label>
                <label>Phone number<input value={profileForm.phone} inputMode="tel" onChange={(event) => { setProfileForm((current) => ({ ...current, phone: event.target.value })); setProfileEditing(true); }} /></label>
              </div>
            </section>
            <section className="rider-profile-card rider-profile-card--appearance">
              <header className="rider-profile-card__header">
                <span><Moon size={18} /></span>
                <div><small>Appearance</small><strong>Screen color</strong></div>
              </header>
              <div className="rider-theme-toggle">
                <button type="button" className={profileForm.theme === 'light' ? 'is-active' : ''} onClick={() => { setProfileForm((current) => ({ ...current, theme: 'light' })); setProfileEditing(true); }}><Sun /> Light mode</button>
                <button type="button" className={profileForm.theme === 'dark' ? 'is-active' : ''} onClick={() => { setProfileForm((current) => ({ ...current, theme: 'dark' })); setProfileEditing(true); }}><Moon /> Dark mode</button>
              </div>
            </section>
            <button className="rider-primary-action rider-profile-save" type="submit" disabled={!profileForm.name.trim() || savingProfile}>
              <Save /> {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>
      )}
      </div>

      <DeliveryConfirmation
        stop={deliveryConfirmStop}
        counts={counts}
        setCounts={setCounts}
        saving={updating}
        onCancel={() => setDeliveryConfirmStop(null)}
        onConfirm={completeDelivery}
      />
      {celebration && <DeliveryCelebration customerName={celebration} />}
    </main>
  );
}

RiderPortal.propTypes = {
  history: PropTypes.shape({ replace: PropTypes.func.isRequired }).isRequired,
};

export default withRouter(RiderPortal);
