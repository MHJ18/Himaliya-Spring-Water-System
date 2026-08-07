import React from 'react';
import PropTypes from 'prop-types';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  buildDeliveryDirectionsUrl,
  getDrivingRouteCoordinates,
  getStableCustomerCoordinates,
  resolveDeliveryAddressCoordinates,
} from '../../utils/coordinates';
import { MAP_STYLE_URLS } from '../../utils/mapStyles';
import './RiderMap.css';

const DEFAULT_CENTER = [74.5229, 32.4945];
const DEFAULT_ZOOM = 13;
const LIGHT_STYLE = MAP_STYLE_URLS.light;
const DARK_STYLE = MAP_STYLE_URLS.dark;
const ROUTE_SOURCE_ID = 'rider-map-approximate-route';
const ROUTE_CASING_LAYER_ID = 'rider-map-approximate-route-casing';
const ROUTE_LAYER_ID = 'rider-map-approximate-route-line';

function isCoordinate(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function popupNode(title, detail, note) {
  const node = document.createElement('div');
  const heading = document.createElement('strong');
  const copy = document.createElement('span');
  const meta = document.createElement('small');

  heading.textContent = title;
  copy.textContent = detail;
  node.className = 'rider-map__popup';
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-label', title);
  node.appendChild(heading);
  node.appendChild(copy);

  if (note) {
    meta.textContent = note;
    node.appendChild(meta);
  }

  return node;
}

function resolvePoint(stop) {
  if (isCoordinate(stop.lat) && isCoordinate(stop.lng)) {
    return {
      coords: { lat: Number(stop.lat), lng: Number(stop.lng) },
      approximate: false,
    };
  }

  return {
    coords: getStableCustomerCoordinates({
      id: stop.id || stop.address || 'sialkot-cantt',
      address: stop.address || 'Sialkot Cantt',
      name: stop.label || '',
    }),
    approximate: true,
  };
}

function markerElement(type, title, detail, selected = false, approximate = false) {
  const element = document.createElement('button');
  const visual = document.createElement('span');
  const center = document.createElement('i');
  const qualifier = approximate ? ' Estimated from the saved address.' : '';

  element.type = 'button';
  element.className = [
    'rider-map__marker-button',
    `rider-map__marker-button--${type}`,
    selected ? 'is-selected' : '',
  ].filter(Boolean).join(' ');
  element.setAttribute('aria-label', `${title}. ${detail}.${qualifier}`);
  element.setAttribute('aria-haspopup', 'dialog');
  element.setAttribute('aria-expanded', 'false');
  element.title = approximate ? `${title} — estimated location` : title;

  visual.className = [
    'rider-map__marker',
    `rider-map__marker--${type}`,
    selected ? 'is-selected' : '',
  ].filter(Boolean).join(' ');
  visual.setAttribute('aria-hidden', 'true');
  center.setAttribute('aria-hidden', 'true');
  visual.appendChild(center);
  element.appendChild(visual);

  return element;
}

function addMarker(map, {
  type,
  title,
  detail,
  coords,
  selected = false,
  approximate = false,
}) {
  const element = markerElement(type, title, detail, selected, approximate);
  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: '17rem',
    offset: type === 'destination' ? 28 : 21,
  }).setDOMContent(popupNode(
    title,
    detail,
    approximate ? 'Estimated pin — verify before dispatch' : (type === 'rider' ? 'Live shared position' : 'Saved coordinates'),
  ));

  popup.on('open', () => element.setAttribute('aria-expanded', 'true'));
  popup.on('close', () => element.setAttribute('aria-expanded', 'false'));

  return new maplibregl.Marker({
    element,
    anchor: type === 'destination' ? 'bottom' : 'center',
  })
    .setLngLat([coords.lng, coords.lat])
    .setPopup(popup)
    .addTo(map);
}

