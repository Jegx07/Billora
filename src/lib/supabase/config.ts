/**
 * Centralized Supabase Configuration & Environment Validator
 * Supports standard NEXT_PUBLIC_SUPABASE_ANON_KEY and newer
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY formats.
 * Strictly guards SUPABASE_SERVICE_ROLE_KEY from client-side access.
 */

export interface SupabaseConfigStatus {
  mode: "SUPABASE_CLOUD_OR_SELF_HOSTED" | "LOCAL_CENTRALIZED_DB";
  isConfigured: boolean;
  isLiveReady: boolean;
  isAdminReady: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasAnonOrPublishableKey: boolean;
  hasServiceRoleKey: boolean;
  isPostgresDatabaseUrl: boolean;
  url: string | null;
  buckets: {
    invoiceDocuments: string;
    customerDocuments: string;
    profileImages: string;
  };
  missingVariables: string[];
}

const PLACEHOLDER_VALUES = new Set([
  "",
  "your-supabase-url",
  "your-supabase-anon-key",
  "your-service-role-key",
  "undefined",
  "null",
]);

function isNonEmptySecret(val?: string | null): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return trimmed.length > 0 && !PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
}

function ensureServerEnvLoaded() {
  if (typeof window !== "undefined") return;
  if (
    isNonEmptySecret(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (isNonEmptySecret(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
      isNonEmptySecret(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  ) {
    return;
  }
  try {
    // Dynamically read .env so running dev servers pick up newly added Supabase keys without restart
    const fs = require("fs");
    const path = require("path");
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!isNonEmptySecret(process.env[key]) && val) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore in edge/browser runtimes
  }
}

export function getSupabasePublicKey(): string {
  ensureServerEnvLoaded();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (isNonEmptySecret(publishable)) return publishable.trim();

  const publishableDefault = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (isNonEmptySecret(publishableDefault)) return publishableDefault.trim();

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isNonEmptySecret(anon)) return anon.trim();

  return "";
}

export function getSupabaseUrl(): string | null {
  ensureServerEnvLoaded();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isNonEmptySecret(url)) return null;
  return url.trim().replace(/\/+$/, "");
}

/**
 * Server-only helper to retrieve the Supabase service role key.
 * Throws immediately if invoked in a browser environment.
 */
export function getSupabaseServiceRoleKey(): string | null {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY_VIOLATION: SUPABASE_SERVICE_ROLE_KEY must never be accessed in client/browser code."
    );
  }
  ensureServerEnvLoaded();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return isNonEmptySecret(key) ? key.trim() : null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublicKey());
}

export function isSupabaseAdminConfigured(): boolean {
  if (typeof window !== "undefined") return false;
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  ensureServerEnvLoaded();
  const url = getSupabaseUrl();
  const anonKey = getSupabasePublicKey();
  const serviceKey = typeof window === "undefined" ? getSupabaseServiceRoleKey() : null;
  const dbUrl = process.env.DATABASE_URL || "";

  const missingVariables: string[] = [];
  if (!url) missingVariables.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) {
    missingVariables.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }
  if (typeof window === "undefined" && !serviceKey) {
    missingVariables.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  const isConfigured = Boolean(url && anonKey);
  const isAdminReady = Boolean(url && serviceKey);

  return {
    mode: isConfigured ? "SUPABASE_CLOUD_OR_SELF_HOSTED" : "LOCAL_CENTRALIZED_DB",
    isConfigured,
    isLiveReady: isConfigured,
    isAdminReady,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    hasAnonOrPublishableKey: Boolean(anonKey),
    hasServiceRoleKey: Boolean(serviceKey),
    isPostgresDatabaseUrl:
      dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"),
    url: url ? `${url.slice(0, 42)}` : null,
    buckets: {
      invoiceDocuments:
        process.env.SUPABASE_STORAGE_BUCKET_INVOICES || "invoice-documents",
      customerDocuments:
        process.env.SUPABASE_STORAGE_BUCKET_CUSTOMERS || "customer-documents",
      profileImages:
        process.env.SUPABASE_STORAGE_BUCKET_PROFILES || "profile-images",
    },
    missingVariables,
  };
}
