import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { GeminiService } from "@/server/services/gemini.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const status = await GeminiService.checkConnectivity();

    return apiSuccess({
      provider: "Google Gemini",
      isConfigured: status.isConfigured,
      isConnected: status.isConnected,
      model: status.model,
      error: status.error,
      capabilities: [
        "Natural Language Financial Queries",
        "MRR & ARR Dynamic Breakdown",
        "Zero-Hallucination SQL Grounding",
        "Overdue Invoices & At-Risk Revenue Detection",
        "Multi-Plan Revenue Comparison",
        "Subscriptions Renewing within 7 Days",
      ],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