function routeFeature(coordinates) {
  return {
    type: 'Feature',
    properties: {
      approximate: true,
    },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

function removeRouteLayers(map) {
  if (!map || !map.isStyleLoaded()) return;
  if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
  if (map.getLayer(ROUTE_CASING_LAYER_ID)) map.removeLayer(ROUTE_CASING_LAYER_ID);
  if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
}

function syncRouteLayers(map, coordinates, darkMap, isDrivingRoute) {
  if (!map || !map.isStyleLoaded()) return;

  if (!coordinates || coordinates.length < 2) {
    removeRouteLayers(map);
    return;
  }

  const data = routeFeature(coordinates);
  const source = map.getSource(ROUTE_SOURCE_ID);

  if (source) {
    source.setData(data);
  } else {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data,
    });
  }

  if (!map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_CASING_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': darkMap ? '#062a38' : '#ffffff',
        'line-opacity': darkMap ? 0.68 : 0.8,
        'line-width': 8,
        'line-blur': 1.2,
      },
    });
  }

  if (!map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': darkMap ? '#53e1ef' : '#078eae',
        'line-opacity': 0.92,
        'line-width': 4,
        ...(isDrivingRoute ? {} : { 'line-dasharray': [1.3, 1.5] }),
      },
    });
  }

  map.setPaintProperty(ROUTE_LAYER_ID, 'line-color', darkMap ? '#53e1ef' : '#078eae');
  map.setPaintProperty(ROUTE_LAYER_ID, 'line-dasharray', isDrivingRoute ? null : [1.3, 1.5]);
}

