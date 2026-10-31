import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { WorkflowEngineService } from "@/server/services/workflow-engine.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;

    const workflows = await WorkflowEngineService.listWorkflows(
      {
        status,
        category,
        search,
      },
      session
    );

    return apiSuccess(workflows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json();

    if (body?.action === "IMPORT_JSON") {
      const imported = await WorkflowEngineService.importWorkflowJson(session, body.payload || body);
      return apiSuccess(imported, 201);
    }

    if (body?.action === "RUN_SCHEDULES") {
      const runs = await WorkflowEngineService.processDueSchedules();
      return apiSuccess({ executedCount: runs.length, executions: runs });
    }

    const workflow = await WorkflowEngineService.createWorkflow(session, body);
    return apiSuccess(workflow, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
