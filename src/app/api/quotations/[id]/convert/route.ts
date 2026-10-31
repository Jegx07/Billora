import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { QuotationService } from "@/server/services/quotation.service";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const subscription = await QuotationService.convertToSubscription(session, id, {
      activateImmediately: Boolean(body.activateImmediately ?? true),
      startDate: body.startDate ? new Date(body.startDate) : undefined,
    });
    return apiSuccess(subscription, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
