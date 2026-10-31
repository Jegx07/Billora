import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { AuthService } from "@/server/services/auth.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN"]);
    const employees = await prisma.employee.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: { assignedCustomers: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(employees);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const employee = await AuthService.createEmployee(session, body);
    return apiSuccess(employee, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
