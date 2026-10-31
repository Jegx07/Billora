import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { EmailService } from "@/server/services/email.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 25);

    const result = await EmailService.listEmails({
      status,
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
    const email = await EmailService.sendEmail(session, body);
    return apiSuccess(email, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
