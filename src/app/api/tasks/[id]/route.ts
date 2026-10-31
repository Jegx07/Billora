import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { TaskService } from "@/server/services/task.service";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id } = await params;
    const task = await TaskService.getTask(session, id);
    return apiSuccess(task);
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
    const updated = await TaskService.updateTask(session, id, body);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
