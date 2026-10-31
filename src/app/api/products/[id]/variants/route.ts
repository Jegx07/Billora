import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { CatalogService } from "@/server/services/catalog.service";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const { id } = await context.params;
    const body = await req.json();
    const variant = await CatalogService.createProductVariant(session, id, body);
    return apiSuccess(variant, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const { variantId, ...rest } = body;
    const updated = await CatalogService.updateProductVariant(session, variantId, rest);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
