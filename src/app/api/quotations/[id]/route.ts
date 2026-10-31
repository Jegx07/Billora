import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { QuotationService } from "@/server/services/quotation.service";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const quotation = await QuotationService.getQuotationById(session, id);
    return apiSuccess(quotation);
  } catch (error) {
    return handleApiError(error);
  }
}
