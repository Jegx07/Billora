import { addMoney, mulMoney, round2, toDecimal, toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { AnalyticsService } from "@/server/services/analytics.service";
import Decimal from "decimal.js";

export class ForecastingService {
  /**
   * Generates a 6-month revenue forecast & subscription intelligence report based on
   * historical retention, active renewal schedules, and overdue customer patterns.
   * Explicitly labels all projections as estimates with stated assumptions (Section 19 of SPEC.md).
   */
  static async getRevenueIntelligence(session: AuthSessionContext) {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError("FORBIDDEN", "Unauthorized to access revenue intelligence", 403);
    }

    const now = new Date();
    const [activeSubs, totalSubsCount, cancelledSubsCount, overdueInvoices, failedPayments] =
      await Promise.all([
        prisma.subscription.findMany({
          where: { status: "ACTIVE" },
          include: { plan: true, customer: true },
        }),
        prisma.subscription.count(),
        prisma.subscription.count({ where: { status: "CANCELLED" } }),
        prisma.invoice.findMany({
          where: {
            status: "CONFIRMED",
            outstandingAmount: { gt: 0 },
            dueDate: { lt: now },
          },
          include: { customer: true },
        }),
        prisma.payment.findMany({
          where: { status: "FAILED" },
          include: { customer: true, invoice: true },
          orderBy: { paymentDate: "desc" },
          take: 15,
        }),
      ]);

    let currentMrr = new Decimal(0);
    for (const s of activeSubs) {
      currentMrr = addMoney(
        currentMrr,
        AnalyticsService.normalizeToMrr(toDecimal(s.totalAmount), s.billingFrequency)
      );
    }

    const historicalChurnRate =
      totalSubsCount > 0 ? Math.min(0.15, cancelledSubsCount / totalSubsCount / 6) : 0.02;
    const assumedMonthlyExpansionRate = 0.045; // 4.5% historical gross expansion assumption
    const netMonthlyGrowthFactor = 1 + assumedMonthlyExpansionRate - historicalChurnRate;

    const projections: {
      month: string;
      projectedMrr: number;
      projectedArr: number;
      conservativeMrr: number;
      optimisticMrr: number;
    }[] = [];

    let runningMrr = currentMrr;
    for (let i = 1; i <= 6; i++) {
      const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      const monthLabel = `${targetDate.getUTCFullYear()}-${String(
        targetDate.getUTCMonth() + 1
      ).padStart(2, "0")}`;

      runningMrr = round2(runningMrr.times(netMonthlyGrowthFactor));
      const conservative = round2(runningMrr.times(0.93));
      const optimistic = round2(runningMrr.times(1.08));

      projections.push({
        month: monthLabel,
        projectedMrr: toNumber2(runningMrr),
        projectedArr: toNumber2(mulMoney(runningMrr, 12)),
        conservativeMrr: toNumber2(conservative),
        optimisticMrr: toNumber2(optimistic),
      });
    }

    // Identify frequently overdue customers
    const overdueCustomerMap = new Map<
      string,
      {
        customerId: string;
        customerCode: string;
        customerName: string;
        overdueInvoiceCount: number;
        totalOverdueAmount: Decimal;
      }
    >();

    for (const inv of overdueInvoices) {
      const existing = overdueCustomerMap.get(inv.customerId) ?? {
        customerId: inv.customerId,
        customerCode: inv.customer.customerCode,
        customerName: inv.customer.companyName || inv.customer.contactName,
        overdueInvoiceCount: 0,
        totalOverdueAmount: new Decimal(0),
      };
      existing.overdueInvoiceCount += 1;
      existing.totalOverdueAmount = addMoney(existing.totalOverdueAmount, inv.outstandingAmount);
      overdueCustomerMap.set(inv.customerId, existing);
    }

    const riskCustomers = Array.from(overdueCustomerMap.values())
      .sort((a, b) => b.totalOverdueAmount.comparedTo(a.totalOverdueAmount))
      .slice(0, 10)
      .map((c) => ({
        ...c,
        totalOverdueAmount: toNumber2(c.totalOverdueAmount),
        riskLevel: c.overdueInvoiceCount >= 2 || c.totalOverdueAmount.greaterThan(25000) ? "HIGH" : "MEDIUM",
      }));

    return {
      disclaimer:
        "ESTIMATE ONLY: Revenue projections are statistical estimates derived from current active recurring contracts, historical cancellation rates, and expansion assumptions. They do not represent guaranteed financial outcomes.",
      assumptions: {
        currentMrr: toNumber2(currentMrr),
        currentArr: toNumber2(mulMoney(currentMrr, 12)),
        monthlyChurnRatePct: round2(historicalChurnRate * 100).toNumber(),
        monthlyExpansionRatePct: round2(assumedMonthlyExpansionRate * 100).toNumber(),
        netMonthlyGrowthPct: round2((netMonthlyGrowthFactor - 1) * 100).toNumber(),
      },
      projections,
      frequentlyOverdueCustomers: riskCustomers,
      unusualPaymentPatterns: failedPayments.map((fp) => ({
        paymentId: fp.id,
        paymentNumber: fp.paymentNumber,
        customerName: fp.customer.companyName || fp.customer.contactName,
        invoiceNumber: fp.invoice.invoiceNumber,
        amount: toNumber2(fp.amount),
        failureReason: fp.failureReason || "Gateway verification failure",
        date: fp.paymentDate.toISOString(),
      })),
    };
  }
}
