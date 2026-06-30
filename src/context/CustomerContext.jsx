import React, {
  createContext, useContext, useReducer, useEffect, useCallback, useMemo,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { customerApi } from '../services/api/customerApi';
import { normalizePhone } from '../utils/validation';
import { getSessionReadyEventName, hasStoredSessionType } from '../services/cloud/supabaseClient';

const CustomerContext = createContext(null);

const initialState = {
  customers: [],
  adminCustomers: [],
  signedUpCustomers: [],
  loading: true,
  error: '',
};

function phoneKey(phone) {
  return (phone || '').replace(/\D/g, '');
}

function buildCustomerCollections(customers) {
  const canonical = (customers || []).map((customer) => ({
    ...customer,
    linkedCustomerId: customer.id,
    source: customer.source || 'admin',
  }));
  return {
    customers: canonical,
    adminCustomers: canonical.filter((customer) => customer.source !== 'portal'),
    signedUpCustomers: canonical.filter((customer) => Boolean(customer.authUserId)),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload, loading: false, error: '' };
    case 'ERROR':
      return { ...initialState, loading: false, error: action.payload };
    case 'SET': {
      if (Array.isArray(action.payload)) {
        return {
          ...state,
          customers: action.payload,
          adminCustomers: action.payload.filter((customer) => customer.source !== 'portal'),
        };
      }
      return { ...state, ...action.payload };
    }
    default:
      return state;
  }
}

export function CustomerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadCustomers = useCallback((options = {}) => {
    if (!hasStoredSessionType('admin')) {
      dispatch({ type: 'LOAD', payload: [] });
      return Promise.resolve();
    }
    return customerApi.getAll()
      .then((data) => {
        const payload = buildCustomerCollections(data || []);
        dispatch({ type: options.silent ? 'SET' : 'LOAD', payload });
      })
      .catch((error) => dispatch({ type: 'ERROR', payload: error.message || 'Could not load cloud data.' }));
  }, []);

  useEffect(() => {
    loadCustomers();
    const silentRefresh = () => loadCustomers({ silent: true });
    window.addEventListener(getSessionReadyEventName(), loadCustomers);
    window.addEventListener('focus', silentRefresh);
    const intervalId = window.setInterval(silentRefresh, 45000);
    return () => {
      window.removeEventListener(getSessionReadyEventName(), loadCustomers);
      window.removeEventListener('focus', silentRefresh);
      window.clearInterval(intervalId);
    };
  }, [loadCustomers]);

  const persist = useCallback(async (customers) => {
    await customerApi.saveAll(customers);
    dispatch({ type: 'SET', payload: customers });
  }, []);

  const addCustomer = useCallback(async (form) => {
    const phone = normalizePhone(form.phone);
    if (state.customers.some((c) => c.phone === phone)) {
      throw new Error('A customer with this phone number already exists');
    }
    const customer = {
      id: uuidv4(),
      name: form.name.trim(),
      phone,
      address: form.address.trim(),
      email: (form.email || '').trim(),
      photo: form.photo || '',
      source: 'admin',
      createdAt: new Date().toISOString(),
      purchaseHistory: [],
    };
    await persist([...state.customers, customer]);
    return customer;
  }, [state.customers, persist]);

  const updateCustomer = useCallback(async (customerId, form) => {
    const phone = normalizePhone(form.phone);
    if (state.customers.some((customer) => customer.id !== customerId && customer.phone === phone)) {
      throw new Error('A customer with this phone number already exists');
    }

    const currentCustomer = state.customers.find((customer) => customer.id === customerId);
    if (!currentCustomer) throw new Error('Customer not found');

    const updatedCustomer = {
      ...currentCustomer,
      name: form.name.trim(),
      phone,
      address: form.address.trim(),
      email: (form.email || '').trim(),
      photo: form.photo || '',
      source: currentCustomer.source === 'portal' ? 'both' : currentCustomer.source,
    };
    await persist(state.customers.map((customer) => (
      customer.id === customerId ? updatedCustomer : customer
    )));
    return updatedCustomer;
  }, [state.customers, persist]);

  const deleteCustomer = useCallback(async (customerId) => {
    const currentCustomer = state.customers.find((customer) => customer.id === customerId);
    if (!currentCustomer) throw new Error('Customer not found');
    await customerApi.delete(customerId);
    dispatch({
      type: 'SET',
      payload: state.customers.filter((customer) => customer.id !== customerId),
    });
  }, [state.customers]);

  const findByPhone = useCallback((phone) => {
    const n = normalizePhone(phone);
    return state.customers.find((c) => c.phone === n);
  }, [state.customers]);

  const searchCustomers = useCallback((query) => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return state.customers;
    const phoneDigits = q.replace(/\D/g, '');
    return state.customers.filter(
      (c) => (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (phoneDigits && phoneKey(c.phone).includes(phoneDigits))
    );
  }, [state.customers]);

  const addTransaction = useCallback(async (customerId, transaction) => {
    const updated = state.customers.map((c) =>
      c.id === customerId
        ? { ...c, purchaseHistory: [...(c.purchaseHistory || []), transaction] }
        : c
    );
    await persist(updated);
    return transaction;
  }, [state.customers, persist]);

  const refresh = useCallback(() => loadCustomers(), [loadCustomers]);

  const value = useMemo(() => ({
    customers: state.customers,
    adminCustomers: state.adminCustomers,
    signedUpCustomers: state.signedUpCustomers,
    loading: state.loading,
    error: state.error,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    findByPhone,
    searchCustomers,
    addTransaction,
    refresh,
  }), [state, addCustomer, updateCustomer, deleteCustomer, findByPhone, searchCustomers, addTransaction, refresh]);

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomers() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomers requires CustomerProvider');
  return ctx;
}
