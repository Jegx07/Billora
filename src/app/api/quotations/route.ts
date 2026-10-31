import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { QuotationService } from "@/server/services/quotation.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const status = searchParams.get("status") || "";
    const search = (searchParams.get("search") || "").trim();

    const where = {
      ...(session.role === "CUSTOMER" ? { customerId: session.customerId ?? "none" } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { quotationNumber: { contains: search } },
              { customer: { contactName: { contains: search } } },
              { customer: { companyName: { contains: search } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          plan: true,
          subscription: { select: { id: true, subscriptionNumber: true, status: true } },
          lines: true,
        },
      }),
    ]);

    return apiSuccess(
      rows.map((q) => ({
        ...q,
        subtotal: toNumber2(q.subtotal),
        discountAmount: toNumber2(q.discountAmount),
        taxAmount: toNumber2(q.taxAmount),
        totalAmount: toNumber2(q.totalAmount),
      })),
      200,
      {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json();
    const quotation = await QuotationService.createQuotation(session, body);
    return apiSuccess(quotation, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
