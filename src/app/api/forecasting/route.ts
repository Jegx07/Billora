import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { ForecastingService } from "@/server/services/forecasting.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const report = await ForecastingService.getRevenueIntelligence(session);
    return apiSuccess(report);
  } catch (error) {
    return handleApiError(error);
  }
}
