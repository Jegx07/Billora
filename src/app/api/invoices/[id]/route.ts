import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { InvoiceService } from "@/server/services/invoice.service";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const invoice = await InvoiceService.getInvoiceById(session, id);
    return apiSuccess(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
