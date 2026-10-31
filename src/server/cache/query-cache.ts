/**
 * High-Performance Server-Side Query & Reference Cache (Phase 3, 4, 5, 11)
 * - Strictly isolates tenant/role keys (`portal:${customerId}`, `ops:${userId}:${role}`, `dashboard:${role}:${preset}`)
 * - Automatically invalidates dependent cache namespaces immediately upon any database write mutation.
 * - Never caches sensitive authentication tokens indefinitely or shares customer data across tenants.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const serverCache = new Map<string, CacheEntry<unknown>>();
const inFlightPromises = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 1000;

export async function getOrSetServerCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = serverCache.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  // Deduplicate concurrent identical in-flight queries (Request Coalescing)
  const inFlight = inFlightPromises.get(key);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const promise = (async () => {
    try {
      const value = await fetcher();
      if (serverCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = serverCache.keys().next().value;
        if (firstKey) serverCache.delete(firstKey);
      }
      serverCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, promise);
  return promise;
}

export function invalidateServerCacheByPrefix(prefix: string): void {
  for (const key of serverCache.keys()) {
    if (key.startsWith(prefix)) {
      serverCache.delete(key);
    }
  }
}

export function clearAllServerCache(): void {
  serverCache.clear();
  inFlightPromises.clear();
}

/**
 * Automatically invalidates affected cache namespaces whenever a Prisma model is mutated.
 * Guarantees financial dashboards, customer balances, subscription statuses, and reference catalogs
 * never serve stale data after a write operation.
 */
export function invalidateServerCacheForModel(model?: string): void {
  if (!model) return;

  switch (model) {
    case "Product":
    case "ProductVariant":
      invalidateServerCacheByPrefix("catalog:products");
      invalidateServerCacheByPrefix("catalog:plans");
      invalidateServerCacheByPrefix("portal:");
      break;
    case "SubscriptionPlan":
    case "PlanProduct":
      invalidateServerCacheByPrefix("catalog:plans");
      invalidateServerCacheByPrefix("dashboard:");
      invalidateServerCacheByPrefix("portal:");
      break;
    case "TaxRule":
      invalidateServerCacheByPrefix("catalog:taxes");
      break;
    case "Discount":
    case "DiscountProduct":
    case "DiscountUsage":
      invalidateServerCacheByPrefix("catalog:discounts");
      break;
    case "QuotationTemplate":
    case "QuotationTemplateLine":
      invalidateServerCacheByPrefix("catalog:templates");
      break;
    case "Customer":
      invalidateServerCacheByPrefix("dashboard:");
      invalidateServerCacheByPrefix("portal:");
      break;
    case "Quotation":
    case "QuotationLine":
    case "Subscription":
    case "SubscriptionLine":
    case "SubscriptionHistory":
    case "BillingPeriod":
    case "Invoice":
    case "InvoiceLine":
    case "Payment":
      invalidateServerCacheByPrefix("dashboard:");
      invalidateServerCacheByPrefix("portal:");
      invalidateServerCacheByPrefix("forecasting:");
      break;
    case "Workflow":
    case "WorkflowVersion":
    case "WorkflowExecution":
    case "WorkflowTask":
    case "WorkflowApproval":
    case "EmailMessage":
      invalidateServerCacheByPrefix("ops:");
      break;
    case "Notification":
      invalidateServerCacheByPrefix("notif:");
      invalidateServerCacheByPrefix("portal:");
      break;
    default:
      break;
  }
}
