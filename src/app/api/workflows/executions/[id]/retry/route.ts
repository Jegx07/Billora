import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { WorkflowEngineService } from "@/server/services/workflow-engine.service";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id: executionId } = await params;
    const body = await req.json();
    const { stepId } = body;

    const result = await WorkflowEngineService.retryExecutionStep(executionId, stepId);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
