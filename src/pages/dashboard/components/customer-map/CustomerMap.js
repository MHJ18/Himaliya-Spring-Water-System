import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import s from './CustomerMap.module.scss';
import {
  getStableCustomerCoordinates,
  resolveDeliveryAddressCoordinates,
} from '../../../../utils/coordinates';
import { getMapStyle } from '../../../../utils/mapStyles';

const SIALKOT_CANTT_CENTER = [74.5229, 32.4945];
const DEFAULT_ZOOM = 10.5;
const SINGLE_POINT_ZOOM = 11.25;

function isCoordinate(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resolveCustomerPoint(customer) {
  const latitude = isCoordinate(customer.lat) ? customer.lat : customer.latitude;
  const longitude = isCoordinate(customer.lng) ? customer.lng : customer.longitude;

  if (isCoordinate(latitude) && isCoordinate(longitude)) {
    return {
      coords: {
        lat: Number(latitude),
        lng: Number(longitude),
      },
      approximate: false,
    };
  }

  return {
    coords: getStableCustomerCoordinates(customer),
    approximate: true,
  };
}

function popupNode(title, phone, address, approximate) {
  const node = document.createElement('div');
  const heading = document.createElement('strong');
  const addressLine = document.createElement('span');
  const note = document.createElement('small');

  node.className = s.popup;
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-label', title);
  heading.textContent = title;
  addressLine.textContent = address || 'Address not set';
  node.appendChild(heading);

  if (phone) {
    const phoneLine = document.createElement('span');
    phoneLine.textContent = phone;
    node.appendChild(phoneLine);
  }

  node.appendChild(addressLine);

  if (approximate) {
    note.textContent = 'Estimated pin — verify before planning a route';
    node.appendChild(note);
  }

  return node;
}

function markerElement(title, address, approximate, active = true) {
  const element = document.createElement('button');
  const visual = document.createElement('span');

  element.type = 'button';
  element.className = s.markerButton;
  element.setAttribute(
    'aria-label',
    `${title}. ${address || 'Address not set'}.${approximate ? ' Estimated location from the saved address.' : ''}`,
  );
  element.setAttribute('aria-haspopup', 'dialog');
  element.setAttribute('aria-expanded', 'false');
  element.title = approximate ? `${title} — estimated location` : title;

  visual.className = `${s.markerDot}${active ? ` ${s.markerDotActive}` : ''}`;
  visual.setAttribute('aria-hidden', 'true');
  element.appendChild(visual);

  return element;
}

function addCustomerMarker(map, customer) {
  const title = customer.name || 'Customer';
  const detail = customer.address || 'Address not set';
  const element = markerElement(title, detail, customer.approximate);
  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: '18rem',
    offset: 18,
  }).setDOMContent(popupNode(
    title,
    customer.phone || '',
    detail,
    customer.approximate,
  ));

  popup.on('open', () => element.setAttribute('aria-expanded', 'true'));
  popup.on('close', () => element.setAttribute('aria-expanded', 'false'));

  return new maplibregl.Marker({
    element,
    anchor: 'center',
  })
    .setLngLat([customer.coords.lng, customer.coords.lat])
    .setPopup(popup)
    .addTo(map);
}

function fitMapToPoints(map, points, singlePointZoom = SINGLE_POINT_ZOOM) {
  if (!map) return;
  const duration = prefersReducedMotion() ? 0 : 620;

  if (!points.length) {
    map.easeTo({
      center: SIALKOT_CANTT_CENTER,
      zoom: DEFAULT_ZOOM,
      bearing: 0,
      pitch: 0,
      duration,
      essential: false,
    });
    return;
  }

  if (points.length === 1) {
    map.easeTo({
      center: points[0],
      zoom: singlePointZoom,
      bearing: 0,
      pitch: 0,
      duration,
      essential: false,
    });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  points.forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, {
    padding: {
      top: 70,
      right: 48,
      bottom: 70,
      left: 48,
    },
    maxZoom: 11.75,
    duration,
    essential: false,
  });
}

