import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { EmailService } from "@/server/services/email.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;

    const templates = await EmailService.listTemplates(category);
    return apiSuccess(templates);
  } catch (error) {
    return handleApiError(error);
  }
}
