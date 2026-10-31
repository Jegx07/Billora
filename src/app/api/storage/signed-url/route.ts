import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { StorageBucketName, StorageService } from "@/server/services/storage.service";
import { NextRequest } from "next/server";
import { z } from "zod";

const signedUrlRequestSchema = z.object({
  bucket: z.enum(["invoice-documents", "customer-documents", "profile-images"]),
  objectPath: z.string().trim().min(1, "objectPath is required"),
  expiresInSeconds: z.coerce.number().int().min(60).max(3600).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const input = signedUrlRequestSchema.parse(body);

    const result = await StorageService.createSignedDocumentUrl(session, {
      bucket: input.bucket as StorageBucketName,
      objectPath: input.objectPath,
      expiresInSeconds: input.expiresInSeconds,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
