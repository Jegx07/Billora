import { apiSuccess, handleApiError } from "@/server/errors";
import { AuthService } from "@/server/services/auth.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await AuthService.requestPasswordReset(body);
    return apiSuccess({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
