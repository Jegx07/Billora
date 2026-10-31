import { apiSuccess, handleApiError } from "@/server/errors";
import { getSessionFromRequest } from "@/server/middlewares/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return apiSuccess({ authenticated: false, user: null });
    }
    return apiSuccess({
      authenticated: true,
      user: {
        id: session.userId,
        email: session.email,
        fullName: session.fullName,
        role: session.role,
        customerId: session.customerId,
        employeeId: session.employeeId,
      },
      csrfToken: session.csrfToken,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
