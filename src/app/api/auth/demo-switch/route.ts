import { prisma } from "@/server/db/client";
import { apiSuccess, AppError, handleApiError } from "@/server/errors";
import { generateRandomToken, hashToken, SESSION_COOKIE_NAME, UserRole } from "@/server/middlewares/auth";
import { NextRequest } from "next/server";

const DEMO_EMAILS: Record<UserRole, string> = {
  ADMIN: "admin@billora.io",
  EMPLOYEE: "arjun.mehta@billora.io",
  CUSTOMER: "priya.sharma@acmeindia.in",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const role = (body.role || "ADMIN") as UserRole;
    const targetEmail = body.email || DEMO_EMAILS[role] || DEMO_EMAILS.ADMIN;

    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
      include: {
        role: true,
        customer: true,
        employee: true,
      },
    });

    if (!user) {
      throw new AppError("NOT_FOUND", `Demo account '${targetEmail}' not found. Run npm run seed:dev first.`, 404);
    }

    const rawSessionToken = generateRandomToken(32);
    const csrfToken = generateRandomToken(16);

    await prisma.session.create({
      data: {
        tokenHash: hashToken(rawSessionToken),
        csrfToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const res = apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name as UserRole,
        customerId: user.customer?.id ?? null,
        employeeId: user.employee?.id ?? null,
      },
      csrfToken,
    });

    res.cookies.set(SESSION_COOKIE_NAME, rawSessionToken, {
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
