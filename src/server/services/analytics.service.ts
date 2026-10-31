import { addMoney, mulMoney, round2, subMoney, toDecimal, toNumber2 } from "@/lib/money";
import { getOrSetServerCache } from "@/server/cache/query-cache";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import Decimal from "decimal.js";

export type DateRangePreset =
  | "TODAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "CURRENT_MONTH"
  | "PREVIOUS_MONTH"
  | "CURRENT_YEAR"
  | "CUSTOM";

export function resolveDateRange(
  preset: DateRangePreset = "CURRENT_YEAR",
  customStart?: string | null,
  customEnd?: string | null,
  now: Date = new Date()
): { startDate: Date; endDate: Date; label: string } {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  switch (preset) {
    case "TODAY": {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      return { startDate: start, endDate: end, label: "Today" };
    }
    case "LAST_7_DAYS": {
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setUTCHours(0, 0, 0, 0);
      return { startDate: start, endDate: end, label: "Last 7 Days" };
    }
    case "LAST_30_DAYS": {
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setUTCHours(0, 0, 0, 0);
      return { startDate: start, endDate: end, label: "Last 30 Days" };
    }
    case "CURRENT_MONTH": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      return { startDate: start, endDate: end, label: "Current Month" };
    }
    case "PREVIOUS_MONTH": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
      const lastOfPrev = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999)
      );
      return { startDate: start, endDate: lastOfPrev, label: "Previous Month" };
    }
    case "CUSTOM": {
      const start = customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1);
      const customE = customEnd ? new Date(customEnd) : end;
      return {
        startDate: start,
        endDate: customE,
        label: `${start.toISOString().slice(0, 10)} to ${customE.toISOString().slice(0, 10)}`,
      };
    }
    case "CURRENT_YEAR":
    default: {
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
      return { startDate: start, endDate: end, label: `Current Year (${now.getUTCFullYear()})` };
    }
  }
}

export class AnalyticsService {
  /**
   * Normalizes any subscription's recurring total into Monthly Recurring Revenue (MRR).
   * - MONTHLY: 1x
   * - YEARLY: total / 12
   * - WEEKLY: (total * 52) / 12
   * - DAILY: (total * 365) / 12
   */
  static normalizeToMrr(amount: Decimal, frequency: string): Decimal {
    switch (frequency) {
      case "MONTHLY":
        return round2(amount);
      case "YEARLY":
        return round2(amount.dividedBy(12));
      case "WEEKLY":
        return round2(amount.times(52).dividedBy(12));
      case "DAILY":
        return round2(amount.times(365).dividedBy(12));
      default:
        return round2(amount);
    }
  }

  /**
   * Computes executive financial KPIs and 6 chart datasets using parallel database aggregations
   * and request-coalesced server caching (automatically invalidated on any financial write).
   */
  static async getDashboardMetrics(
    session: AuthSessionContext,
    options?: {
      preset?: DateRangePreset;
      startDate?: string | null;
      endDate?: string | null;
    }
  ) {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError(
        "FORBIDDEN",
        "Only administrators and employees can view financial analytics",
        403
      );
    }

    const now = new Date();
    const preset = options?.preset ?? "CURRENT_YEAR";
    const { startDate, endDate, label } = resolveDateRange(
      preset,
      options?.startDate,
      options?.endDate,
      now
    );

    const cacheKey = `dashboard:${session.role}:${preset}:${startDate.toISOString().slice(0, 10)}:${endDate.toISOString().slice(0, 10)}`;

