import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { SubscriptionService } from "@/server/services/subscription.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const status = searchParams.get("status") || "";
    const frequency = searchParams.get("frequency") || "";
    const search = (searchParams.get("search") || "").trim();

    const where = {
      ...(session.role === "CUSTOMER" ? { customerId: session.customerId ?? "none" } : {}),
      ...(status ? { status } : {}),
      ...(frequency ? { billingFrequency: frequency } : {}),
      ...(search
        ? {
            OR: [
              { subscriptionNumber: { contains: search } },
              { customer: { contactName: { contains: search } } },
              { customer: { companyName: { contains: search } } },
              { plan: { name: { contains: search } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, customerCode: true, contactName: true, companyName: true, email: true },
          },
          plan: {
            select: {
              id: true,
              name: true,
              billingFrequency: true,
              allowPause: true,
              allowEarlyCancel: true,
              allowRenewal: true,
            },
          },
          _count: { select: { invoices: true, lines: true } },
        },
      }),
    ]);

    return apiSuccess(
      rows.map((s) => ({
        ...s,
        subtotal: toNumber2(s.subtotal),
        discountAmount: toNumber2(s.discountAmount),
        taxAmount: toNumber2(s.taxAmount),
        totalAmount: toNumber2(s.totalAmount),
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
    const payload =
      session.role === "CUSTOMER"
        ? { ...body, customerId: session.customerId, activateImmediately: true }
        : body;
    const subscription = await SubscriptionService.createSubscription(session, payload);
    return apiSuccess(subscription, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
