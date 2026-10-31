import { addMoney, mulMoney, round2, subMoney, toDecimal, toNumber2 } from "@/lib/money";
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
   * Computes executive financial KPIs and 6 chart datasets using database aggregations (`groupBy` / `aggregate`).
   * Strictly separates:
   * 1. Invoiced Revenue (total confirmed + paid invoices issued in period)
   * 2. Recognized Revenue (earned recurring subscription value across active service periods)
   * 3. Cash Collected (net verified payments minus refunds received in period)
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
      throw new AppError("FORBIDDEN", "Only administrators and employees can view financial analytics", 403);
    }

    const now = new Date();
    const { startDate, endDate, label } = resolveDateRange(
      options?.preset ?? "CURRENT_YEAR",
      options?.startDate,
      options?.endDate,
      now
    );

    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Run database aggregations in parallel
    const [
      totalCustomers,
      subCountsByStatus,
      activeSubByFrequency,
      invoiceAggInPeriod,
      allConfirmedUnpaidAgg,
      overdueInvoiceAgg,
      paymentAggInPeriod,
      upcomingRenewalsCount,
      upcomingRenewalsList,
      planGroups,
      invoicesInRange,
      paymentsInRange,
      subsCreatedInRange,
    ] = await Promise.all([
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.subscription.groupBy({
        by: ["billingFrequency"],
        where: { status: "ACTIVE" },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: { in: ["CONFIRMED", "PAID"] },
          invoiceDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          totalAmount: true,
          amountPaid: true,
          outstandingAmount: true,
          taxAmount: true,
          discountAmount: true,
        },
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
      prisma.payment.aggregate({
        where: {
          status: { in: ["VERIFIED", "REFUNDED"] },
          paymentDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          amount: true,
          refundedAmount: true,
        },
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
        include: {
          customer: { select: { id: true, contactName: true, companyName: true, customerCode: true } },
          plan: { select: { id: true, name: true, billingFrequency: true } },
        },
      }),
      prisma.subscription.groupBy({
        by: ["planId"],
        where: { status: { in: ["ACTIVE", "CONFIRMED", "PAUSED"] } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.invoice.findMany({
        where: {
          status: { in: ["CONFIRMED", "PAID"] },
          invoiceDate: { gte: startDate, lte: endDate },
        },
        select: {
          invoiceDate: true,
          totalAmount: true,
          amountPaid: true,
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
          method: true,
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
    let totalSubscriptions = 0;
    for (const row of subCountsByStatus) {
      statusMap[row.status] = row._count._all;
      totalSubscriptions += row._count._all;
    }

    const activeSubscriptions = statusMap["ACTIVE"] ?? 0;
    const cancelledSubscriptions = statusMap["CANCELLED"] ?? 0;
    const pausedSubscriptions = statusMap["PAUSED"] ?? 0;

    // Compute exact MRR & ARR from SQL groupBy by frequency
    let mrrDec = new Decimal(0);
    for (const freqGroup of activeSubByFrequency) {
      const freqSum = toDecimal(freqGroup._sum.totalAmount ?? 0);
      mrrDec = addMoney(mrrDec, this.normalizeToMrr(freqSum, freqGroup.billingFrequency));
    }
    const arrDec = mulMoney(mrrDec, 12);

    // Distinct Revenue Metrics:
    // 1. Invoiced Revenue: Total confirmed/paid invoices issued in period
    const invoicedRevenue = round2(invoiceAggInPeriod._sum.totalAmount ?? 0);

    // 2. Cash Collected: Gross verified payments minus refunded amounts in period
    const grossPayments = toDecimal(paymentAggInPeriod._sum.amount ?? 0);
    const totalRefunds = toDecimal(paymentAggInPeriod._sum.refundedAmount ?? 0);
    const cashCollected = round2(Decimal.max(new Decimal(0), subMoney(grossPayments, totalRefunds)));

    // 3. Recognized Revenue: Earned portion of invoices based on elapsed days in the billing period
    let recognizedDec = new Decimal(0);
    for (const inv of invoicesInRange) {
      const invTotal = toDecimal(inv.totalAmount);
      if (inv.billingPeriodStart && inv.billingPeriodEnd) {
        const totalSpanMs = Math.max(
          1,
          inv.billingPeriodEnd.getTime() - inv.billingPeriodStart.getTime()
        );
        const earnedEndMs = Math.min(endDate.getTime(), inv.billingPeriodEnd.getTime());
        const earnedSpanMs = Math.max(0, earnedEndMs - inv.billingPeriodStart.getTime());
        const ratio = Math.min(1, earnedSpanMs / totalSpanMs);
        recognizedDec = addMoney(recognizedDec, invTotal.times(ratio));
      } else {
        recognizedDec = addMoney(recognizedDec, invTotal);
      }
    }

    const outstandingRevenue = round2(allConfirmedUnpaidAgg._sum.outstandingAmount ?? 0);
    const overdueRevenue = round2(overdueInvoiceAgg._sum.outstandingAmount ?? 0);
    const overdueInvoicesCount = overdueInvoiceAgg._count._all;

    // Fetch plan names for Revenue by Plan chart
    const plans = await prisma.subscriptionPlan.findMany({
      select: { id: true, name: true, billingFrequency: true },
    });
    const planNameMap = new Map(plans.map((p) => [p.id, p]));

    const revenueByPlan = planGroups
      .map((pg) => {
        const planInfo = planNameMap.get(pg.planId);
        return {
          planId: pg.planId,
          planName: planInfo?.name ?? "Standard Plan",
          frequency: planInfo?.billingFrequency ?? "MONTHLY",
          subscriptions: pg._count._all,
          revenue: toNumber2(pg._sum.totalAmount ?? 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Build Monthly Time-Series Buckets for the 6 Charts
    const monthBuckets = new Map<
      string,
      {
        month: string;
        invoiced: Decimal;
        recognized: Decimal;
        collected: Decimal;
        outstanding: Decimal;
        newSubscriptions: number;
        cancelledSubscriptions: number;
      }
    >();

    const ensureBucket = (dateObj: Date) => {
      const key = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!monthBuckets.has(key)) {
        monthBuckets.set(key, {
          month: key,
          invoiced: new Decimal(0),
          recognized: new Decimal(0),
          collected: new Decimal(0),
          outstanding: new Decimal(0),
          newSubscriptions: 0,
          cancelledSubscriptions: 0,
        });
      }
      return monthBuckets.get(key)!;
    };

    for (const inv of invoicesInRange) {
      const b = ensureBucket(inv.invoiceDate);
      const total = toDecimal(inv.totalAmount);
      b.invoiced = addMoney(b.invoiced, total);
      b.outstanding = addMoney(b.outstanding, inv.outstandingAmount);
      b.recognized = addMoney(b.recognized, total);
    }

    for (const pay of paymentsInRange) {
      const b = ensureBucket(pay.paymentDate);
      const net = subMoney(pay.amount, pay.refundedAmount);
      b.collected = addMoney(b.collected, Decimal.max(new Decimal(0), net));
    }

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
        invoicedRevenue: toNumber2(item.invoiced),
        recognizedRevenue: toNumber2(item.recognized),
        cashCollected: toNumber2(item.collected),
        outstandingAmount: toNumber2(item.outstanding),
        newSubscriptions: item.newSubscriptions,
        cancelledSubscriptions: item.cancelledSubscriptions,
      }));

    return {
      period: {
        preset: options?.preset ?? "CURRENT_YEAR",
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
        invoicedRevenue: toNumber2(invoicedRevenue),
        recognizedRevenue: toNumber2(recognizedDec),
        revenueCollected: toNumber2(cashCollected),
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
  }
}
