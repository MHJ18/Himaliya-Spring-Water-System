import React from 'react';
import {
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import LoadingState from '../../components/LoadingState/LoadingState';
import RiderMap from '../../components/RiderMap/RiderMap';
import {
  getAdminCustomerOrders,
  updateAdminRiderTracking,
} from '../../services/api/customerPortalApi';
import { getBottlePrices } from '../../services/api/bottlePriceApi';
import { BOTTLE_TYPE_LABELS } from '../../data/constants';
import { useSettings } from '../../context/SettingsContext';
import { getStableCustomerCoordinates } from '../../utils/coordinates';
import {
  DELIVERY_STAGE,
  deliveryStage,
  filterDeliveryRouteOrders,
  isActiveDeliveryRouteOrder,
  trackingStatusForLocation,
} from '../../utils/riderDelivery';
import './RiderTracking.css';

const FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'in_transit', label: 'On route' },
  { value: 'complete', label: 'Completed' },
];

const PROGRESS_STEPS = [
  { stage: DELIVERY_STAGE.accepted, label: 'Accepted' },
  { stage: DELIVERY_STAGE.ready, label: 'Ready' },
  { stage: DELIVERY_STAGE.inTransit, label: 'On route' },
  { stage: DELIVERY_STAGE.delivered, label: 'Delivered' },
];

function bottleLabel(value) {
  return BOTTLE_TYPE_LABELS[value] || value;
}

function orderAddress(order) {
  return (order.deliveryAddress || (order.profile && order.profile.address) || '').trim();
}

function stageLabel(stage) {
  if (stage === DELIVERY_STAGE.ready) return 'Ready for pickup';
  if (stage === DELIVERY_STAGE.inTransit) return 'On route';
  if (stage === DELIVERY_STAGE.delivered) return 'Delivered';
  return 'Accepted';
}

