import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { SubscriptionService } from "@/server/services/subscription.service";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    const updated = await SubscriptionService.transitionStatus(session, id, body);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
