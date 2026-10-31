import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { PaymentService } from "@/server/services/payment.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const verified = await PaymentService.verifyRazorpayPayment(session, {
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    });
    return apiSuccess(verified);
  } catch (error) {
    return handleApiError(error);
  }
}
