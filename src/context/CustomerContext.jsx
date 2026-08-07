import React, {
  createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { customerApi } from '../services/api/customerApi';
import { normalizePhone } from '../utils/validation';
import { createId } from '../utils/id';
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

function normalizePaymentSchedule(value) {
  return value === 'on_delivery' ? 'on_delivery' : 'monthly';
}

export function normalizeCustomerEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function buildMonthlyPaymentPlan(history, amount) {
  const received = Number(amount);
  const payableEntries = (history || [])
    .filter((entry) => normalizePaymentSchedule(entry.paymentSchedule) === 'monthly')
    .map((entry) => ({
      ...entry,
      due: Math.max(0, (Number(entry.totalAmount) || 0) - (Number(entry.amountPaid) || 0)),
    }))
    .filter((entry) => entry.due > 0)
    .sort((left, right) => new Date(left.date) - new Date(right.date));
  const balance = payableEntries.reduce((sum, entry) => sum + entry.due, 0);
  let remaining = Number.isFinite(received) ? received : 0;
  const allocations = payableEntries.map((entry) => {
    const applied = Math.min(entry.due, Math.max(0, remaining));
    remaining -= applied;
    return {
      sourceKey: entry.id,
      sourceType: entry.recordType === 'customer_order' ? 'customer_order' : 'sale',
      amount: applied,
    };
  }).filter((allocation) => allocation.amount > 0);
  return { balance, allocations };
}

function buildCustomerCollections(customers) {
  const canonical = (customers || []).map((customer) => ({
    ...customer,
    linkedCustomerId: customer.id,
    source: customer.source || 'admin',
    paymentSchedule: normalizePaymentSchedule(customer.paymentSchedule),
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
  const customerRequest = useRef(null);

  const loadCustomers = useCallback((options = {}) => {
    if (!hasStoredSessionType('admin')) {
      dispatch({ type: 'LOAD', payload: [] });
      return Promise.resolve();
    }
    if (options.silent && customerRequest.current) return customerRequest.current;
    const request = customerApi.getAll()
      .then((data) => {
        const payload = buildCustomerCollections(data || []);
        dispatch({ type: options.silent ? 'SET' : 'LOAD', payload });
      })
      .catch((error) => dispatch({ type: 'ERROR', payload: error.message || 'Could not load cloud data.' }))
      .finally(() => {
        if (customerRequest.current === request) customerRequest.current = null;
      });
    customerRequest.current = request;
    return request;
  }, []);

  useEffect(() => {
    loadCustomers();
    const silentRefresh = () => {
      if (!document.hidden) loadCustomers({ silent: true });
    };
    window.addEventListener(getSessionReadyEventName(), loadCustomers);
    const intervalId = window.setInterval(silentRefresh, 45000);
    document.addEventListener('visibilitychange', silentRefresh);
    window.addEventListener('online', silentRefresh);
    return () => {
      window.removeEventListener(getSessionReadyEventName(), loadCustomers);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', silentRefresh);
      window.removeEventListener('online', silentRefresh);
    };
  }, [loadCustomers]);

  const persist = useCallback(async (customers) => {
    await customerApi.saveAll(customers);
    dispatch({ type: 'SET', payload: customers });
  }, []);

  const addCustomer = useCallback(async (form) => {
    const phone = normalizePhone(form.phone);
    const email = normalizeCustomerEmail(form.email);
    if (state.customers.some((c) => c.phone === phone)) {
      throw new Error('A customer with this phone number already exists');
    }
    if (email && state.customers.some((customer) => (
      normalizeCustomerEmail(customer.email) === email
    ))) {
      throw new Error('A customer with this email address already exists');
    }
    const customer = {
      id: createId(),
      name: form.name.trim(),
      phone,
      address: form.address.trim(),
      email,
      photo: form.photo || '',
      source: 'admin',
      paymentSchedule: normalizePaymentSchedule(form.paymentSchedule),
      createdAt: new Date().toISOString(),
      purchaseHistory: [],
    };
    await persist([...state.customers, customer]);
    return customer;
  }, [state.customers, persist]);

  const updateCustomer = useCallback(async (customerId, form) => {
    const phone = normalizePhone(form.phone);
    const email = normalizeCustomerEmail(form.email);
    if (state.customers.some((customer) => customer.id !== customerId && customer.phone === phone)) {
      throw new Error('A customer with this phone number already exists');
    }
    if (email && state.customers.some((customer) => (
      customer.id !== customerId && normalizeCustomerEmail(customer.email) === email
    ))) {
      throw new Error('A customer with this email address already exists');
    }

    const currentCustomer = state.customers.find((customer) => customer.id === customerId);
    if (!currentCustomer) throw new Error('Customer not found');

    const updatedCustomer = {
      ...currentCustomer,
      name: form.name.trim(),
      phone,
      address: form.address.trim(),
      email,
      photo: form.photo || '',
      source: currentCustomer.source === 'portal' ? 'both' : currentCustomer.source,
      paymentSchedule: form.paymentSchedule === undefined
        ? normalizePaymentSchedule(currentCustomer.paymentSchedule)
        : normalizePaymentSchedule(form.paymentSchedule),
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

  const recordMonthlyPayment = useCallback(async (customerId, amount) => {
    const received = Number(amount);
    const customer = state.customers.find((item) => item.id === customerId);
    if (!customer) throw new Error('Customer not found');
    if (!Number.isFinite(received) || received <= 0) {
      throw new Error('Enter a payment amount greater than zero.');
    }

    const { balance, allocations } = buildMonthlyPaymentPlan(
      customer.purchaseHistory,
      received,
    );
    if (!balance) throw new Error('There is no unpaid recorded sale for this customer.');
    if (received > balance) throw new Error(`Payment cannot be greater than the unpaid balance (${balance}).`);

    await customerApi.recordMonthlyPayment(customerId, received, allocations);
    await loadCustomers();
    return { amountPaid: received, balanceAfter: Math.max(0, balance - received) };
  }, [state.customers, loadCustomers]);

  const deleteTransaction = useCallback(async (customerId, transactionId) => {
    const currentCustomer = state.customers.find((customer) => customer.id === customerId);
    if (!currentCustomer) throw new Error('Customer not found');
    if (!(currentCustomer.purchaseHistory || []).some((transaction) => transaction.id === transactionId)) {
      throw new Error('Sale entry not found');
    }
    await customerApi.deleteTransaction(transactionId);
    dispatch({
      type: 'SET',
      payload: state.customers.map((customer) => (
        customer.id === customerId
          ? {
            ...customer,
            purchaseHistory: (customer.purchaseHistory || []).filter((transaction) => (
              transaction.id !== transactionId
            )),
          }
          : customer
      )),
    });
  }, [state.customers]);

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
    recordMonthlyPayment,
    deleteTransaction,
    refresh,
  }), [state, addCustomer, updateCustomer, deleteCustomer, findByPhone, searchCustomers, addTransaction, recordMonthlyPayment, deleteTransaction, refresh]);

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomers() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomers requires CustomerProvider');
  return ctx;
}
