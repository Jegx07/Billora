import { apiSuccess, handleApiError } from "@/server/errors";
import { checkRateLimit, SESSION_COOKIE_NAME } from "@/server/middlewares/auth";
import { AuthService } from "@/server/services/auth.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local";
    checkRateLimit(`register:${ip}`, 15, 60_000);

    const body = await req.json();
    const result = await AuthService.registerCustomer(body);

    const res = apiSuccess(
      {
        user: result.user,
        csrfToken: result.csrfToken,
      },
      201
    );

    res.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
