import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef,
} from 'react';
import { getAdminCustomerOrders } from '../services/api/customerPortalApi';
import { getBottlePrices } from '../services/api/bottlePriceApi';
import { getSessionReadyEventName, hasStoredSessionType } from '../services/cloud/supabaseClient';
import { useSettings } from './SettingsContext';

const DeliveryContext = createContext(null);

const initialState = {
  orders: [],
  prices: {},
  loading: true,
  error: '',
};

function reducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...state, loading: true, error: '' };
    case 'LOAD':
      return { ...state, ...action.payload, loading: false, error: '' };
    case 'ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'RESET':
      return { ...initialState, loading: false };
    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map((order) => (
          order.id === action.payload.id ? action.payload : order
        )),
      };
    default:
      return state;
  }
}

export function DeliveryProvider({ children }) {
  const { settings } = useSettings();
  const [state, dispatch] = useReducer(reducer, initialState);
  const requestRef = useRef(null);

  const loadDeliveries = useCallback((options = {}) => {
    if (!hasStoredSessionType('admin')) {
      dispatch({ type: 'RESET' });
      return Promise.resolve();
    }
    if (requestRef.current) return requestRef.current;

    if (!options.silent) dispatch({ type: 'START' });
    const request = getBottlePrices({})
      .then((prices) => getAdminCustomerOrders(prices).then((orders) => ({ prices, orders })))
      .then((payload) => dispatch({ type: 'LOAD', payload }))
      .catch((error) => dispatch({ type: 'ERROR', payload: error.message || 'Could not load deliveries.' }))
      .finally(() => {
        if (requestRef.current === request) requestRef.current = null;
      });
    requestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    loadDeliveries();
    const refreshWhenVisible = () => {
      if (!document.hidden) loadDeliveries({ silent: true });
    };
    window.addEventListener(getSessionReadyEventName(), loadDeliveries);
    window.addEventListener('online', refreshWhenVisible);
    const interval = window.setInterval(
      refreshWhenVisible,
      Math.max(5000, (Number(settings.riderLocationRefreshSeconds) || 15) * 1000),
    );
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener(getSessionReadyEventName(), loadDeliveries);
      window.removeEventListener('online', refreshWhenVisible);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadDeliveries, settings.riderLocationRefreshSeconds]);

  const updateOrder = useCallback((order) => {
    dispatch({ type: 'UPDATE_ORDER', payload: order });
  }, []);

  const value = useMemo(() => ({
    ...state,
    refresh: loadDeliveries,
    updateOrder,
  }), [state, loadDeliveries, updateOrder]);

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}

export function useDeliveries() {
  const context = useContext(DeliveryContext);
  if (!context) throw new Error('useDeliveries requires DeliveryProvider');
  return context;
}
