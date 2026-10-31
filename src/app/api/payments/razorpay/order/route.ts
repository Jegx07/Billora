import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { PaymentService } from "@/server/services/payment.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const order = await PaymentService.createRazorpayOrder(
      session,
      body.invoiceId,
      body.amount ? Number(body.amount) : undefined
    );
    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