function fitMapToPoints(map, points, {
  singlePointZoom = 14,
  maxZoom = 15,
  padding = {
    top: 82,
    right: 58,
    bottom: 82,
    left: 58,
  },
} = {}) {
  if (!map) return;
  const duration = prefersReducedMotion() ? 0 : 640;

  if (!points.length) {
    map.easeTo({
      center: DEFAULT_CENTER,
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
    padding,
    maxZoom,
    duration,
    essential: false,
  });
}

export default function RiderMap({
  riderLat,
  riderLng,
  riderName,
  destinationAddress,
  destinationLat,
  destinationLng,
  destinationId,
  stops,
  className,
  simplifiedControls,
  overviewMode,
  preferDark,
}) {
  const mapElement = React.useRef(null);
  const mapInstance = React.useRef(null);
  const markers = React.useRef([]);
  const currentStyle = React.useRef(LIGHT_STYLE);
  const [darkMap, setDarkMap] = React.useState(Boolean(preferDark));
  const [mapReady, setMapReady] = React.useState(false);
  const [styleRevision, setStyleRevision] = React.useState(0);
  const [mapError, setMapError] = React.useState(false);
  const [geocodedStops, setGeocodedStops] = React.useState({});
  const [drivingRoute, setDrivingRoute] = React.useState(null);
  const hasRiderLocation = isCoordinate(riderLat) && isCoordinate(riderLng);
  const overviewFit = simplifiedControls || overviewMode;

  const baseMappedStops = React.useMemo(() => {
    if (Array.isArray(stops) && stops.length) {
      return stops.map((stop) => {
        const resolved = resolvePoint(stop);
        return {
          ...stop,
          coords: resolved.coords,
          approximate: resolved.approximate,
        };
      });
    }
    if (destinationAddress || isCoordinate(destinationLat)) {
      const resolved = resolvePoint({
        id: destinationId || destinationAddress,
        address: destinationAddress,
        lat: destinationLat,
        lng: destinationLng,
      });
      return [{
        id: destinationId || destinationAddress || 'destination',
        label: 'Delivery destination',
        address: destinationAddress || 'Sialkot Cantt',
        selected: true,
        coords: resolved.coords,
        approximate: resolved.approximate,
      }];
    }
    return [];
  }, [destinationAddress, destinationId, destinationLat, destinationLng, stops]);

  React.useEffect(() => {
    const controller = new AbortController();
    const unresolved = baseMappedStops.filter((stop) => stop.approximate && stop.address);
    if (!unresolved.length) {
      setGeocodedStops({});
      return () => controller.abort();
    }

    Promise.all(unresolved.map(async (stop) => {
      try {
        const coords = await resolveDeliveryAddressCoordinates(stop.address, { signal: controller.signal });
        return [String(stop.id || stop.address || stop.label), coords];
      } catch (error) {
        return [String(stop.id || stop.address || stop.label), null];
      }
    })).then((results) => {
      if (controller.signal.aborted) return;
      setGeocodedStops(Object.fromEntries(results.filter((entry) => entry[1])));
    });

    return () => controller.abort();
  }, [baseMappedStops]);

  const mappedStops = React.useMemo(() => baseMappedStops.map((stop) => {
    const key = String(stop.id || stop.address || stop.label);
    const geocoded = geocodedStops[key];
    return geocoded ? { ...stop, coords: geocoded, geocoded: true } : stop;
  }), [baseMappedStops, geocodedStops]);

  const selectedStop = mappedStops.find((stop) => stop.selected) || mappedStops[0] || null;
  const hasApproximateStops = mappedStops.some((stop) => stop.approximate);

  const visiblePoints = React.useMemo(() => {
    const points = mappedStops.map((stop) => [stop.coords.lng, stop.coords.lat]);
    if (hasRiderLocation) points.push([Number(riderLng), Number(riderLat)]);
    return points;
  }, [hasRiderLocation, mappedStops, riderLat, riderLng]);

  const directRouteCoordinates = React.useMemo(() => {
    if (!hasRiderLocation || !selectedStop) return null;
    return [
      [Number(riderLng), Number(riderLat)],
      [selectedStop.coords.lng, selectedStop.coords.lat],
    ];
  }, [hasRiderLocation, riderLat, riderLng, selectedStop]);

  React.useEffect(() => {
    const controller = new AbortController();
    if (!hasRiderLocation || !selectedStop) {
      setDrivingRoute(null);
      return () => controller.abort();
    }

    setDrivingRoute(null);
    getDrivingRouteCoordinates({
      originLat: riderLat,
      originLng: riderLng,
      destinationLat: selectedStop.coords.lat,
      destinationLng: selectedStop.coords.lng,
      signal: controller.signal,
    }).then((coordinates) => {
      if (!controller.signal.aborted) setDrivingRoute(coordinates);
    }).catch(() => {
      if (!controller.signal.aborted) setDrivingRoute(null);
    });

    return () => controller.abort();
  }, [hasRiderLocation, riderLat, riderLng, selectedStop]);

  const routeCoordinates = drivingRoute || directRouteCoordinates;

  const directionsUrl = React.useMemo(() => (
    selectedStop ? buildDeliveryDirectionsUrl({
      destinationAddress: selectedStop.address,
      destinationLat: selectedStop.approximate ? null : selectedStop.coords.lat,
      destinationLng: selectedStop.approximate ? null : selectedStop.coords.lng,
      riderLat: hasRiderLocation ? riderLat : null,
      riderLng: hasRiderLocation ? riderLng : null,
    }) : ''
  ), [hasRiderLocation, riderLat, riderLng, selectedStop]);

  React.useEffect(() => {
    if (!mapElement.current || mapInstance.current) return undefined;
    let map;

    try {
      map = new maplibregl.Map({
        container: mapElement.current,
        style: LIGHT_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 3,
        maxZoom: 19,
        cooperativeGestures: true,
        attributionControl: {
          compact: true,
        },
        keyboard: true,
        pitchWithRotate: true,
        maxPitch: 60,
      });

      if (!simplifiedControls) {
        map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
        map.addControl(new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }), 'bottom-right');
        map.addControl(new maplibregl.ScaleControl({
          maxWidth: 108,
          unit: 'metric',
        }), 'bottom-left');
      }

      const handleLoad = () => {
        setMapError(false);
        map.resize();
        setMapReady(true);
        const canvas = map.getCanvas();
        canvas.setAttribute('aria-label', 'Interactive delivery location map');
      };
      const handleStyleLoad = () => setMapError(false);
      const handleError = () => {
        if (!map.isStyleLoaded()) setMapError(true);
      };

      map.on('load', handleLoad);
      map.on('style.load', handleStyleLoad);
      map.on('error', handleError);
      mapInstance.current = map;
      let resizeFrame = 0;
      const resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
          window.cancelAnimationFrame(resizeFrame);
          resizeFrame = window.requestAnimationFrame(() => map.resize());
        })
        : null;
      if (resizeObserver) resizeObserver.observe(mapElement.current);

      return () => {
        if (resizeObserver) resizeObserver.disconnect();
        window.cancelAnimationFrame(resizeFrame);
        map.off('load', handleLoad);
        map.off('style.load', handleStyleLoad);
        map.off('error', handleError);
        markers.current.forEach((marker) => marker.remove());
        markers.current = [];
        map.remove();
        mapInstance.current = null;
      };
    } catch (error) {
      if (map) map.remove();
      mapInstance.current = null;
      setMapError(true);
    }

    return undefined;
  }, [simplifiedControls]);

  React.useEffect(() => {
    setDarkMap(Boolean(preferDark));
  }, [preferDark]);

  React.useEffect(() => {
    const map = mapInstance.current;
    const nextStyle = darkMap ? DARK_STYLE : LIGHT_STYLE;
    if (!map || currentStyle.current === nextStyle) return undefined;

    const handleStyleLoad = () => {
      setMapError(false);
      setStyleRevision((revision) => revision + 1);
    };

    currentStyle.current = nextStyle;
    setMapError(false);
    map.once('style.load', handleStyleLoad);
    map.setStyle(nextStyle);

    return () => map.off('style.load', handleStyleLoad);
  }, [darkMap]);

  React.useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return undefined;
    map.resize();
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    mappedStops.forEach((stop) => {
      markers.current.push(addMarker(map, {
        type: stop.selected ? 'destination' : 'stop',
        title: stop.label || 'Customer',
        detail: stop.address || 'Saved profile address',
        coords: stop.coords,
        selected: Boolean(stop.selected),
        approximate: stop.approximate,
      }));
    });

    if (hasRiderLocation) {
      markers.current.push(addMarker(map, {
        type: 'rider',
        title: riderName || 'Delivery rider',
        detail: 'Current shared location',
        coords: {
          lat: Number(riderLat),
          lng: Number(riderLng),
        },
      }));
    }

    fitMapToPoints(map, visiblePoints, overviewFit ? {
      singlePointZoom: 10.75,
      maxZoom: 11.25,
      padding: {
        top: 74,
        right: 68,
        bottom: 88,
        left: 68,
      },
    } : undefined);

    const timer = window.setTimeout(() => map.resize(), 100);
    return () => window.clearTimeout(timer);
  }, [
    hasRiderLocation,
    mapReady,
    mappedStops,
    riderLat,
    riderLng,
    riderName,
    overviewFit,
    visiblePoints,
  ]);

  React.useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;
    syncRouteLayers(map, routeCoordinates, darkMap, Boolean(drivingRoute));
  }, [darkMap, drivingRoute, mapReady, routeCoordinates, styleRevision]);

  const fitCurrentView = React.useCallback(() => {
    fitMapToPoints(mapInstance.current, visiblePoints, overviewFit ? {
      singlePointZoom: 10.75,
      maxZoom: 11.25,
      padding: {
        top: 74,
        right: 68,
        bottom: 88,
        left: 68,
      },
    } : undefined);
  }, [overviewFit, visiblePoints]);

  let accuracyMessage = '';
  let fitButtonLabel = 'Reset view';
  if (visiblePoints.length) {
    fitButtonLabel = simplifiedControls ? 'Show delivery location' : 'Fit stops';
  }
  if (routeCoordinates) {
    fitButtonLabel = simplifiedControls ? 'Show whole route' : 'Fit route';
    accuracyMessage = drivingRoute
      ? `Driving route preview${hasApproximateStops ? ' · destination estimated from address' : ''}`
      : `Direct route preview${hasApproximateStops ? ' · destination estimated from address' : ''}`;
  } else if (hasApproximateStops) {
    accuracyMessage = 'Estimated destination pin · verify before dispatch';
  }

  return (
    <div className={`rider-map${darkMap ? ' rider-map--dark' : ''}${!mapReady || mapError ? ' rider-map--fallback' : ''}${className ? ` ${className}` : ''}`}>
      <div className="rider-map__fallback" aria-hidden="true">
        <i className="rider-map__fallback-road rider-map__fallback-road--one" />
        <i className="rider-map__fallback-road rider-map__fallback-road--two" />
        <i className="rider-map__fallback-road rider-map__fallback-road--three" />
        {hasRiderLocation && <span className="rider-map__fallback-route" />}
        {hasRiderLocation && (
          <span className="rider-map__fallback-point rider-map__fallback-point--rider">
            <i />
            <strong>Rider</strong>
          </span>
        )}
        <span className="rider-map__fallback-point rider-map__fallback-point--destination">
          <i />
          <strong>Delivery location</strong>
        </span>
        <span className="rider-map__fallback-copy">
          <strong>{selectedStop ? selectedStop.address : 'Saved delivery location'}</strong>
          <small>{hasRiderLocation ? 'Showing rider and destination overview' : 'Destination shown while rider GPS is unavailable'}</small>
        </span>
      </div>
      <div
        ref={mapElement}
        className="rider-map__canvas"
        role="region"
        aria-label={hasRiderLocation ? 'Live rider and delivery destination map' : 'Delivery destinations map'}
      />
      <div className="rider-map__controls">
        <button
          type="button"
          onClick={fitCurrentView}
          aria-label={visiblePoints.length ? 'Fit all visible delivery locations' : 'Reset map to Sialkot'}
        >
          {fitButtonLabel}
        </button>
        {directionsUrl && (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            Road directions
          </a>
        )}
        {!simplifiedControls && (
          <button
            type="button"
            onClick={() => setDarkMap((isDark) => !isDark)}
            aria-pressed={darkMap}
            aria-label={`Use ${darkMap ? 'light' : 'dark'} map style`}
          >
            {darkMap ? 'Light map' : 'Dark map'}
          </button>
        )}
      </div>
      {accuracyMessage && (
        <div className="rider-map__accuracy" role="note">
          <span aria-hidden="true" />
          {accuracyMessage}
        </div>
      )}
      {!mappedStops.length && (
        <div className="rider-map__waiting">
          <span aria-hidden="true" />
          Customer locations appear when orders are placed
        </div>
      )}
      {Boolean(mappedStops.length) && !hasRiderLocation && (
        <div className="rider-map__waiting rider-map__waiting--soft">
          <span aria-hidden="true" />
          {hasApproximateStops ? 'Estimated destination from saved address' : 'Waiting for rider location'}
        </div>
      )}
      {mapError && (
        <div className="rider-map__error" role="status">
          Map tiles are unavailable. Location details are still listed for assistive technology.
        </div>
      )}
      <ul className="rider-map__sr-only">
        {mappedStops.map((stop) => (
          <li key={stop.id || stop.address || stop.label}>
            {stop.label || 'Customer'}: {stop.address || 'Saved profile address'}
            {stop.approximate ? ' (estimated location)' : ''}
          </li>
        ))}
        {hasRiderLocation && (
          <li>{riderName || 'Delivery rider'}: current shared location</li>
        )}
      </ul>
    </div>
  );
}

RiderMap.propTypes = {
  riderLat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  riderLng: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  riderName: PropTypes.string,
  destinationAddress: PropTypes.string,
  destinationLat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  destinationLng: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  destinationId: PropTypes.string,
  stops: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    address: PropTypes.string,
    lat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    lng: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    selected: PropTypes.bool,
  })),
  className: PropTypes.string,
  simplifiedControls: PropTypes.bool,
  overviewMode: PropTypes.bool,
  preferDark: PropTypes.bool,
};

RiderMap.defaultProps = {
  riderLat: null,
  riderLng: null,
  riderName: '',
  destinationAddress: '',
  destinationLat: null,
  destinationLng: null,
  destinationId: '',
  stops: null,
  className: '',
  simplifiedControls: false,
  overviewMode: false,
  preferDark: false,
};
