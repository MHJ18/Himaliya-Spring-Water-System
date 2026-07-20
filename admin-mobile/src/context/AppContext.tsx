import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { supabase, supabaseKey, supabaseUrl } from '../lib/supabase';
import type { AdminProfile, Customer, Inventory, Invoice, InvoicePayload, Notification, Order, Sale } from '../types';

type Settings = Record<string, any>;
type CustomerInput = Partial<Customer>;
type AppState = {
  session: Session | null; admin: AdminProfile | null; loading: boolean; refreshing: boolean;
  customers: Customer[]; sales: Sale[]; orders: Order[]; invoices: Invoice[]; inventory: Inventory;
  notifications: Notification[]; admins: AdminProfile[]; settings: Settings; prices: Record<string, number>;
  setSession: (session: Session | null) => void; setAdmin: (admin: AdminProfile | null) => void;
  setLoading: (value: boolean) => void; refresh: () => Promise<void>;
  saveCustomer: (input: CustomerInput) => Promise<Customer>; deleteCustomer: (id: string) => Promise<void>;
  recordSale: (input: { customerId: string; bottleType: string; quantity: number; price: number; notes?: string }) => Promise<void>;
  updateOrder: (id: string, status: string, adminNote?: string) => Promise<void>;
  createInvoice: (customer: Customer, history: Sale[]) => Promise<Invoice>;
  updateInvoice: (id: string, patch: Partial<Invoice>) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>; markNotificationsRead: () => Promise<void>;
  saveSettings: (settings: Settings, prices: Record<string, number>, inventory: Inventory) => Promise<void>;
  createAdmin: (input: { name: string; email: string; password: string; role: string }) => Promise<void>;
  deleteAdmin: (target: AdminProfile, ownerPassword: string) => Promise<void>;
  deleteCustomerProfile: (id: string) => Promise<void>;
  resetCustomerPassword: (id: string, password: string, ownerPassword: string) => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);
