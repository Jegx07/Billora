import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const status = searchParams.get("status") || "";
    const overdueOnly = searchParams.get("overdue") === "true";
    const search = (searchParams.get("search") || "").trim();
    const now = new Date();

    const where = {
      ...(session.role === "CUSTOMER" ? { customerId: session.customerId ?? "none" } : {}),
      ...(status ? { status } : {}),
      ...(overdueOnly
        ? {
            status: "CONFIRMED",
            outstandingAmount: { gt: 0 },
            dueDate: { lt: now },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search } },
              { customer: { contactName: { contains: search } } },
              { customer: { companyName: { contains: search } } },
              { subscription: { subscriptionNumber: { contains: search } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { invoiceDate: "desc" },
        include: {
          customer: {
            select: { id: true, customerCode: true, contactName: true, companyName: true, email: true },
          },
          subscription: {
            select: { id: true, subscriptionNumber: true, billingFrequency: true },
          },
          _count: { select: { payments: true, lines: true } },
        },
      }),
    ]);

    return apiSuccess(
      rows.map((inv) => ({
        ...inv,
        subtotal: toNumber2(inv.subtotal),
        discountAmount: toNumber2(inv.discountAmount),
        taxAmount: toNumber2(inv.taxAmount),
        totalAmount: toNumber2(inv.totalAmount),
        amountPaid: toNumber2(inv.amountPaid),
        outstandingAmount: toNumber2(inv.outstandingAmount),
        isOverdue:
          inv.status === "CONFIRMED" &&
          toNumber2(inv.outstandingAmount) > 0 &&
          inv.dueDate.getTime() < now.getTime(),
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
