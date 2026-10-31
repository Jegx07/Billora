import { AppError, handleApiError } from "@/server/errors";
import { NextRequest } from "next/server";

/**
 * Direct role switching is prohibited.
 * Users must authenticate through /api/auth/login using legitimate credentials.
 */
export async function POST(req: NextRequest) {
  try {
    throw new AppError(
      "FORBIDDEN",
      "Unrestricted role switching is disabled for security. Please sign in with valid credentials.",
      403
    );
  } catch (error) {
    return handleApiError(error);
  }
}
