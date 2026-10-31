import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { ApprovalService } from "@/server/services/approval.service";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { id: approvalId } = await params;
    const body = await req.json();
    const { decision, comment } = body;

    const updated = await ApprovalService.decideApproval(
      session,
      approvalId,
      decision,
      comment
    );
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
