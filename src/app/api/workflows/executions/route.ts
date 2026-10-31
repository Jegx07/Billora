import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (workflowId) where.workflowId = workflowId;
    if (status && status !== "ALL") where.status = status;

    const [total, items] = await Promise.all([
      prisma.workflowExecution.count({ where }),
      prisma.workflowExecution.findMany({
        where,
        include: {
          workflow: { select: { id: true, workflowCode: true, name: true, category: true } },
          customer: { select: { id: true, customerCode: true, contactName: true } },
          subscription: { select: { id: true, subscriptionNumber: true } },
          steps: { orderBy: { startedAt: "asc" } },
        },
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return apiSuccess({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
