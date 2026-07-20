import React from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getStableCustomerCoordinates } from '../../utils/coordinates';
import './RiderMap.css';

const DEFAULT_CENTER = [32.4945, 74.5229];

function isCoordinate(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function markerIcon(type, selected = false) {
  return L.divIcon({
    className: 'rider-map__leaflet-icon',
    html: `<span class="rider-map__marker rider-map__marker--${type}${selected ? ' is-selected' : ''}"><i></i></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function popupNode(title, detail) {
  const node = document.createElement('div');
  const heading = document.createElement('strong');
  const copy = document.createElement('span');
  heading.textContent = title;
  copy.textContent = detail;
  node.className = 'rider-map__popup';
  node.appendChild(heading);
  node.appendChild(copy);
  return node;
}

function resolvePoint(stop) {
  if (isCoordinate(stop.lat) && isCoordinate(stop.lng)) {
    return { lat: Number(stop.lat), lng: Number(stop.lng) };
  }
  return getStableCustomerCoordinates({
    id: stop.id || stop.address || 'sialkot-cantt',
    address: stop.address || 'Sialkot Cantt',
    name: stop.label || '',
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
}) {
  const mapElement = React.useRef(null);
  const mapInstance = React.useRef(null);
  const layers = React.useRef([]);
  const hasRiderLocation = isCoordinate(riderLat) && isCoordinate(riderLng);

  const mappedStops = React.useMemo(() => {
    if (Array.isArray(stops) && stops.length) {
      return stops.map((stop) => ({
        ...stop,
        coords: resolvePoint(stop),
      }));
    }
    if (destinationAddress || isCoordinate(destinationLat)) {
      return [{
        id: destinationId || destinationAddress || 'destination',
        label: 'Delivery destination',
        address: destinationAddress || 'Sialkot Cantt',
        selected: true,
        coords: resolvePoint({
          id: destinationId || destinationAddress,
          address: destinationAddress,
          lat: destinationLat,
          lng: destinationLng,
        }),
      }];
    }
    return [];
  }, [destinationAddress, destinationId, destinationLat, destinationLng, stops]);

  const selectedStop = mappedStops.find((stop) => stop.selected) || mappedStops[0] || null;

  React.useEffect(() => {
    if (!mapElement.current || mapInstance.current) return undefined;
    const map = L.map(mapElement.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
      layers.current = [];
    };
  }, []);

  React.useEffect(() => {
    const map = mapInstance.current;
    if (!map) return undefined;
    layers.current.forEach((layer) => layer.remove());
    layers.current = [];

    const bounds = L.latLngBounds([]);

    mappedStops.forEach((stop) => {
      const point = [stop.coords.lat, stop.coords.lng];
      bounds.extend(point);
      const marker = L.marker(point, {
        icon: markerIcon(stop.selected ? 'destination' : 'stop', Boolean(stop.selected)),
        zIndexOffset: stop.selected ? 50 : 0,
      })
        .addTo(map)
        .bindPopup(popupNode(stop.label || 'Customer', stop.address || 'Saved profile address'));
      layers.current.push(marker);
    });

    if (hasRiderLocation) {
      const riderPoint = [Number(riderLat), Number(riderLng)];
      bounds.extend(riderPoint);
      const riderMarker = L.marker(riderPoint, {
        icon: markerIcon('rider'),
        zIndexOffset: 100,
      })
        .addTo(map)
        .bindPopup(popupNode(riderName || 'Delivery rider', 'Current shared location'));
      layers.current.push(riderMarker);

      if (selectedStop) {
        const routeLine = L.polyline([riderPoint, [selectedStop.coords.lat, selectedStop.coords.lng]], {
          color: '#08a7c7',
          opacity: 0.82,
          weight: 4,
          dashArray: '5 10',
        }).addTo(map);
        layers.current.push(routeLine);
      }
    }

    if (bounds.isValid()) {
      if (mappedStops.length === 1 && !hasRiderLocation) {
        map.setView([mappedStops[0].coords.lat, mappedStops[0].coords.lng], 14, { animate: false });
      } else {
        map.fitBounds(bounds.pad(0.28), { animate: false, maxZoom: 15 });
      }
    } else {
      map.setView(DEFAULT_CENTER, 13, { animate: false });
    }

    const timer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(timer);
  }, [
    hasRiderLocation,
    mappedStops,
    riderLat,
    riderLng,
    riderName,
    selectedStop,
  ]);

  return (
    <div className={`rider-map${className ? ` ${className}` : ''}`}>
      <div
        ref={mapElement}
        className="rider-map__canvas"
        role="application"
        aria-label={hasRiderLocation ? 'Live rider and delivery destination map' : 'Delivery destinations map'}
      />
      {!mappedStops.length && (
        <div className="rider-map__waiting">
          <span />
          Customer locations appear when orders are placed
        </div>
      )}
      {Boolean(mappedStops.length) && !hasRiderLocation && (
        <div className="rider-map__waiting rider-map__waiting--soft">
          <span />
          Destination from customer profile
        </div>
      )}
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
};
