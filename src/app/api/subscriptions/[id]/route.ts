import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { SubscriptionService } from "@/server/services/subscription.service";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const sub = await SubscriptionService.getSubscriptionById(session, id);
    return apiSuccess(sub);
  } catch (error) {
    return handleApiError(error);
  }
}
