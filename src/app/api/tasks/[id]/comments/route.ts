import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { TaskService } from "@/server/services/task.service";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id: taskId } = await params;
    const body = await req.json();
    const { content, isInternal, attachments } = body;

    const comment = await TaskService.addComment(
      session,
      taskId,
      content,
      isInternal ?? true,
      attachments
    );
    return apiSuccess(comment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
