import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { WorkflowEngineService } from "@/server/services/workflow-engine.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const integrations = await WorkflowEngineService.listIntegrations(session);
    return apiSuccess(integrations);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json();
    const saved = await WorkflowEngineService.upsertIntegration(session, body);
    return apiSuccess(saved, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
