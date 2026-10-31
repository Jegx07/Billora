import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { PaymentService } from "@/server/services/payment.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const status = searchParams.get("status") || "";
    const method = searchParams.get("method") || "";
    const search = (searchParams.get("search") || "").trim();

    const where = {
      ...(session.role === "CUSTOMER" ? { customerId: session.customerId ?? "none" } : {}),
      ...(status ? { status } : {}),
      ...(method ? { method } : {}),
      ...(search
        ? {
            OR: [
              { paymentNumber: { contains: search } },
              { transactionReference: { contains: search } },
              { invoice: { invoiceNumber: { contains: search } } },
              { customer: { contactName: { contains: search } } },
              { customer: { companyName: { contains: search } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { paymentDate: "desc" },
        include: {
          customer: {
            select: { id: true, customerCode: true, contactName: true, companyName: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true, totalAmount: true, outstandingAmount: true, status: true },
          },
        },
      }),
    ]);

    return apiSuccess(
      rows.map((p) => ({
        ...p,
        amount: toNumber2(p.amount),
        refundedAmount: toNumber2(p.refundedAmount),
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
    const session = await requireAuth(req);
    const body = await req.json();
    if (body.action === "REFUND") {
      const refunded = await PaymentService.refundPayment(session, body);
      return apiSuccess(refunded);
    }
    const recorded = await PaymentService.recordPayment(session, body);
    return apiSuccess(recorded, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
