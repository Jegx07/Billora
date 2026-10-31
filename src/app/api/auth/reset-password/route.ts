import { apiSuccess, handleApiError } from "@/server/errors";
import { AuthService } from "@/server/services/auth.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await AuthService.resetPassword(body);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
