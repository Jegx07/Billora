import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { TaskService } from "@/server/services/task.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);

    const tab = searchParams.get("tab") as any;
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 25);

    const result = await TaskService.listTasks(session, {
      tab,
      status,
      priority,
      customerId,
      search,
      page,
      limit,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json();
    const task = await TaskService.createTask(session, body);
    return apiSuccess(task, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
