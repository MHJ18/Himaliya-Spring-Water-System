import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import s from './CustomerMap.module.scss';
import { getStableCustomerCoordinates } from '../../../../utils/coordinates';

const SIALKOT_CANTT_CENTER = [32.4945, 74.5229];
const DEFAULT_ZOOM = 12;

function createPinIcon(active) {
  return L.divIcon({
    className: s.leafletIcon,
    html: `<span class="${s.markerDot}${active ? ` ${s.markerDotActive}` : ''}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

export default function CustomerMap({ customers }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const mappedCustomers = useMemo(() => (
    customers.map((customer) => ({
      ...customer,
      coords: getStableCustomerCoordinates(customer),
    }))
  ), [customers]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return undefined;

    const map = L.map(mapRef.current, {
      center: SIALKOT_CANTT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!mappedCustomers.length) {
      const marker = L.marker(SIALKOT_CANTT_CENTER, { icon: createPinIcon(true) }).addTo(map);
      marker.bindPopup('<strong>Himaliya Spring Water</strong><br/>Sialkot Cantt');
      markersRef.current = [marker];
      map.setView(SIALKOT_CANTT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds([]);

    mappedCustomers.forEach((customer) => {
      const { lat, lng } = customer.coords;
      const position = [lat, lng];
      bounds.extend(position);

      const marker = L.marker(position, { icon: createPinIcon(true) }).addTo(map);
      marker.bindPopup(`
        <strong>${customer.name || 'Customer'}</strong><br/>
        ${customer.phone || ''}<br/>
        ${customer.address || 'Address not set'}
      `);
      markersRef.current.push(marker);
    });

    if (mappedCustomers.length === 1) {
      map.setView([mappedCustomers[0].coords.lat, mappedCustomers[0].coords.lng], 13);
    } else {
      map.fitBounds(bounds.pad(0.15), { animate: false, maxZoom: 13 });
    }
  }, [mappedCustomers]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timer);
  }, [mappedCustomers.length]);

  const withAddress = customers.filter((customer) => customer.address).length;

  return (
    <div className={s.shell}>
      <div className={s.mapTop}>
        <div>
          <span>Route map</span>
          <strong>{mappedCustomers.length || 1} locations</strong>
        </div>
        <div className={s.mapStats}>
          <span>{withAddress} mapped</span>
          <span>{customers.length} total</span>
        </div>
      </div>
      <div ref={mapRef} className={s.mapCanvas} role="application" aria-label="Customer locations map" />
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
  })),
};

CustomerMap.defaultProps = {
  customers: [],
};
