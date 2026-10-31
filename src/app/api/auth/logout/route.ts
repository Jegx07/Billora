import { apiSuccess, handleApiError } from "@/server/errors";
import { getSessionFromRequest, SESSION_COOKIE_NAME } from "@/server/middlewares/auth";
import { AuthService } from "@/server/services/auth.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (session) {
      await AuthService.logout(session.sessionId);
    }
    const res = apiSuccess({ loggedOut: true });
    res.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