export const bottleTypes = ['Small Bottle', 'Medium Bottle', 'Large Bottle', 'Gallon'];
const defaultSettings = {
  businessName: 'Himaliya Spring Water', businessPhone: '+92 300 0000000', businessAddress: 'Sialkot Cantt',
  invoiceDueDays: 7, lowStockThreshold: 20, orderCutoffTime: '18:00', autoAcceptOrders: false,
  adminOrderNotifications: true, requireDeliveryConfirmation: true, allowCustomerCancellation: true,
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}
function invoiceNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `HSW-${Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
}
async function rows<T>(query: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await query; if (error) throw error; return data as T;
}

export function AppProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null); const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]); const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]); const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]); const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings); const [prices, setPrices] = useState<Record<string, number>>({});
  const [inventory, setInventory] = useState<Inventory>({});

  const refresh = useCallback(async () => {
    if (!session) return; setRefreshing(true);
    try {
      const [c, s, o, i, n, a, appSettings, bottlePrices, stock] = await Promise.all([
        rows<Customer[]>(supabase.from('customers').select('*').order('created_at', { ascending: false })),
        rows<Sale[]>(supabase.from('sales').select('*,customers(name)').order('created_at', { ascending: false })),
        rows<Order[]>(supabase.from('customer_orders').select('*,customers(*)').order('created_at', { ascending: false })),
        rows<Invoice[]>(supabase.from('customer_invoices').select('*').order('invoice_date', { ascending: false })),
        rows<Notification[]>(supabase.from('customer_notifications').select('*').eq('audience', 'admin').order('created_at', { ascending: false })),
        rows<AdminProfile[]>(supabase.from('admin_profiles').select('*').order('created_at')),
        rows<any[]>(supabase.from('app_settings').select('payload').eq('id', 'main').limit(1)),
        rows<any[]>(supabase.from('bottle_prices').select('bottle_type,price').order('bottle_type')),
        rows<any[]>(supabase.from('inventory_stock').select('bottle_type,quantity').order('bottle_type')),
      ]);
      setCustomers(c); setSales(s); setOrders(o); setInvoices(i); setNotifications(n); setAdmins(a);
      setSettings({ ...defaultSettings, ...(appSettings[0]?.payload || {}) });
      setPrices(Object.fromEntries(bottlePrices.map(x => [x.bottle_type, Number(x.price)])));
      setInventory(Object.fromEntries(stock.map(x => [x.bottle_type, Number(x.quantity)])));
    } finally { setRefreshing(false); }
  }, [session]);

  const saveCustomer = useCallback(async (input: CustomerInput) => {
    const body = { id: input.id || uuid(), name: input.name?.trim(), phone: input.phone?.trim(), email: input.email?.trim().toLowerCase() || '', address: input.address?.trim() || '', photo: input.photo || '', source: input.source || 'admin', updated_at: new Date().toISOString(), ...(!input.id ? { created_at: new Date().toISOString() } : {}) };
    const result = await rows<Customer[]>(supabase.from('customers').upsert(body).select()); await refresh(); return result[0];
  }, [refresh]);
  const deleteCustomer = useCallback(async (id: string) => { await rows(supabase.from('customers').delete().eq('id', id).select('id')); await refresh(); }, [refresh]);
  const recordSale = useCallback(async (input: { customerId: string; bottleType: string; quantity: number; price: number; notes?: string }) => {
    await rows(supabase.from('sales').insert({ id: uuid(), customer_id: input.customerId, bottle_type: input.bottleType, quantity: input.quantity, price_per_bottle: input.price, total_amount: input.quantity * input.price, notes: input.notes || '', created_at: new Date().toISOString() }).select()); await refresh();
  }, [refresh]);
  const updateOrder = useCallback(async (id: string, status: string, adminNote = '') => {
    const patch: Record<string, any> = { status, admin_note: adminNote, updated_at: new Date().toISOString() };
    if (status === 'accepted') patch.accepted_at = new Date().toISOString(); if (status === 'delivered') patch.delivered_at = new Date().toISOString();
    await rows(supabase.from('customer_orders').update(patch).eq('id', id).select()); await refresh();
  }, [refresh]);

  const createInvoice = useCallback(async (customer: Customer, history: Sale[]) => {
    if (!history.length) throw new Error('Select a period containing at least one sale.');
    const issuedAt = new Date(); const dueAt = new Date(issuedAt); dueAt.setDate(dueAt.getDate() + Math.max(0, Number(settings.invoiceDueDays) || 0));
    const payload: InvoicePayload = {
      company: { name: settings.businessName, phone: settings.businessPhone, address: settings.businessAddress },
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, address: customer.address },
      preparedBy: { name: admin?.name || 'Himaliya Admin', email: admin?.email || '', role: admin?.role || 'Admin' },
      history: history.map(x => ({ date: x.created_at, bottleType: x.bottle_type, quantity: Number(x.quantity), pricePerBottle: Number(x.price_per_bottle), totalAmount: Number(x.total_amount) })),
      summary: { entryCount: history.length, totalAmount: history.reduce((a, x) => a + Number(x.total_amount), 0), totalQty: history.reduce((a, x) => a + Number(x.quantity), 0), issuedAt: issuedAt.toISOString(), dueDate: dueAt.toISOString(), paymentTermsDays: Math.max(0, Number(settings.invoiceDueDays) || 0) },
    };
    const created = await rows<Invoice[]>(supabase.from('customer_invoices').insert({ customer_id: customer.id, invoice_number: invoiceNumber(), invoice_date: issuedAt.toISOString(), payload, total_amount: payload.summary.totalAmount, total_qty: payload.summary.totalQty, payment_status: 'unpaid', validated: false }).select());
    await refresh(); return created[0];
  }, [admin, refresh, settings]);
  const updateInvoice = useCallback(async (id: string, patch: Partial<Invoice>) => { await rows(supabase.from('customer_invoices').update(patch).eq('id', id).select()); await refresh(); }, [refresh]);
  const markNotificationRead = useCallback(async (id: string) => { await rows(supabase.from('customer_notifications').update({ read: true }).eq('id', id).select('id')); await refresh(); }, [refresh]);
  const markNotificationsRead = useCallback(async () => { await rows(supabase.from('customer_notifications').update({ read: true }).eq('audience', 'admin').eq('read', false).select('id')); await refresh(); }, [refresh]);
  const saveSettings = useCallback(async (next: Settings, nextPrices: Record<string, number>, nextInventory: Inventory) => {
    await rows(supabase.from('app_settings').upsert({ id: 'main', payload: next, updated_at: new Date().toISOString() }, { onConflict: 'owner_id,id' }).select());
    await rows(supabase.from('bottle_prices').upsert(bottleTypes.map(bottle_type => ({ bottle_type, price: Number(nextPrices[bottle_type] || 0), updated_at: new Date().toISOString() })), { onConflict: 'owner_id,bottle_type' }).select());
    await rows(supabase.from('inventory_stock').upsert(bottleTypes.map(bottle_type => ({ bottle_type, quantity: Math.max(0, Number(nextInventory[bottle_type] || 0)), updated_at: new Date().toISOString() })), { onConflict: 'owner_id,bottle_type' }).select()); await refresh();
  }, [refresh]);

  const createAdmin = useCallback(async (input: { name: string; email: string; password: string; role: string }) => {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, { method: 'POST', headers: { apikey: supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: input.email.trim().toLowerCase(), password: input.password }) });
    const body = await response.json(); if (!response.ok || !body.user?.id) throw new Error(body.msg || body.message || 'Could not create auth user.');
    await rows(supabase.from('admin_profiles').upsert({ auth_user_id: body.user.id, name: input.name.trim(), email: input.email.trim().toLowerCase(), role: input.role, active: true }, { onConflict: 'auth_user_id' }).select()); await refresh();
  }, [refresh]);
  const deleteAdmin = useCallback(async (target: AdminProfile, ownerPassword: string) => {
    if (target.id === admin?.id) throw new Error('You cannot delete your signed-in account.');
    const owners = admins.filter(x => x.role === 'Owner'); if (target.role === 'Owner' && owners.length <= 1) throw new Error('At least one owner must remain.');
    const verifier = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const owner = owners[0]; const { error } = await verifier.auth.signInWithPassword({ email: owner.email, password: ownerPassword }); if (error) throw new Error('Owner password is incorrect.');
    await rows(supabase.from('admin_profiles').delete().eq('id', target.id).select('id')); await refresh();
  }, [admin?.id, admins, refresh]);
  const deleteCustomerProfile = useCallback(async (id: string) => { await rows(supabase.from('customers').delete().eq('id', id).select('id')); await refresh(); }, [refresh]);
  const resetCustomerPassword = useCallback(async (id: string, password: string, ownerPassword: string) => {
    const base = process.env.EXPO_PUBLIC_ADMIN_API_URL; if (!base) throw new Error('Configure EXPO_PUBLIC_ADMIN_API_URL to use server-side password reset.');
    const response = await fetch(`${base.replace(/\/$/, '')}/.netlify/functions/admin-reset-user-password`, { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: id, password, ownerPassword }) });
    const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || 'Could not reset customer password.');
  }, [session?.access_token]);

  const value = useMemo(() => ({ session, admin, loading, refreshing, customers, sales, orders, invoices, inventory, notifications, admins, settings, prices, setSession, setAdmin, setLoading, refresh, saveCustomer, deleteCustomer, recordSale, updateOrder, createInvoice, updateInvoice, markNotificationRead, markNotificationsRead, saveSettings, createAdmin, deleteAdmin, deleteCustomerProfile, resetCustomerPassword }), [session, admin, loading, refreshing, customers, sales, orders, invoices, inventory, notifications, admins, settings, prices, refresh, saveCustomer, deleteCustomer, recordSale, updateOrder, createInvoice, updateInvoice, markNotificationRead, markNotificationsRead, saveSettings, createAdmin, deleteAdmin, deleteCustomerProfile, resetCustomerPassword]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('useApp must be used inside AppProvider'); return value; }