function timeLabel(value) {
  if (!value) return 'Just accepted';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function matchesFilter(order, filter) {
  const stage = deliveryStage(order);
  if (filter === 'preparing') {
    return [DELIVERY_STAGE.accepted, DELIVERY_STAGE.ready].includes(stage);
  }
  if (filter === 'in_transit') return stage === DELIVERY_STAGE.inTransit;
  if (filter === 'complete') return stage === DELIVERY_STAGE.delivered;
  return stage !== DELIVERY_STAGE.delivered;
}

function matchesSearch(order, query) {
  const haystack = [
    order.id,
    order.profile && order.profile.name,
    order.profile && order.profile.phone,
    orderAddress(order),
    bottleLabel(order.bottleType),
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

export default function RiderTracking() {
  const { settings } = useSettings();
  const [orders, setOrders] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState('');
  const [filter, setFilter] = React.useState('active');
  const [search, setSearch] = React.useState('');
  const [locating, setLocating] = React.useState(false);
  const [liveSharing, setLiveSharing] = React.useState(false);

  const riderName = React.useMemo(
    () => (settings.businessName ? `${settings.businessName.split(' ')[0]} Rider` : 'Himaliya Rider'),
    [settings.businessName],
  );
  const riderPhone = settings.businessPhone || '';

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const prices = await getBottlePrices({});
      const allOrders = await getAdminCustomerOrders(prices);
      const routeOrders = filterDeliveryRouteOrders(allOrders);
      setOrders(routeOrders);
      setSelectedId((current) => {
        if (current && routeOrders.some((order) => order.id === current)) return current;
        const firstActive = routeOrders.find(isActiveDeliveryRouteOrder);
        return (firstActive || routeOrders[0] || {}).id || '';
      });
    } catch (error) {
      if (!silent) toast.error(error.message || 'Could not load delivery routes.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(false); }, [load]);

  React.useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) load(true);
    };
    const interval = window.setInterval(refreshWhenVisible, 20000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);

  React.useEffect(() => {
    setLiveSharing(false);
  }, [selectedId]);

  const visibleOrders = React.useMemo(() => (
    orders.filter((order) => matchesFilter(order, filter) && matchesSearch(order, search))
  ), [filter, orders, search]);

  React.useEffect(() => {
    if (visibleOrders.some((order) => order.id === selectedId)) return;
    setSelectedId((visibleOrders[0] || {}).id || '');
  }, [selectedId, visibleOrders]);

  const selectedOrder = React.useMemo(
    () => orders.find((order) => order.id === selectedId) || null,
    [orders, selectedId],
  );

  const counts = React.useMemo(() => ({
    accepted: orders.filter((order) => deliveryStage(order) === DELIVERY_STAGE.accepted).length,
    ready: orders.filter((order) => deliveryStage(order) === DELIVERY_STAGE.ready).length,
    inTransit: orders.filter((order) => deliveryStage(order) === DELIVERY_STAGE.inTransit).length,
    delivered: orders.filter((order) => deliveryStage(order) === DELIVERY_STAGE.delivered).length,
  }), [orders]);

  const filterCounts = React.useMemo(() => ({
    active: counts.accepted + counts.ready + counts.inTransit,
    preparing: counts.accepted + counts.ready,
    in_transit: counts.inTransit,
    complete: counts.delivered,
  }), [counts]);

  const mapStops = React.useMemo(() => {
    let mapOrders = orders.filter(isActiveDeliveryRouteOrder);
    if (selectedOrder && deliveryStage(selectedOrder) === DELIVERY_STAGE.delivered) {
      mapOrders = [selectedOrder];
    }
    return mapOrders.map((order) => {
      const address = orderAddress(order);
      const coords = getStableCustomerCoordinates({
        id: (order.profile && order.profile.id) || order.id,
        address,
        name: order.profile && order.profile.name,
      });
      return {
        id: order.id,
        label: (order.profile && order.profile.name) || 'Customer',
        address: address || 'Profile address missing',
        lat: coords.lat,
        lng: coords.lng,
        selected: order.id === selectedId,
      };
    });
  }, [orders, selectedId, selectedOrder]);

  const selectedOrderRef = React.useRef(selectedOrder);
  React.useEffect(() => { selectedOrderRef.current = selectedOrder; }, [selectedOrder]);

  const advanceTracking = React.useCallback(async (order, trackingStatus, extras = {}) => {
    setUpdating(order.id);
    try {
      const updated = await updateAdminRiderTracking(order, {
        riderName: order.riderName || riderName,
        riderPhone: order.riderPhone || riderPhone,
        trackingStatus,
        riderLat: extras.riderLat !== undefined && extras.riderLat !== null
          ? extras.riderLat
          : order.riderLat,
        riderLng: extras.riderLng !== undefined && extras.riderLng !== null
          ? extras.riderLng
          : order.riderLng,
        riderHeading: extras.riderHeading !== undefined && extras.riderHeading !== null
          ? extras.riderHeading
          : order.riderHeading,
      });
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedId(updated.id);
      return updated;
    } catch (error) {
      toast.error(error.message || 'Could not update this delivery.');
      throw error;
    } finally {
      setUpdating('');
    }
  }, [riderName, riderPhone]);

  const markReady = async (order) => {
    try {
      await advanceTracking(order, 'assigned');
      toast.success(`${(order.profile && order.profile.name) || 'Order'} is ready for pickup.`);
    } catch {
      // Error toast is handled by advanceTracking.
    }
  };

  const markPickedUp = async (order) => {
    try {
      await advanceTracking(order, 'picked_up');
      toast.success('Pickup confirmed. The customer can now follow the route.');
    } catch {
      // Error toast is handled by advanceTracking.
    }
  };

  const markNearby = async (order) => {
    try {
      await advanceTracking(order, 'nearby');
      toast.success('The customer has been told that the rider is nearby.');
    } catch {
      // Error toast is handled by advanceTracking.
    }
  };

  const markDelivered = async (order) => {
    if (settings.requireDeliveryConfirmation) {
      const confirmed = window.confirm(
        `Confirm delivery for ${(order.profile && order.profile.name) || 'this customer'}?`,
      );
      if (!confirmed) return;
    }
    try {
      await advanceTracking(order, 'delivered');
      setLiveSharing(false);
      toast.success('Delivery completed. The customer has been notified.');
    } catch {
      // Error toast is handled by advanceTracking.
    }
  };

  const publishLocation = React.useCallback(async (position) => {
    const order = selectedOrderRef.current;
    if (!order || deliveryStage(order) === DELIVERY_STAGE.delivered) return null;
    return advanceTracking(order, trackingStatusForLocation(order), {
      riderLat: position.coords.latitude.toFixed(6),
      riderLng: position.coords.longitude.toFixed(6),
      riderHeading: Number.isFinite(position.coords.heading)
        ? Math.round(position.coords.heading)
        : order.riderHeading,
    });
  }, [advanceTracking]);

  const shareDeviceLocation = () => {
    if (!selectedOrder) return;
    if (!navigator.geolocation) {
      toast.error('Location sharing is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await publishLocation(position);
          toast.success('Rider location shared with the customer.');
        } catch {
          // Error toast is handled by advanceTracking.
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        toast.error(error.message || 'Could not access this device location.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  };

  React.useEffect(() => {
    if (!liveSharing || !selectedOrder || deliveryStage(selectedOrder) === DELIVERY_STAGE.delivered) {
      return undefined;
    }
    if (!navigator.geolocation) {
      setLiveSharing(false);
      toast.error('Live location is not available in this browser.');
      return undefined;
    }

    let canceled = false;
    let inflight = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (canceled || inflight) return;
        inflight = true;
        publishLocation(position)
          .catch(() => { if (!canceled) setLiveSharing(false); })
          .finally(() => { inflight = false; });
      },
      (error) => {
        if (canceled) return;
        setLiveSharing(false);
        toast.error(error.message || 'Live location stopped.');
      },
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 },
    );

    return () => {
      canceled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [liveSharing, publishLocation, selectedOrder]);

  const copyTrackingLink = async () => {
    if (!selectedOrder || !selectedOrder.trackingToken) {
      toast.error('Tracking link is not ready for this order yet.');
      return;
    }
    const link = `${window.location.origin}/track/${selectedOrder.trackingToken}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Customer tracking link copied.');
    } catch {
      window.prompt('Copy the customer tracking link:', link);
    }
  };

  const selectedStage = deliveryStage(selectedOrder);
  const busy = Boolean(updating);
  const currentStep = PROGRESS_STEPS.findIndex((step) => step.stage === selectedStage);
  let primaryAction = null;
  if (selectedOrder && selectedStage === DELIVERY_STAGE.accepted) {
    primaryAction = {
      label: 'Mark ready for pickup',
      icon: <Inventory2RoundedIcon />,
      action: () => markReady(selectedOrder),
    };
  } else if (selectedOrder && selectedStage === DELIVERY_STAGE.ready) {
    primaryAction = {
      label: 'Confirm rider pickup',
      icon: <LocalShippingRoundedIcon />,
      action: () => markPickedUp(selectedOrder),
    };
  } else if (selectedOrder && selectedStage === DELIVERY_STAGE.inTransit) {
    primaryAction = {
      label: 'Complete delivery',
      icon: <CheckCircleRoundedIcon />,
      action: () => markDelivered(selectedOrder),
    };
  }

  return (
    <PageShell
      title="Delivery routes"
      subtitle="Accepted customer orders move here automatically for rider dispatch and live tracking."
      actions={(
        <Button
          variant="outlined"
          startIcon={<RefreshRoundedIcon />}
          onClick={() => load(false)}
          disabled={loading}
        >
          Refresh routes
        </Button>
      )}
    >
      {loading ? (
        <LoadingState label="Loading delivery routes..." variant="form" compact />
      ) : (
        <div className="rider-dispatch">
          <section className="rider-dispatch__overview" aria-label="Route overview">
            <article className="rider-dispatch__metric rider-dispatch__metric--accepted">
              <span><Inventory2RoundedIcon /></span>
              <div><small>Accepted</small><strong>{counts.accepted}</strong></div>
            </article>
            <article className="rider-dispatch__metric rider-dispatch__metric--ready">
              <span><RouteRoundedIcon /></span>
              <div><small>Ready for pickup</small><strong>{counts.ready}</strong></div>
            </article>
            <article className="rider-dispatch__metric rider-dispatch__metric--moving">
              <span><NearMeRoundedIcon /></span>
              <div><small>On route</small><strong>{counts.inTransit}</strong></div>
            </article>
            <article className="rider-dispatch__metric rider-dispatch__metric--done">
              <span><CheckCircleRoundedIcon /></span>
              <div><small>Completed</small><strong>{counts.delivered}</strong></div>
            </article>
          </section>

          <div className="rider-dispatch__workspace">
            <aside className="route-queue">
              <div className="route-queue__heading">
                <div>
                  <span>Dispatch queue</span>
                  <h2>{filterCounts.active} active routes</h2>
                </div>
                <span className="route-queue__sync"><i /> Auto-refresh</span>
              </div>

              <label className="route-queue__search">
                <SearchRoundedIcon />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customer or address"
                  aria-label="Search delivery routes"
                />
              </label>

              <div className="route-queue__filters" role="tablist" aria-label="Filter delivery routes">
                {FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.value}
                    className={filter === item.value ? 'is-active' : ''}
                    onClick={() => setFilter(item.value)}
                  >
                    <span>{item.label}</span>
                    <em>{filterCounts[item.value]}</em>
                  </button>
                ))}
              </div>

              <div className="route-queue__list" aria-live="polite">
                {visibleOrders.map((order, index) => {
                  const stage = deliveryStage(order);
                  const address = orderAddress(order);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`route-card${order.id === selectedId ? ' is-selected' : ''}`}
                      onClick={() => setSelectedId(order.id)}
                    >
                      <span className="route-card__number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="route-card__content">
                        <span className="route-card__topline">
                          <strong>{(order.profile && order.profile.name) || 'Customer'}</strong>
                          <em className={`route-status route-status--${stage}`}>{stageLabel(stage)}</em>
                        </span>
                        <span>{order.quantity} × {bottleLabel(order.bottleType)}</span>
                        <small><PlaceRoundedIcon /> {address || 'No profile address'}</small>
                      </span>
                      <ArrowForwardRoundedIcon className="route-card__arrow" />
                    </button>
                  );
                })}
                {!visibleOrders.length && (
                  <div className="route-queue__empty">
                    <span><RouteRoundedIcon /></span>
                    <strong>No routes in this view</strong>
                    <p>
                      {filter === 'active'
                        ? 'Accepted orders will appear here automatically.'
                        : 'Try another route status or clear your search.'}
                    </p>
                  </div>
                )}
              </div>
            </aside>

            <section className="route-console">
              {!selectedOrder ? (
                <div className="route-console__empty">
                  <span><LocalShippingRoundedIcon /></span>
                  <h2>Select a delivery route</h2>
                  <p>Choose an accepted order to prepare the rider route.</p>
                </div>
              ) : (
                <>
                  <header className="route-console__header">
                    <div>
                      <span>Order route</span>
                      <h2>{(selectedOrder.profile && selectedOrder.profile.name) || 'Customer'}</h2>
                      <p>
                        {selectedOrder.quantity} × {bottleLabel(selectedOrder.bottleType)}
                        {' · '}
                        Accepted {timeLabel(selectedOrder.acceptedAt || selectedOrder.createdAt)}
                      </p>
                    </div>
                    <div className="route-console__header-actions">
                      <em className={`route-status route-status--${selectedStage}`}>
                        {stageLabel(selectedStage)}
                      </em>
                      <Tooltip title="Copy customer tracking link">
                        <span>
                          <IconButton
                            onClick={copyTrackingLink}
                            disabled={!selectedOrder.trackingToken}
                            aria-label="Copy customer tracking link"
                          >
                            <ContentCopyRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </div>
                  </header>

                  <div className="route-progress" aria-label="Delivery progress">
                    {PROGRESS_STEPS.map((step, index) => (
                      <div
                        key={step.stage}
                        className={`${index < currentStep ? 'is-complete' : ''}${index === currentStep ? ' is-current' : ''}`}
                      >
                        <span>{index < currentStep ? <CheckCircleRoundedIcon /> : index + 1}</span>
                        <strong>{step.label}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="route-console__details">
                    <div>
                      <span><PlaceRoundedIcon /></span>
                      <div>
                        <small>Delivery address</small>
                        <strong>{orderAddress(selectedOrder) || 'Ask the customer to save an address'}</strong>
                      </div>
                    </div>
                    <div>
                      <span><PhoneRoundedIcon /></span>
                      <div>
                        <small>Customer phone</small>
                        <strong>{(selectedOrder.profile && selectedOrder.profile.phone) || 'Not on file'}</strong>
                      </div>
                      {selectedOrder.profile && selectedOrder.profile.phone && (
                        <a
                          href={`tel:${selectedOrder.profile.phone}`}
                          aria-label={`Call ${selectedOrder.profile.name || 'customer'}`}
                        >
                          Call
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="route-console__map-wrap">
                    <div className="route-console__map-heading">
                      <div><RouteRoundedIcon /><span><strong>Live route map</strong><small>{mapStops.length} route stop{mapStops.length === 1 ? '' : 's'}</small></span></div>
                      <span className={liveSharing ? 'is-live' : ''}><i /> {liveSharing ? 'Sharing live' : 'GPS paused'}</span>
                    </div>
                    <RiderMap
                      riderLat={selectedOrder.riderLat}
                      riderLng={selectedOrder.riderLng}
                      riderName={selectedOrder.riderName || riderName}
                      stops={mapStops}
                      className="route-console__map"
                    />
                  </div>

                  <footer className="route-command">
                    <div className="route-command__copy">
                      <span>Rider controls</span>
                      <strong>{selectedOrder.riderName || riderName}</strong>
                      <small>
                        {liveSharing
                          ? 'Live GPS is updating the customer tracking link.'
                          : 'Share GPS from the rider phone when the route begins.'}
                      </small>
                    </div>

                    <div className="route-command__location">
                      <Button
                        variant="outlined"
                        startIcon={locating ? <CircularProgress size={16} /> : <MyLocationRoundedIcon />}
                        onClick={shareDeviceLocation}
                        disabled={locating || selectedStage === DELIVERY_STAGE.delivered}
                      >
                        {locating ? 'Locating…' : 'Share once'}
                      </Button>
                      <Button
                        variant={liveSharing ? 'contained' : 'outlined'}
                        color={liveSharing ? 'warning' : 'primary'}
                        onClick={() => setLiveSharing((value) => !value)}
                        disabled={selectedStage === DELIVERY_STAGE.delivered}
                      >
                        {liveSharing ? 'Stop live GPS' : 'Start live GPS'}
                      </Button>
                    </div>

                    <div className="route-command__actions">
                      {selectedStage === DELIVERY_STAGE.inTransit
                        && selectedOrder.trackingStatus !== 'nearby' && (
                        <Button
                          variant="outlined"
                          startIcon={<NearMeRoundedIcon />}
                          disabled={busy}
                          onClick={() => markNearby(selectedOrder)}
                        >
                          Rider is nearby
                        </Button>
                      )}
                      {primaryAction ? (
                        <Button
                          variant="contained"
                          endIcon={updating === selectedOrder.id
                            ? <CircularProgress size={16} color="inherit" />
                            : primaryAction.icon}
                          disabled={busy}
                          onClick={primaryAction.action}
                        >
                          {primaryAction.label}
                        </Button>
                      ) : (
                        <span className="route-command__complete">
                          <CheckCircleRoundedIcon /> Route completed
                        </span>
                      )}
                    </div>
                  </footer>
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
}
