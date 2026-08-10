import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const configured = Boolean(supabaseUrl && supabaseKey);

// Supabase sessions contain privileged staff/rider refresh tokens. Keep them
// in the platform Keychain/Keystore, not in the SQLite localStorage shim. The
// shim remains temporarily so existing installs can migrate their old session
// once, after which the plaintext entry is removed.
const legacyStorage = globalThis.localStorage;
const secureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const authStorage = {
  async getItem(key: string) {
    const secured = await SecureStore.getItemAsync(key);
    if (secured !== null) return secured;

    const legacy = legacyStorage?.getItem(key) ?? null;
    if (legacy !== null) {
      await SecureStore.setItemAsync(key, legacy, secureStoreOptions);
      legacyStorage?.removeItem(key);
    }
    return legacy;
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value, secureStoreOptions);
    legacyStorage?.removeItem(key);
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key);
    legacyStorage?.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder', {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

AppState.addEventListener('change', (state) => {
  if (!configured) return;
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
