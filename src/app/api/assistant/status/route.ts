import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { GeminiService } from "@/server/services/gemini.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const available = GeminiService.isAvailable();
    const model = GeminiService.getPrimaryModel();

    return apiSuccess({
      provider: "Google Gemini",
      isConfigured: available,
      model,
      capabilities: [
        "Natural Language Financial Queries",
        "MRR & ARR Dynamic Breakdown",
        "Zero-Hallucination SQL Grounding",
        "Overdue Invoices & At-Risk Revenue Detection",
        "Multi-Plan Revenue Comparison",
      ],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
