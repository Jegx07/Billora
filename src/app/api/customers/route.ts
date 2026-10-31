import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { AuthService } from "@/server/services/auth.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const search = (searchParams.get("search") || "").trim();

    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { contactName: { contains: search } },
              { companyName: { contains: search } },
              { email: { contains: search } },
              { customerCode: { contains: search } },
              { city: { contains: search } },
            ],
          }
        : {}),
    };

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          assignedEmployee: {
            include: { user: { select: { fullName: true } } },
          },
          _count: {
            select: { subscriptions: true, invoices: true },
          },
        },
      }),
    ]);

    return apiSuccess(customers, 200, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json();
    const customer = await AuthService.createCustomer(session, body);
    return apiSuccess(customer, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
