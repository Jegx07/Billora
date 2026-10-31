import { toNumber2 } from "@/lib/money";
import { getOrSetServerCache } from "@/server/cache/query-cache";
import { prisma } from "@/server/db/client";
import { apiSuccess, AppError, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { NextRequest } from "next/server";

function computeMrrEquivalent(amount: number, frequency?: string | null): number {
  const freq = (frequency || "MONTHLY").toUpperCase();
  if (freq === "DAILY") return toNumber2((amount * 365) / 12);
  if (freq === "WEEKLY") return toNumber2((amount * 52) / 12);
  if (freq === "YEARLY") return toNumber2(amount / 12);
  return toNumber2(amount);
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const customerId = session.customerId;
    if (!customerId) {
      throw new AppError("FORBIDDEN", "Customer profile required for portal access", 403);
    }

    const payload = await getOrSetServerCache(
      `portal:${customerId}:${session.userId}`,
      20_000,
      async () => {
        const [customer, subscriptions, invoices, payments, plans, notifications] =
          await Promise.all([
            prisma.customer.findUnique({
              where: { id: customerId },
              include: {
                user: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            }),
            prisma.subscription.findMany({
              where: { customerId },
              take: 50,
              include: {
                plan: true,
                lines: true,
                history: { orderBy: { createdAt: "desc" }, take: 5 },
              },
              orderBy: { createdAt: "desc" },
            }),
            prisma.invoice.findMany({
              where: { customerId },
              take: 50,
              include: { lines: true, subscription: { select: { subscriptionNumber: true } } },
              orderBy: { invoiceDate: "desc" },
            }),
            prisma.payment.findMany({
              where: { customerId },
              take: 50,
              include: { invoice: { select: { invoiceNumber: true } } },
              orderBy: { paymentDate: "desc" },
            }),
            getOrSetServerCache("catalog:plans:active", 60_000, () =>
              prisma.subscriptionPlan.findMany({
                where: { status: "ACTIVE" },
                include: {
                  planProducts: { include: { product: { include: { variants: true } } } },
                },
                orderBy: { basePrice: "asc" },
              })
            ),
            prisma.notification.findMany({
              where: { userId: session.userId },
              orderBy: { createdAt: "desc" },
              take: 25,
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

        return {
          customer: customer
            ? {
                ...customer,
                user: customer.user
                  ? {
                      ...customer.user,
                      name: customer.user.fullName,
                    }
                  : {
                      id: session.userId,
                      name: customer.contactName,
                      fullName: customer.contactName,
                      email: customer.email,
                    },
              }
            : null,
          kpis: {
            activeSubscriptionsCount: activeSubs.length,
            upcomingRenewalsCount: activeSubs.length,
            outstandingInvoicesCount: unpaidInvoices.length,
            totalOutstandingAmount: toNumber2(totalOutstanding),
            totalPaidAmount: toNumber2(totalPaid),
          },
          subscriptions: subscriptions.map((s) => {
            const total = toNumber2(s.totalAmount);
            return {
              ...s,
              subtotal: toNumber2(s.subtotal),
              discountAmount: toNumber2(s.discountAmount),
              taxAmount: toNumber2(s.taxAmount),
              totalAmount: total,
              mrrEquivalent: computeMrrEquivalent(
                total,
                s.billingFrequency || s.plan?.billingFrequency
              ),
            };
          }),
          invoices: invoices.map((i) => {
            const outstanding = toNumber2(i.outstandingAmount);
            return {
              ...i,
              issueDate: i.invoiceDate,
              subtotal: toNumber2(i.subtotal),
              discountAmount: toNumber2(i.discountAmount),
              taxAmount: toNumber2(i.taxAmount),
              totalAmount: toNumber2(i.totalAmount),
              amountPaid: toNumber2(i.amountPaid),
              outstandingAmount: outstanding,
              amountDue: outstanding,
              isOverdue:
                i.status === "CONFIRMED" &&
                outstanding > 0 &&
                i.dueDate.getTime() < Date.now(),
            };
          }),
          payments: payments.map((p) => ({
            ...p,
            paymentMethod: p.method,
            paidAt: p.paymentDate,
            amount: toNumber2(p.amount),
            refundedAmount: toNumber2(p.refundedAmount),
          })),
          availablePlans: plans.map((pl) => ({
            ...pl,
            code: pl.planCode,
            basePrice: toNumber2(pl.basePrice),
          })),
          notifications,
        };
      }
    );

    return apiSuccess(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