    return getOrSetServerCache(cacheKey, 30_000, async () => {
      const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Run 10 non-redundant database queries in a single parallel batch
      const [
        totalCustomers,
        subGroupMatrix,
        allConfirmedUnpaidAgg,
        overdueInvoiceAgg,
        upcomingRenewalsCount,
        upcomingRenewalsList,
        plans,
        invoicesInRange,
        paymentsInRange,
        subsCreatedInRange,
      ] = await Promise.all([
        prisma.customer.count({ where: { deletedAt: null } }),
        prisma.subscription.groupBy({
          by: ["status", "billingFrequency", "planId"],
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
        prisma.invoice.aggregate({
          where: {
            status: "CONFIRMED",
            outstandingAmount: { gt: 0 },
          },
          _sum: { outstandingAmount: true },
          _count: { _all: true },
        }),
        prisma.invoice.aggregate({
          where: {
            status: "CONFIRMED",
            outstandingAmount: { gt: 0 },
            dueDate: { lt: now },
          },
          _sum: { outstandingAmount: true },
          _count: { _all: true },
        }),
        prisma.subscription.count({
          where: {
            status: "ACTIVE",
            nextBillingDate: { lte: thirtyDaysAhead },
          },
        }),
        prisma.subscription.findMany({
          where: {
            status: "ACTIVE",
            nextBillingDate: { lte: thirtyDaysAhead },
          },
          orderBy: { nextBillingDate: "asc" },
          take: 8,
          select: {
            id: true,
            subscriptionNumber: true,
            billingFrequency: true,
            nextBillingDate: true,
            totalAmount: true,
            customer: {
              select: { id: true, contactName: true, companyName: true, customerCode: true },
            },
            plan: { select: { id: true, name: true, billingFrequency: true } },
          },
        }),
        prisma.subscriptionPlan.findMany({
          select: { id: true, name: true, billingFrequency: true },
        }),
        prisma.invoice.findMany({
          where: {
            status: { in: ["CONFIRMED", "PAID"] },
            invoiceDate: { gte: startDate, lte: endDate },
          },
          select: {
            invoiceDate: true,
            totalAmount: true,
            outstandingAmount: true,
            billingPeriodStart: true,
            billingPeriodEnd: true,
          },
          orderBy: { invoiceDate: "asc" },
        }),
        prisma.payment.findMany({
          where: {
            status: { in: ["VERIFIED", "REFUNDED"] },
            paymentDate: { gte: startDate, lte: endDate },
          },
          select: {
            paymentDate: true,
            amount: true,
            refundedAmount: true,
          },
          orderBy: { paymentDate: "asc" },
        }),
        prisma.subscription.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
          select: {
            createdAt: true,
            cancelledAt: true,
            status: true,
          },
        }),
      ]);

      const statusMap: Record<string, number> = {};
      const freqSumMap = new Map<string, Decimal>();
      const planAggMap = new Map<string, { subscriptions: number; revenue: Decimal }>();
      let totalSubscriptions = 0;

      for (const row of subGroupMatrix) {
        const count = row._count._all;
        const sumDec = toDecimal(row._sum.totalAmount ?? 0);
        statusMap[row.status] = (statusMap[row.status] ?? 0) + count;
        totalSubscriptions += count;

        if (row.status === "ACTIVE") {
          freqSumMap.set(
            row.billingFrequency,
            addMoney(freqSumMap.get(row.billingFrequency) ?? new Decimal(0), sumDec)
          );
        }

        if (row.status === "ACTIVE" || row.status === "CONFIRMED" || row.status === "PAUSED") {
          const existingPlan = planAggMap.get(row.planId) ?? {
            subscriptions: 0,
            revenue: new Decimal(0),
          };
          existingPlan.subscriptions += count;
          existingPlan.revenue = addMoney(existingPlan.revenue, sumDec);
          planAggMap.set(row.planId, existingPlan);
        }
      }

      const activeSubscriptions = statusMap["ACTIVE"] ?? 0;
      const cancelledSubscriptions = statusMap["CANCELLED"] ?? 0;
      const pausedSubscriptions = statusMap["PAUSED"] ?? 0;

      // Compute exact MRR & ARR from SQL groupBy by frequency
      let mrrDec = new Decimal(0);
      for (const [freq, freqSum] of freqSumMap.entries()) {
        mrrDec = addMoney(mrrDec, this.normalizeToMrr(freqSum, freq));
      }
      const arrDec = mulMoney(mrrDec, 12);

      const outstandingRevenue = round2(allConfirmedUnpaidAgg._sum.outstandingAmount ?? 0);
      const overdueRevenue = round2(overdueInvoiceAgg._sum.outstandingAmount ?? 0);
      const overdueInvoicesCount = overdueInvoiceAgg._count._all;

      const planNameMap = new Map(plans.map((p) => [p.id, p]));

      const revenueByPlan = Array.from(planAggMap.entries())
        .map(([planId, agg]) => {
          const planInfo = planNameMap.get(planId);
          return {
            planId,
            planName: planInfo?.name ?? "Standard Plan",
            frequency: planInfo?.billingFrequency ?? "MONTHLY",
            subscriptions: agg.subscriptions,
            revenue: toNumber2(agg.revenue),
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      // Build Monthly Time-Series Buckets + KPI totals in a single pass using exact integer paise
      const toPaise = (val: unknown): number => Math.round(Number(val ?? 0) * 100);
      const fromPaise = (paise: number): number => Number((paise / 100).toFixed(2));

      const monthBuckets = new Map<
        string,
        {
          month: string;
          invoicedPaise: number;
          recognizedPaise: number;
          collectedPaise: number;
          outstandingPaise: number;
          newSubscriptions: number;
          cancelledSubscriptions: number;
        }
      >();

      const ensureBucket = (dateObj: Date) => {
        const key = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}`;
        let bucket = monthBuckets.get(key);
        if (!bucket) {
          bucket = {
            month: key,
            invoicedPaise: 0,
            recognizedPaise: 0,
            collectedPaise: 0,
            outstandingPaise: 0,
            newSubscriptions: 0,
            cancelledSubscriptions: 0,
          };
          monthBuckets.set(key, bucket);
        }
        return bucket;
      };

      let invoicedPaiseTotal = 0;
      let recognizedPaiseTotal = 0;
      const endMs = endDate.getTime();

      for (const inv of invoicesInRange) {
        const b = ensureBucket(inv.invoiceDate);
        const totalP = toPaise(inv.totalAmount);
        const outP = toPaise(inv.outstandingAmount);
        invoicedPaiseTotal += totalP;
        b.invoicedPaise += totalP;
        b.outstandingPaise += outP;
        b.recognizedPaise += totalP;

        if (inv.billingPeriodStart && inv.billingPeriodEnd) {
          const startMs = inv.billingPeriodStart.getTime();
          const periodEndMs = inv.billingPeriodEnd.getTime();
          if (endMs >= periodEndMs) {
            recognizedPaiseTotal += totalP;
          } else {
            const totalSpanMs = Math.max(1, periodEndMs - startMs);
            const earnedSpanMs = Math.max(0, endMs - startMs);
            const ratio = Math.min(1, earnedSpanMs / totalSpanMs);
            recognizedPaiseTotal += Math.round(totalP * ratio);
          }
        } else {
          recognizedPaiseTotal += totalP;
        }
      }

      let grossPaymentsPaise = 0;
      let totalRefundsPaise = 0;
      for (const pay of paymentsInRange) {
        const b = ensureBucket(pay.paymentDate);
        const amtP = toPaise(pay.amount);
        const refP = toPaise(pay.refundedAmount);
        grossPaymentsPaise += amtP;
        totalRefundsPaise += refP;
        b.collectedPaise += Math.max(0, amtP - refP);
      }

      const invoicedRevenue = fromPaise(invoicedPaiseTotal);
      const recognizedRevenueVal = fromPaise(recognizedPaiseTotal);
      const cashCollected = fromPaise(Math.max(0, grossPaymentsPaise - totalRefundsPaise));

      for (const sub of subsCreatedInRange) {
        const b = ensureBucket(sub.createdAt);
        b.newSubscriptions += 1;
        if (sub.status === "CANCELLED" && sub.cancelledAt) {
          const cb = ensureBucket(sub.cancelledAt);
          cb.cancelledSubscriptions += 1;
        }
      }

      const monthlySeries = Array.from(monthBuckets.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((item) => ({
          month: item.month,
          invoicedRevenue: fromPaise(item.invoicedPaise),
          recognizedRevenue: fromPaise(item.recognizedPaise),
          cashCollected: fromPaise(item.collectedPaise),
          outstandingAmount: fromPaise(item.outstandingPaise),
          newSubscriptions: item.newSubscriptions,
          cancelledSubscriptions: item.cancelledSubscriptions,
        }));

      return {
        period: {
          preset,
          label,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        kpis: {
          totalCustomers,
          totalSubscriptions,
          activeSubscriptions,
          pausedSubscriptions,
          cancelledSubscriptions,
          mrr: toNumber2(mrrDec),
          arr: toNumber2(arrDec),
          invoicedRevenue,
          recognizedRevenue: recognizedRevenueVal,
          revenueCollected: cashCollected,
          outstandingRevenue: toNumber2(outstandingRevenue),
          overdueRevenue: toNumber2(overdueRevenue),
          overdueInvoicesCount,
          upcomingRenewalsCount,
          expiringWithin7DaysCount: upcomingRenewalsList.filter(
            (s) => s.nextBillingDate.getTime() <= sevenDaysAhead.getTime()
          ).length,
        },
        charts: {
          monthlyRevenueTrends: monthlySeries.map((m) => ({
            month: m.month,
            invoiced: m.invoicedRevenue,
            recognized: m.recognizedRevenue,
            collected: m.cashCollected,
          })),
          revenueByPlan,
          paymentCollectionTrends: monthlySeries.map((m) => ({
            month: m.month,
            collected: m.cashCollected,
            invoiced: m.invoicedRevenue,
          })),
          subscriptionGrowth: monthlySeries.map((m) => ({
            month: m.month,
            newSubscriptions: m.newSubscriptions,
          })),
          subscriptionCancellations: monthlySeries.map((m) => ({
            month: m.month,
            cancelled: m.cancelledSubscriptions,
          })),
          outstandingInvoiceTrends: monthlySeries.map((m) => ({
            month: m.month,
            outstanding: m.outstandingAmount,
          })),
        },
        upcomingRenewals: upcomingRenewalsList.map((s) => ({
          id: s.id,
          subscriptionNumber: s.subscriptionNumber,
          customerName: s.customer.companyName || s.customer.contactName,
          customerCode: s.customer.customerCode,
          planName: s.plan.name,
          billingFrequency: s.billingFrequency,
          nextBillingDate: s.nextBillingDate.toISOString(),
          amount: toNumber2(s.totalAmount),
        })),
      };
    });
  }
}
