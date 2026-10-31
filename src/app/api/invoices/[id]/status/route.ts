import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { InvoiceService } from "@/server/services/invoice.service";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id } = await context.params;
    const body = await req.json();
    const updated = await InvoiceService.updateInvoiceStatus(session, id, body.action);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
