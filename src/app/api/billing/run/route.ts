import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { triggerBillingRunWithQueue } from "@/server/queues/billing.queue";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const [runs, dueCount] = await Promise.all([
      prisma.billingJobRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 25,
      }),
      prisma.subscription.count({
        where: {
          status: "ACTIVE",
          nextBillingDate: { lte: new Date() },
        },
      }),
    ]);

    return apiSuccess({ dueSubscriptionsCount: dueCount, recentRuns: runs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json().catch(() => ({}));
    const result = await triggerBillingRunWithQueue({
      asOfDate: body.asOfDate ? new Date(body.asOfDate) : new Date(),
      triggeredBy: "MANUAL",
      subscriptionIds: body.subscriptionIds,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