export default function CustomerMap({ customers }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const currentStyleModeRef = useRef('light');
  // Light basemap by default: delivery pins and route lines read better on the
  // pale tiles, and it matches the rest of the admin surfaces.
  const [darkMap, setDarkMap] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);
  const [geocodedCustomers, setGeocodedCustomers] = React.useState({});

  const baseMappedCustomers = useMemo(() => (
    customers.map((customer) => {
      const resolved = resolveCustomerPoint(customer);
      return {
        ...customer,
        coords: resolved.coords,
        approximate: resolved.approximate,
      };
    })
  ), [customers]);

  // Keyed on the addresses themselves so an unrelated re-render (a customer
  // list refresh, a theme toggle) cannot abort and restart lookups that are
  // still in flight.
  const pendingAddressKey = useMemo(() => Array.from(new Set(
    baseMappedCustomers
      .filter((customer) => customer.approximate && customer.address)
      .map((customer) => String(customer.address)),
  )).sort().join('|'), [baseMappedCustomers]);

  useEffect(() => {
    if (!pendingAddressKey) return undefined;
    const controller = new AbortController();

    Promise.all(pendingAddressKey.split('|').map(async (address) => {
      try {
        const coords = await resolveDeliveryAddressCoordinates(address, { signal: controller.signal });
        return [address, coords];
      } catch (error) {
        return [address, null];
      }
    })).then((results) => {
      if (controller.signal.aborted) return;
      const resolved = results.filter((entry) => entry[1]);
      if (!resolved.length) return;
      setGeocodedCustomers((current) => ({ ...current, ...Object.fromEntries(resolved) }));
    });

    return () => controller.abort();
  }, [pendingAddressKey]);

  const mappedCustomers = useMemo(() => baseMappedCustomers.map((customer) => {
    const geocoded = customer.address ? geocodedCustomers[String(customer.address)] : null;
    return geocoded ? { ...customer, coords: geocoded, geocoded: true } : customer;
  }), [baseMappedCustomers, geocodedCustomers]);

  const visiblePoints = useMemo(() => (
    mappedCustomers.length
      ? mappedCustomers.map((customer) => [customer.coords.lng, customer.coords.lat])
      : [SIALKOT_CANTT_CENTER]
  ), [mappedCustomers]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return undefined;
    let map;

    try {
      map = new maplibregl.Map({
        container: mapRef.current,
        style: getMapStyle('light'),
        center: SIALKOT_CANTT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 3,
        maxZoom: 19,
        cooperativeGestures: true,
        attributionControl: {
          compact: true,
        },
        keyboard: true,
        pitchWithRotate: true,
        maxPitch: 55,
      });

      map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
      map.addControl(new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({
        maxWidth: 96,
        unit: 'metric',
      }), 'bottom-left');

      const handleLoad = () => {
        setMapError(false);
        setMapReady(true);
        map.resize();
        const canvas = map.getCanvas();
        canvas.setAttribute('aria-label', 'Interactive customer coverage map');
      };
      const handleStyleLoad = () => setMapError(false);
      // A single failed tile is not a broken map; only a style that never
      // loads means there is nothing to show.
      const handleError = (event) => {
        if (map.isStyleLoaded() || (event && event.sourceId)) return;
        setMapError(true);
      };

      map.on('load', handleLoad);
      map.on('style.load', handleStyleLoad);
      map.on('error', handleError);
      mapInstanceRef.current = map;
      let resizeFrame = 0;
      const resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
          window.cancelAnimationFrame(resizeFrame);
          resizeFrame = window.requestAnimationFrame(() => map.resize());
        })
        : null;
      if (resizeObserver) resizeObserver.observe(mapRef.current);

      return () => {
        if (resizeObserver) resizeObserver.disconnect();
        window.cancelAnimationFrame(resizeFrame);
        map.off('load', handleLoad);
        map.off('style.load', handleStyleLoad);
        map.off('error', handleError);
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (error) {
      if (map) map.remove();
      mapInstanceRef.current = null;
      setMapError(true);
    }

    return undefined;
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const nextMode = darkMap ? 'dark' : 'light';
    if (!map || currentStyleModeRef.current === nextMode) return undefined;

    const handleStyleLoad = () => setMapError(false);
    currentStyleModeRef.current = nextMode;
    setMapError(false);
    map.once('style.load', handleStyleLoad);
    map.setStyle(getMapStyle(nextMode));

    return () => map.off('style.load', handleStyleLoad);
  }, [darkMap]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return undefined;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!mappedCustomers.length) {
      markersRef.current = [addCustomerMarker(map, {
        id: 'himalaya-sialkot',
        name: 'Himaliya Spring Water',
        phone: '',
        address: 'Sialkot Cantt',
        coords: {
          lat: SIALKOT_CANTT_CENTER[1],
          lng: SIALKOT_CANTT_CENTER[0],
        },
        approximate: false,
      })];
      fitMapToPoints(map, visiblePoints, DEFAULT_ZOOM);
    } else {
      mappedCustomers.forEach((customer) => {
        markersRef.current.push(addCustomerMarker(map, customer));
      });
      fitMapToPoints(map, visiblePoints);
    }

    const timer = window.setTimeout(() => map.resize(), 120);
    return () => window.clearTimeout(timer);
  }, [mapReady, mappedCustomers, visiblePoints]);

  const withAddress = customers.filter((customer) => customer.address).length;
  const geocodedCount = mappedCustomers.filter((customer) => customer.geocoded).length;
  const approximateCount = mappedCustomers.filter((customer) => customer.approximate && !customer.geocoded).length;

  const fitCurrentView = React.useCallback(() => {
    fitMapToPoints(
      mapInstanceRef.current,
      visiblePoints,
      mappedCustomers.length ? SINGLE_POINT_ZOOM : DEFAULT_ZOOM,
    );
  }, [mappedCustomers.length, visiblePoints]);

  return (
    <div className={`${s.shell}${darkMap ? ` ${s.shellDark}` : ''}`}>
      <div className={s.mapTop}>
        <div>
          <span>Route planning preview</span>
          <strong>{mappedCustomers.length || 1} locations</strong>
        </div>
        <div className={s.mapStats}>
          <span>{withAddress} saved addresses</span>
          {Boolean(geocodedCount) && <span>{geocodedCount} address-matched</span>}
          {Boolean(approximateCount) && <span>{approximateCount} estimated</span>}
          <span>{customers.length} total</span>
        </div>
      </div>
      <div className={s.mapFrame}>
        <div
          ref={mapRef}
          className={s.mapCanvas}
          role="region"
          aria-label="Customer locations and route planning preview map"
        />
        <div className={s.mapActions}>
          <button type="button" onClick={fitCurrentView} aria-label="Fit all customer locations">
            Fit locations
          </button>
          <button
            type="button"
            onClick={() => setDarkMap((isDark) => !isDark)}
            aria-pressed={darkMap}
            aria-label={`Use ${darkMap ? 'light' : 'dark'} map style`}
          >
            {darkMap ? 'Light map' : 'Dark map'}
          </button>
        </div>
        {Boolean(geocodedCount || approximateCount) && (
          <div className={s.accuracyNote} role="note">
            <span aria-hidden="true" />
            Addresses resolved to map pins · verify before route planning
          </div>
        )}
        {mapError && (
          <div className={s.mapError} role="status">
            Map tiles are unavailable. Customer locations remain available in the list.
          </div>
        )}
      </div>
      <ul className={s.srOnly}>
        {mappedCustomers.length ? mappedCustomers.map((customer) => (
          <li key={customer.id}>
            {customer.name || 'Customer'}: {customer.address || 'Address not set'}
            {customer.approximate ? ' (estimated location)' : ''}
          </li>
        )) : (
          <li>Himaliya Spring Water: Sialkot Cantt</li>
        )}
      </ul>
    </div>
  );
}

CustomerMap.propTypes = {
  customers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string,
    address: PropTypes.string,
    phone: PropTypes.string,
    photo: PropTypes.string,
    lat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    lng: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    latitude: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    longitude: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  })),
};

CustomerMap.defaultProps = {
  customers: [],
};
