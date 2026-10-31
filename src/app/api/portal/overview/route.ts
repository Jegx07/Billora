import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { apiSuccess, AppError, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const customerId = session.customerId;
    if (!customerId) {
      throw new AppError("FORBIDDEN", "Customer profile required for portal access", 403);
    }

    const [customer, subscriptions, invoices, payments, plans] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.subscription.findMany({
        where: { customerId },
        include: {
          plan: true,
          lines: true,
          history: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { customerId },
        include: { lines: true, subscription: { select: { subscriptionNumber: true } } },
        orderBy: { invoiceDate: "desc" },
      }),
      prisma.payment.findMany({
        where: { customerId },
        include: { invoice: { select: { invoiceNumber: true } } },
        orderBy: { paymentDate: "desc" },
      }),
      prisma.subscriptionPlan.findMany({
        where: { status: "ACTIVE" },
        include: {
          planProducts: { include: { product: { include: { variants: true } } } },
        },
        orderBy: { basePrice: "asc" },
      }),
    ]);

    const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE");
    const unpaidInvoices = invoices.filter(
      (i) => i.status === "CONFIRMED" && toNumber2(i.outstandingAmount) > 0
    );
    const totalOutstanding = unpaidInvoices.reduce(
      (acc, i) => acc + toNumber2(i.outstandingAmount),
      0
    );
    const totalPaid = payments
      .filter((p) => p.status === "VERIFIED")
      .reduce((acc, p) => acc + toNumber2(p.amount) - toNumber2(p.refundedAmount), 0);

    return apiSuccess({
      customer,
      kpis: {
        activeSubscriptionsCount: activeSubs.length,
        upcomingRenewalsCount: activeSubs.length,
        outstandingInvoicesCount: unpaidInvoices.length,
        totalOutstandingAmount: toNumber2(totalOutstanding),
        totalPaidAmount: toNumber2(totalPaid),
      },
      subscriptions: subscriptions.map((s) => ({
        ...s,
        subtotal: toNumber2(s.subtotal),
        discountAmount: toNumber2(s.discountAmount),
        taxAmount: toNumber2(s.taxAmount),
        totalAmount: toNumber2(s.totalAmount),
      })),
      invoices: invoices.map((i) => ({
        ...i,
        subtotal: toNumber2(i.subtotal),
        discountAmount: toNumber2(i.discountAmount),
        taxAmount: toNumber2(i.taxAmount),
        totalAmount: toNumber2(i.totalAmount),
        amountPaid: toNumber2(i.amountPaid),
        outstandingAmount: toNumber2(i.outstandingAmount),
        isOverdue:
          i.status === "CONFIRMED" &&
          toNumber2(i.outstandingAmount) > 0 &&
          i.dueDate.getTime() < Date.now(),
      })),
      payments: payments.map((p) => ({
        ...p,
        amount: toNumber2(p.amount),
        refundedAmount: toNumber2(p.refundedAmount),
      })),
      availablePlans: plans.map((pl) => ({
        ...pl,
        basePrice: toNumber2(pl.basePrice),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
