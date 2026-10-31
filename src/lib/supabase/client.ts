import {
  getSupabasePublicKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

export interface SupabaseAuthUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface SupabaseAuthResponse {
  user: SupabaseAuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
}

/**
 * Lightweight, zero-dependency Supabase REST / Auth / Storage / RPC client
 * that works with both standard anon keys and publishable keys, and enforces
 * server-only boundaries for SUPABASE_SERVICE_ROLE_KEY.
 */
export class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly bearerToken: string;

  constructor(baseUrl: string, apiKey: string, bearerToken?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.bearerToken = bearerToken || apiKey;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.bearerToken}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  /**
   * Verifies a Supabase JWT access token against GoTrue `/auth/v1/user`
   */
  async getUser(accessToken?: string): Promise<SupabaseAuthUser | null> {
    const token = accessToken || this.bearerToken;
    if (!token) return null;

    const res = await fetch(`${this.baseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: this.apiKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return (await res.json()) as SupabaseAuthUser;
  }

  /**
   * Signs up a user via Supabase Auth (`/auth/v1/signup`)
   */
  async signUpWithPassword(params: {
    email: string;
    password: string;
    data?: Record<string, unknown>;
  }): Promise<SupabaseAuthResponse> {
    const res = await fetch(`${this.baseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        data: params.data || {},
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        error: json.msg || json.error_description || json.message || "Supabase signup failed",
      };
    }

    return {
      user: (json.user ?? json) as SupabaseAuthUser,
      accessToken: json.access_token ?? null,
      refreshToken: json.refresh_token ?? null,
      error: null,
    };
  }

  /**
   * Signs in a user via Supabase Auth (`/auth/v1/token?grant_type=password`)
   */
  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<SupabaseAuthResponse> {
    const res = await fetch(`${this.baseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        email: params.email,
        password: params.password,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        error: json.error_description || json.msg || json.message || "Invalid credentials",
      };
    }

    return {
      user: json.user as SupabaseAuthUser,
      accessToken: json.access_token ?? null,
      refreshToken: json.refresh_token ?? null,
      error: null,
    };
  }

  /**
   * Server-only Admin API: Creates a verified Supabase Auth user (`/auth/v1/admin/users`)
   */
  async adminCreateUser(params: {
    email: string;
    password: string;
    emailConfirm?: boolean;
    userMetadata?: Record<string, unknown>;
    appMetadata?: Record<string, unknown>;
  }): Promise<{ user: SupabaseAuthUser | null; error: string | null }> {
    if (typeof window !== "undefined") {
      throw new Error("SECURITY_VIOLATION: adminCreateUser is server-only");
    }

    const res = await fetch(`${this.baseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        email_confirm: params.emailConfirm ?? true,
        user_metadata: params.userMetadata || {},
        app_metadata: params.appMetadata || {},
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        user: null,
        error: json.msg || json.message || "Failed to provision Supabase auth user",
      };
    }

    return { user: json as SupabaseAuthUser, error: null };
  }

  /**
   * Invokes a PostgreSQL RPC function via PostgREST (`/rest/v1/rpc/<fn>`)
   */
  async rpc<T = unknown>(fnName: string, args: Record<string, unknown> = {}): Promise<{
    data: T | null;
    error: string | null;
  }> {
    const res = await fetch(`${this.baseUrl}/rest/v1/rpc/${encodeURIComponent(fnName)}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(args),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        data: null,
        error: (json && (json.message || json.details)) || `RPC ${fnName} failed`,
      };
    }
    return { data: json as T, error: null };
  }

  /**
   * Creates a signed URL for a private object in Supabase Storage
   */
  async createSignedUrl(
    bucket: string,
    objectPath: string,
    expiresInSeconds = 300
  ): Promise<{ signedUrl: string | null; error: string | null }> {
    const cleanPath = objectPath.replace(/^\/+/, "");
    const res = await fetch(
      `${this.baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${cleanPath}`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.signedURL) {
      return {
        signedUrl: null,
        error: json.message || json.error || "Failed to generate signed storage URL",
      };
    }

    return {
      signedUrl: `${this.baseUrl}/storage/v1${json.signedURL}`,
      error: null,
    };
  }

  /**
   * Uploads a document to a Supabase Storage bucket
   */
  async uploadStorageObject(params: {
    bucket: string;
    path: string;
    body: Buffer | Uint8Array | string;
    contentType: string;
    upsert?: boolean;
  }): Promise<{ key: string | null; error: string | null }> {
    const cleanPath = params.path.replace(/^\/+/, "");
    const res = await fetch(
      `${this.baseUrl}/storage/v1/object/${encodeURIComponent(params.bucket)}/${cleanPath}`,
      {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          Authorization: `Bearer ${this.bearerToken}`,
          "Content-Type": params.contentType,
          "x-upsert": params.upsert ? "true" : "false",
        },
        body: params.body as BodyInit,
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        key: null,
        error: json.message || json.error || "Storage upload failed",
      };
    }

    return { key: json.Key || `${params.bucket}/${cleanPath}`, error: null };
  }
}

export function createPublicSupabaseClient(accessToken?: string): SupabaseRestClient | null {
  if (!isSupabaseConfigured()) return null;
  const url = getSupabaseUrl()!;
  const publicKey = getSupabasePublicKey()!;
  return new SupabaseRestClient(url, publicKey, accessToken);
}

export function createAdminSupabaseClient(): SupabaseRestClient | null {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY_VIOLATION: createAdminSupabaseClient cannot be called in browser code"
    );
  }
  if (!isSupabaseAdminConfigured()) return null;
  const url = getSupabaseUrl()!;
  const serviceKey = getSupabaseServiceRoleKey()!;
  return new SupabaseRestClient(url, serviceKey, serviceKey);
}
