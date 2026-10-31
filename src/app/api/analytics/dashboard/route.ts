import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { AnalyticsService, DateRangePreset } from "@/server/services/analytics.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);
    const preset = (searchParams.get("preset") || "CURRENT_YEAR") as DateRangePreset;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const metrics = await AnalyticsService.getDashboardMetrics(session, {
      preset,
      startDate,
      endDate,
    });

    return apiSuccess(metrics);
  } catch (error) {
    return handleApiError(error);
  }
}
