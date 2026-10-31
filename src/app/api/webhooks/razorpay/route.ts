import { apiSuccess, handleApiError } from "@/server/errors";
import { PaymentService } from "@/server/services/payment.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const result = await PaymentService.processRazorpayWebhook(rawBody, signature);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
