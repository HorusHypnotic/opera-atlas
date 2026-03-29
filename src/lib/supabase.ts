/**
 * Resilient Supabase client with HYBRID storage:
 * - In-memory cache for synchronous reads (prevents TOKEN_REFRESHED loop)
 * - IndexedDB (localforage) for persistent writes (survives cache wipe)
 *
 * The Supabase SDK internally reads storage immediately after writing.
 * With pure async IndexedDB, the read returns stale data → refresh loop.
 * The in-memory cache ensures reads always return the latest value.
 *
 * ALL app code should import from here instead of the auto-generated client.
 */
import { createClient } from "@supabase/supabase-js";
import localforage from "localforage";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Nuke stale Service Workers AND their caches ──
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      if (regs.length > 0) {
        console.log("[SW] Removing", regs.length, "service worker(s)");
        return Promise.all(regs.map((r) => r.unregister()));
      }
    })
    .then(() =>
      caches.keys().then((keys) => {
        if (keys.length > 0) {
          console.log("[SW] Clearing", keys.length, "cache(s)");
          return Promise.all(keys.map((k) => caches.delete(k)));
        }
      })
    )
    .catch(() => {});
}

// ── Hybrid Storage: in-memory + IndexedDB ──
const authStore = localforage.createInstance({
  name: "opera-auth",
  storeName: "supabase_auth",
});

// In-memory cache — ensures synchronous-like reads
const memoryCache = new Map<string, string>();

// Pre-load IndexedDB into memory cache on startup
authStore.keys().then((keys) => {
  keys.forEach((key) => {
    authStore.getItem<string>(key).then((val) => {
      if (val !== null) memoryCache.set(key, val);
    });
  });
});

const hybridStorage = {
  getItem: async (key: string): Promise<string | null> => {
    // Always return from memory first (instant, prevents stale reads)
    if (memoryCache.has(key)) {
      return memoryCache.get(key)!;
    }
    // Fallback to IndexedDB (first load / cold start)
    const val = await authStore.getItem<string>(key);
    if (val !== null) memoryCache.set(key, val);
    return val;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    // Write to memory FIRST (synchronous), then persist to IndexedDB
    memoryCache.set(key, value);
    await authStore.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    memoryCache.delete(key);
    await authStore.removeItem(key);
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "sb-opera-auth",
    storage: hybridStorage,
  },
});
