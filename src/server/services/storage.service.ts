import {
  createAdminSupabaseClient,
  createPublicSupabaseClient,
} from "@/lib/supabase/client";
import { getSupabaseConfigStatus, isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { assertCustomerAccess, AuthSessionContext } from "@/server/middlewares/auth";
import { AuditService } from "@/server/services/audit.service";

export type StorageBucketName =
  | "invoice-documents"
  | "customer-documents"
  | "profile-images";

export class StorageService {
  static readonly BUCKETS: StorageBucketName[] = [
    "invoice-documents",
    "customer-documents",
    "profile-images",
  ];

  /**
   * Enforces strict role & tenant isolation before issuing a signed URL or allowing upload
   * to any private Supabase Storage bucket (Phase 8).
   */
  static async authorizeBucketObjectAccess(
    session: AuthSessionContext,
    bucket: StorageBucketName,
    objectPath: string,
    mode: "READ" | "WRITE"
  ): Promise<{ resolvedPath: string; ownerCustomerId?: string | null }> {
    const cleanPath = objectPath.replace(/^\/+/, "");
    if (!cleanPath || cleanPath.includes("..")) {
      throw new AppError("VALIDATION_ERROR", "Invalid storage object path", 400);
    }

    if (bucket === "invoice-documents") {
      if (mode === "WRITE" && session.role === "CUSTOMER") {
        throw new AppError(
          "FORBIDDEN",
          "Customers are not permitted to upload or overwrite invoice documents",
          403
        );
      }

      // Path convention: <customerId>/<invoiceId>.pdf or <invoiceId>.pdf
      const segments = cleanPath.split("/");
      const invoiceIdentifier = (segments[segments.length - 1] || "").replace(/\.pdf$/i, "");

      const invoice = await prisma.invoice.findFirst({
        where: {
          OR: [{ id: invoiceIdentifier }, { invoiceNumber: invoiceIdentifier }],
        },
        select: { id: true, customerId: true, invoiceNumber: true },
      });

      if (invoice) {
        assertCustomerAccess(session, invoice.customerId);
        return {
          resolvedPath: `${invoice.customerId}/${invoice.invoiceNumber}.pdf`,
          ownerCustomerId: invoice.customerId,
        };
      }

      // If path starts with customerId prefix, verify customer ownership
      if (segments.length >= 2) {
        assertCustomerAccess(session, segments[0]);
      } else if (session.role === "CUSTOMER") {
        throw new AppError("FORBIDDEN", "Access denied to requested invoice document", 403);
      }

      return { resolvedPath: cleanPath };
    }

    if (bucket === "customer-documents") {
      // Path convention: <customerId>/<filename>
      const segments = cleanPath.split("/");
      const targetCustomerId = segments[0];
      if (!targetCustomerId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Customer document path must be scoped by customerId",
          400
        );
      }

      assertCustomerAccess(session, targetCustomerId);
      return {
        resolvedPath: cleanPath,
        ownerCustomerId: targetCustomerId,
      };
    }

    if (bucket === "profile-images") {
      // Path convention: <userId>/<filename>
      const segments = cleanPath.split("/");
      const targetUserId = segments[0];
      if (
        mode === "WRITE" &&
        session.role !== "ADMIN" &&
        targetUserId !== session.userId
      ) {
        throw new AppError(
          "FORBIDDEN",
          "Users may only upload or modify their own profile image",
          403
        );
      }
      return { resolvedPath: cleanPath };
    }

    throw new AppError("VALIDATION_ERROR", `Unsupported storage bucket '${bucket}'`, 400);
  }

  /**
   * Generates a time-limited signed URL for private document access.
   * For `invoice-documents`, falls back to the authenticated server-side PDF route
   * if Supabase Storage credentials are not yet configured in `.env`.
   */
  static async createSignedDocumentUrl(
    session: AuthSessionContext,
    params: {
      bucket: StorageBucketName;
      objectPath: string;
      expiresInSeconds?: number;
    }
  ) {
    const expiresIn = Math.min(Math.max(params.expiresInSeconds ?? 300, 60), 3600);
    const { resolvedPath } = await this.authorizeBucketObjectAccess(
      session,
      params.bucket,
      params.objectPath,
      "READ"
    );

    const client = isSupabaseAdminConfigured()
      ? createAdminSupabaseClient()
      : createPublicSupabaseClient();

    if (client) {
      const { signedUrl, error } = await client.createSignedUrl(
        params.bucket,
        resolvedPath,
        expiresIn
      );
      if (signedUrl) {
        await AuditService.log({
          actorId: session.userId,
          actorRole: session.role,
          action: "STORAGE_SIGNED_URL_ISSUED",
          entityType: "StorageObject",
          entityId: `${params.bucket}/${resolvedPath}`,
          afterData: { bucket: params.bucket, expiresIn },
        });
        return {
          bucket: params.bucket,
          objectPath: resolvedPath,
          signedUrl,
          expiresIn,
          provider: "SUPABASE_STORAGE" as const,
        };
      }

      // If object not yet uploaded to remote bucket and it's an invoice PDF, return local authenticated stream URL
      if (params.bucket === "invoice-documents") {
        const invId = params.objectPath.split("/").pop()?.replace(/\.pdf$/i, "") || "";
        return {
          bucket: params.bucket,
          objectPath: resolvedPath,
          signedUrl: `/api/invoices/${encodeURIComponent(invId)}/pdf`,
          expiresIn,
          provider: "LOCAL_AUTHENTICATED_FALLBACK" as const,
          note: error || "Object not yet uploaded to remote bucket; using authenticated PDF endpoint",
        };
      }
    }

    const configStatus = getSupabaseConfigStatus();
    if (params.bucket === "invoice-documents") {
      const invId = params.objectPath.split("/").pop()?.replace(/\.pdf$/i, "") || "";
      return {
        bucket: params.bucket,
        objectPath: resolvedPath,
        signedUrl: `/api/invoices/${encodeURIComponent(invId)}/pdf`,
        expiresIn,
        provider: "LOCAL_AUTHENTICATED_FALLBACK" as const,
        supabaseConfigured: configStatus.isConfigured,
      };
    }

    throw new AppError(
      "VALIDATION_ERROR",
      "Supabase Storage is not configured. Provide NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.",
      400
    );
  }
}
