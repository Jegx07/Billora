import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { WorkflowEngineService } from "@/server/services/workflow-engine.service";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id } = await params;
    const workflow = await WorkflowEngineService.getWorkflow(id);
    return apiSuccess(workflow);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id } = await params;
    const body = await req.json();
    const updated = await WorkflowEngineService.updateWorkflow(session, id, body);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req, ["ADMIN"]);
    const { id } = await params;
    await prisma.workflow.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
