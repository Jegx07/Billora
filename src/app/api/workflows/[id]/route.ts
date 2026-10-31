import { prisma } from "@/server/db/client";
import { AppError, apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { WorkflowEngineService } from "@/server/services/workflow-engine.service";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id } = await params;
    const workflow = await WorkflowEngineService.getWorkflow(id, session);
    return apiSuccess(workflow);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (body.action === "DUPLICATE") {
      const copy = await WorkflowEngineService.duplicateWorkflow(session, id);
      return apiSuccess(copy, 201);
    }

    if (body.action === "EXPORT_JSON") {
      const exported = await WorkflowEngineService.exportWorkflowJson(session, id);
      return apiSuccess(exported);
    }

    const result = await WorkflowEngineService.executeWorkflowTest(id, body, session);
    return apiSuccess(result);
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
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id } = await params;
    const existing = await prisma.workflow.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Workflow not found", 404);

    if (session.role !== "ADMIN" && existing.ownerId !== session.userId) {
      throw new AppError("FORBIDDEN", "Only Administrators or the workflow owner can delete a workflow", 403);
    }

    await prisma.workflow.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
