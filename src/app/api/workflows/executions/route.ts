import { prisma } from "@/server/db/client";
import { AppError, apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { WorkflowEngineService } from "@/server/services/workflow-engine.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 25);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (workflowId) where.workflowId = workflowId;
    if (status && status !== "ALL") where.status = status;

    const [total, items] = await Promise.all([
      prisma.workflowExecution.count({ where }),
      prisma.workflowExecution.findMany({
        where,
        include: {
          workflow: { select: { id: true, workflowCode: true, name: true, category: true, ownerId: true } },
          customer: { select: { id: true, customerCode: true, contactName: true, email: true } },
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

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json();
    const { action, executionId, stepId } = body || {};

    if (!executionId) {
      throw new AppError("VALIDATION_ERROR", "executionId is required", 400);
    }

    if (action === "CANCEL") {
      const cancelled = await WorkflowEngineService.cancelExecution(session, executionId);
      return apiSuccess(cancelled);
    }

    if (action === "RETRY_STEP" && stepId) {
      const retriedStep = await WorkflowEngineService.retryExecutionStep(executionId, stepId);
      return apiSuccess(retriedStep);
    }

    if (action === "RETRY") {
      const retried = await WorkflowEngineService.retryExecution(session, executionId);
      return apiSuccess(retried);
    }

    throw new AppError("VALIDATION_ERROR", `Unsupported action: ${action}`, 400);
  } catch (error) {
    return handleApiError(error);
  }
}
