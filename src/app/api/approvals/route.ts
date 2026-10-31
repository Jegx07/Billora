import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { ApprovalService } from "@/server/services/approval.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") as any;
    const type = searchParams.get("type") || undefined;
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 25);

    const result = await ApprovalService.listApprovals(session, {
      status,
      type,
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
    const approval = await ApprovalService.requestApproval(session, body);
    return apiSuccess(approval, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
