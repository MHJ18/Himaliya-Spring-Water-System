/* Data backend registry.
 *
 * Everything the app persists currently goes to Supabase. This module is the
 * seam that makes swapping that out a contained change instead of a rewrite:
 * a backend declares itself here, and callers ask the registry for a request
 * function rather than importing a Supabase client directly.
 *
 * The selected backend is stored in localStorage, NOT in app_settings. Storing
 * it in the database would be circular - you would have to already know which
 * database to read in order to find out which database to read.
 *
 * ---------------------------------------------------------------------------
 * Adding a backend
 * ---------------------------------------------------------------------------
 * Append an entry to BACKENDS with:
 *
 *   id          stable string, persisted on the device
 *   label       shown in Settings > Data & security
 *   description one line explaining the trade-off to an operator
 *   isAvailable () => boolean   can this device actually use it right now
 *   unavailableReason () => string  shown when isAvailable() is false
 *   request     async (path, options) => data
 *
 * `request` must match the PostgREST-shaped contract the app already speaks:
 * a resource path such as '/customers?select=*', plus { method, body, prefer,
 * headers }, resolving to parsed JSON. Implementing that contract is what makes
 * a new backend a drop-in; anything else means touching every call site.
 */

import { dbRequest, isSupabaseConfigured } from '../cloud/supabaseClient';

const ACTIVE_BACKEND_KEY = 'hs_data_backend';
export const DEFAULT_BACKEND_ID = 'supabase';

const BACKENDS = [
  {
    id: 'supabase',
    label: 'Supabase cloud',
    description: 'Shared PostgreSQL database. Every device sees the same data in real time.',
    shared: true,
    isAvailable: () => isSupabaseConfigured(),
    unavailableReason: () => 'Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY, then reload.',
    request: (path, options) => dbRequest(path, options),
  },
  {
    id: 'device',
    label: 'This device only',
    description: 'Keeps data in browser storage. Nothing syncs between devices or staff.',
    shared: false,
    // Declared so the switch, the persistence, and the UI are all in place and
    // proven. It stays unselectable until an adapter implements `request`.
    isAvailable: () => false,
    unavailableReason: () => 'No local adapter is installed yet. Add one to BACKENDS in services/data/dataBackends.js.',
    request: () => {
      throw new Error('The device backend has no adapter installed.');
    },
  },
];

export function listBackends() {
  return BACKENDS.map((backend) => ({
    id: backend.id,
    label: backend.label,
    description: backend.description,
    shared: backend.shared,
    available: Boolean(backend.isAvailable()),
    unavailableReason: backend.isAvailable() ? '' : backend.unavailableReason(),
  }));
}

function findBackend(id) {
  return BACKENDS.find((backend) => backend.id === id) || null;
}

function readStoredBackendId() {
  try {
    return window.localStorage.getItem(ACTIVE_BACKEND_KEY) || '';
  } catch {
    return '';
  }
}

/* The id of the backend actually in use. A stored id that is missing or no
 * longer usable falls back to the default, so a bad value can never lock the
 * operator out of their own data. */
export function getActiveBackendId() {
  const stored = readStoredBackendId();
  const backend = findBackend(stored);
  if (backend && backend.isAvailable()) return backend.id;
  return DEFAULT_BACKEND_ID;
}

export function getActiveBackend() {
  return findBackend(getActiveBackendId()) || findBackend(DEFAULT_BACKEND_ID);
}

/* True when a stored preference could not be honoured, so the UI can say so
 * instead of silently showing a different backend than the one selected. */
export function hasUnavailableSelection() {
  const stored = readStoredBackendId();
  if (!stored || stored === getActiveBackendId()) return false;
  return true;
}

export function setActiveBackend(id) {
  const backend = findBackend(id);
  if (!backend) throw new Error(`Unknown data backend "${id}".`);
  if (!backend.isAvailable()) throw new Error(backend.unavailableReason());
  try {
    window.localStorage.setItem(ACTIVE_BACKEND_KEY, backend.id);
  } catch {
    throw new Error('This browser blocked storage, so the data source could not be changed.');
  }
  return backend.id;
}

/* Single entry point for persistence. New code should call this instead of
 * importing dbRequest, so a backend switch reaches it without further edits. */
export function dataRequest(path, options) {
  return getActiveBackend().request(path, options);
}
