"use client";

/**
 * Lightweight Client-Side Stale-While-Revalidate (SWR) Memory Cache
 * Eliminates redundant loading spinners when navigating back and forth between
 * Dashboard, Customers, Products, Plans, Quotations, Subscriptions, Invoices, and Payments.
 */

interface ClientCacheEntry<T = any> {
  data: T;
  meta?: any;
  timestamp: number;
}

const memoryCache = new Map<string, ClientCacheEntry>();

export function getClientCache<T = any>(key: string, maxAgeMs = 60_000): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    return null;
  }
  return entry.data as T;
}

export function setClientCache<T = any>(key: string, data: T, meta?: any): void {
  memoryCache.set(key, {
    data,
    meta,
    timestamp: Date.now(),
  });
}

export function invalidateClientCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k);
    }
  }
}
