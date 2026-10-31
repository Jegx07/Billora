import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createPublicSupabaseClient } from "@/lib/supabase/client";

export type UserRole = "ADMIN" | "EMPLOYEE" | "CUSTOMER";

export interface AuthSessionContext {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  customerId: string | null;
  employeeId: string | null;
  csrfToken: string;
  sessionId: string;
  authProvider?: "CENTRALIZED_DB" | "SUPABASE_AUTH";
}

export const SESSION_COOKIE_NAME = "billora_session";
export const SUPABASE_ACCESS_COOKIE_NAME = "sb-access-token";

/**
 * Cryptographic password hashing using Node.js native Scrypt (memory-hard KDF, RFC 7914)
 * with 16-byte random salt and timingSafeEqual comparison.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const [, salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

// Simple in-memory rate limiter for auth routes
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 25, windowMs = 60_000) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > maxRequests) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please try again later.", 429);
  }
}

/**
 * Resolves a Supabase Auth JWT into a trusted Billora database session context.
 * Role assignment is NEVER trusted from client claims alone — it is always verified
 * against the centralized database `User` -> `Role` record.
 */
async function resolveSupabaseJwtSession(rawJwt: string): Promise<AuthSessionContext | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;

  const sbUser = await supabase.getUser(rawJwt);
  if (!sbUser || !sbUser.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { email: sbUser.email.toLowerCase() },
    include: {
      role: true,
      customer: true,
      employee: true,
    },
  });

  if (!dbUser) return null;
  if (dbUser.status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", `Account status is ${dbUser.status}`, 403);
  }

  return {
    userId: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.fullName,
    role: dbUser.role.name as UserRole,
    customerId: dbUser.customer?.id ?? null,
    employeeId: dbUser.employee?.id ?? null,
    csrfToken: hashToken(rawJwt).slice(0, 32),
    sessionId: `sb_${sbUser.id}`,
    authProvider: "SUPABASE_AUTH",
  };
}

/**
 * Resolves the authenticated session from either:
 * 1. The HTTP-only `billora_session` cookie or `Authorization: Bearer <token>` header
 * 2. A verified Supabase Auth JWT (`sb-access-token` cookie or Bearer JWT when Supabase is configured)
 * Role and tenant ownership (`customerId`, `employeeId`) are always resolved from trusted database records.
 */
export async function getSessionFromRequest(req?: NextRequest): Promise<AuthSessionContext | null> {
  let rawToken: string | undefined;
  let sbToken: string | undefined;

  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      rawToken = authHeader.slice(7).trim();
    } else {
      rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    }
    sbToken = req.cookies.get(SUPABASE_ACCESS_COOKIE_NAME)?.value;
  } else {
    try {
      const cookieStore = await cookies();
      rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      sbToken = cookieStore.get(SUPABASE_ACCESS_COOKIE_NAME)?.value;
    } catch {
      rawToken = undefined;
      sbToken = undefined;
    }
  }

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            role: true,
            customer: true,
            employee: true,
          },
        },
      },
    });

    if (session) {
      if (session.expiresAt.getTime() < Date.now()) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
        return null;
      }

      if (session.user.status !== "ACTIVE") {
        throw new AppError("FORBIDDEN", `Account status is ${session.user.status}`, 403);
      }

      return {
        userId: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        role: session.user.role.name as UserRole,
        customerId: session.user.customer?.id ?? null,
        employeeId: session.user.employee?.id ?? null,
        csrfToken: session.csrfToken,
        sessionId: session.id,
        authProvider: "CENTRALIZED_DB",
      };
    }

    // If rawToken is a 3-segment JWT and Supabase is configured, verify via Supabase Auth
    if (rawToken.split(".").length === 3) {
      const sbSession = await resolveSupabaseJwtSession(rawToken);
      if (sbSession) return sbSession;
    }
  }

  if (sbToken) {
    const sbSession = await resolveSupabaseJwtSession(sbToken);
    if (sbSession) return sbSession;
  }

  return null;
}

export async function requireAuth(
  req?: NextRequest,
  allowedRoles?: UserRole[]
): Promise<AuthSessionContext> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new AppError(
      "FORBIDDEN",
      `Role '${session.role}' is not authorized to perform this action`,
      403
    );
  }
  return session;
}

/**
 * Enforces strict tenant isolation for CUSTOMER users.
 * If a CUSTOMER attempts to access a resource belonging to another customerId, throws 403 FORBIDDEN.
 */
export function assertCustomerAccess(
  session: AuthSessionContext,
  resourceCustomerId: string
): void {
  if (session.role === "CUSTOMER") {
    if (!session.customerId || session.customerId !== resourceCustomerId) {
      throw new AppError(
        "FORBIDDEN",
        "Access denied: You are not authorized to access another customer's records",
        403
      );
    }
  }
}

/**
 * Enforces customer + employee assignment scope when strict employee assignment scoping is required.
 */
export function assertRoleAndCustomerScope(
  session: AuthSessionContext,
  resourceCustomerId: string,
  assignedEmployeeId?: string | null
): void {
  if (session.role === "CUSTOMER") {
    assertCustomerAccess(session, resourceCustomerId);
    return;
  }
  if (
    session.role === "EMPLOYEE" &&
    assignedEmployeeId &&
    session.employeeId &&
    assignedEmployeeId !== session.employeeId
  ) {
    // Employees can manage unassigned customers or customers assigned to them
    throw new AppError(
      "FORBIDDEN",
      "Access denied: This customer is assigned to another employee",
      403
    );
  }
}
