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
    const body = await req.json();
    const updated = await QuotationService.updateQuotationStatus(session, id, body.status);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
