/**
 * Resilient Supabase client that uses IndexedDB (via localforage) for session
 * persistence. This fixes the mobile PWA issue where localStorage is cleared
 * after cache wipe, causing session loss.
 *
 * ALL app code should import from here instead of the auto-generated client.
 */
import { createClient } from "@supabase/supabase-js";
import localforage from "localforage";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Configure localforage to use IndexedDB (falls back to WebSQL/localStorage)
const authStore = localforage.createInstance({
  name: "opera-auth",
  storeName: "supabase_auth",
});

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "sb-opera-auth",
    storage: {
      getItem: (key) => authStore.getItem(key),
      setItem: (key, value) => authStore.setItem(key, value),
      removeItem: (key) => authStore.removeItem(key),
    },
  },
});
