import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";

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
}

export const SESSION_COOKIE_NAME = "billora_session";

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
 * Resolves the authenticated session from either the HTTP-only cookie or the `Authorization: Bearer <token>` header
 * (supporting both browser requests and integration test assertions).
 */
export async function getSessionFromRequest(req?: NextRequest): Promise<AuthSessionContext | null> {
  let rawToken: string | undefined;

  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      rawToken = authHeader.slice(7).trim();
    } else {
      rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    }
  } else {
    try {
      const cookieStore = await cookies();
      rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      rawToken = undefined;
    }
  }

  if (!rawToken) return null;

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

  if (!session) return null;
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
  };
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
