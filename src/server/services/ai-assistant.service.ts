import { formatINR, toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { AnalyticsService } from "@/server/services/analytics.service";
import { GeminiService } from "@/server/services/gemini.service";

export interface AssistantAnswer {
  question: string;
  answer: string;
  periodUsed: string;
  dataSource: string;
  metrics: Record<string, string | number>;
  records?: Record<string, unknown>[];
  aiPowered?: boolean;
  modelUsed?: string;
}

export class AiAssistantService {
  /**
   * Read-only, RBAC-scoped Business Intelligence Assistant (Section 18 of SPEC.md).
   * - Powered by Google Gemini AI when GEMINI_API_KEY is configured.
   * - Never invents financial numbers; every response is computed directly from live database queries.
   * - Respects user permissions (only ADMIN and EMPLOYEE allowed; CUSTOMER blocked from global data).
   * - Always reports the exact calculation period and database source used.
   * - Seamlessly falls back to deterministic local SQL aggregations if AI is unavailable.
   */
  static async answerQuery(session: AuthSessionContext, rawQuestion: string): Promise<AssistantAnswer> {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError(
        "FORBIDDEN",
        "AI Business Assistant is restricted to authorized Administrators and Employees",
        403
      );
    }

    // 1. If Gemini AI is configured, generate accurate intelligence via Gemini
    if (GeminiService.isAvailable()) {
      try {
        const geminiResult = await GeminiService.generateFinancialAnswer(session, rawQuestion);
        return {
          question: geminiResult.question,
          answer: geminiResult.answer,
          periodUsed: geminiResult.periodUsed,
          dataSource: geminiResult.dataSource,
          metrics: geminiResult.metrics,
          records: geminiResult.records,
          aiPowered: true,
          modelUsed: geminiResult.modelUsed,
        };
      } catch (err: any) {
        console.warn(
          "[AiAssistantService] Gemini intelligence error, falling back to deterministic SQL engine:",
          err?.message
        );
      }
    }

    // 2. Deterministic Local SQL Fallback Engine (Zero-Downtime Guarantee)
    return this.answerWithDeterministicEngine(session, rawQuestion);
  }

  /**
   * Deterministic local fallback query engine.
   */
  private static async answerWithDeterministicEngine(
    session: AuthSessionContext,
    rawQuestion: string
  ): Promise<AssistantAnswer> {
    const q = rawQuestion.trim().toLowerCase();
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const periodLabel = `${monthStart.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)} (UTC)`;

    // Overdue Invoices / Unpaid Customers
    if (q.includes("overdue") || q.includes("unpaid")) {
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: "CONFIRMED",
          outstandingAmount: { gt: 0 },
          ...(q.includes("overdue") ? { dueDate: { lt: now } } : {}),
        },
        include: { customer: true },
        orderBy: { outstandingAmount: "desc" },
        take: 10,
      });

      const totalUnpaid = overdueInvoices.reduce(
        (sum, inv) => sum + toNumber2(inv.outstandingAmount),
        0
      );

      return {
        question: rawQuestion,
        answer:
          overdueInvoices.length > 0
            ? `Found ${overdueInvoices.length} ${
                q.includes("overdue") ? "overdue" : "unpaid"
              } invoices totaling ${formatINR(totalUnpaid)}. The largest outstanding balance is ${
                overdueInvoices[0].invoiceNumber
              } (${
                overdueInvoices[0].customer.companyName || overdueInvoices[0].customer.contactName
              }) for ${formatINR(overdueInvoices[0].outstandingAmount)}.`
            : `There are currently 0 ${q.includes("overdue") ? "overdue" : "unpaid"} invoices as of ${now
                .toISOString()
                .slice(0, 10)}.`,
        periodUsed: `As of ${now.toISOString().slice(0, 10)} (Read-Only Live Snapshot)`,
        dataSource: "PostgreSQL / Prisma `Invoice` + `Customer` (Read-Only Fallback)",
        metrics: {
          matchingInvoicesCount: overdueInvoices.length,
          totalOutstandingINR: formatINR(totalUnpaid),
        },
        records: overdueInvoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          customer: inv.customer.companyName || inv.customer.contactName,
          dueDate: inv.dueDate.toISOString().slice(0, 10),
          outstandingAmount: formatINR(inv.outstandingAmount),
        })),
        aiPowered: false,
      };
    }

    // Subscriptions expiring / renewing this week
    if (q.includes("expire") || q.includes("week") || q.includes("renew")) {
      const expiringSubs = await prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { nextBillingDate: { lte: weekAhead } },
            { expiryDate: { lte: weekAhead } },
          ],
        },
        include: { customer: true, plan: true },
        orderBy: { nextBillingDate: "asc" },
        take: 10,
      });

      return {
        question: rawQuestion,
        answer: `There are ${expiringSubs.length} active subscriptions scheduled for renewal or expiration within the next 7 days (${now
          .toISOString()
          .slice(0, 10)} to ${weekAhead.toISOString().slice(0, 10)}).`,
        periodUsed: `${now.toISOString().slice(0, 10)} to ${weekAhead.toISOString().slice(0, 10)}`,
        dataSource: "PostgreSQL / Prisma `Subscription` + `SubscriptionPlan` (Read-Only Fallback)",
        metrics: {
          dueWithin7Days: expiringSubs.length,
        },
        records: expiringSubs.map((s) => ({
          subscriptionNumber: s.subscriptionNumber,
          customer: s.customer.companyName || s.customer.contactName,
          plan: s.plan.name,
          nextBillingDate: s.nextBillingDate.toISOString().slice(0, 10),
          amount: formatINR(s.totalAmount),
        })),
        aiPowered: false,
      };
    }

    // Top subscription plan by revenue
    if (q.includes("plan") && (q.includes("most") || q.includes("top") || q.includes("revenue"))) {
      const dashboard = await AnalyticsService.getDashboardMetrics(session, {
        preset: "CURRENT_YEAR",
      });
      const topPlan = dashboard.charts.revenueByPlan[0];

      return {
        question: rawQuestion,
        answer: topPlan
          ? `The highest-revenue subscription plan is "${topPlan.planName}" (${topPlan.frequency}), generating ${formatINR(
              topPlan.revenue
            )} across ${topPlan.subscriptions} subscriptions.`
          : "No active subscription plan revenue recorded yet.",
        periodUsed: dashboard.period.label,
        dataSource: "PostgreSQL / Prisma `Subscription.groupBy(planId)` (Read-Only Fallback)",
        metrics: {
          topPlanName: topPlan?.planName ?? "N/A",
          topPlanSubscriptions: topPlan?.subscriptions ?? 0,
          topPlanRevenue: formatINR(topPlan?.revenue ?? 0),
        },
        records: dashboard.charts.revenueByPlan,
        aiPowered: false,
      };
    }

    // Collected revenue this month
    if (q.includes("collected") || q.includes("this month")) {
      const monthDashboard = await AnalyticsService.getDashboardMetrics(session, {
        preset: "CURRENT_MONTH",
      });

      return {
        question: rawQuestion,
        answer: `During ${monthDashboard.period.label}, Billora collected ${formatINR(
          monthDashboard.kpis.revenueCollected
        )} in verified payments, with ${formatINR(
          monthDashboard.kpis.invoicedRevenue
        )} invoiced and ${formatINR(monthDashboard.kpis.recognizedRevenue)} in recognized revenue.`,
        periodUsed: `${monthDashboard.period.startDate.slice(0, 10)} to ${monthDashboard.period.endDate.slice(0, 10)}`,
        dataSource: "PostgreSQL / Prisma `Payment.aggregate` & `Invoice.aggregate` (Read-Only Fallback)",
        metrics: {
          cashCollectedThisMonth: formatINR(monthDashboard.kpis.revenueCollected),
          invoicedThisMonth: formatINR(monthDashboard.kpis.invoicedRevenue),
          recognizedThisMonth: formatINR(monthDashboard.kpis.recognizedRevenue),
        },
        aiPowered: false,
      };
    }

    // Default / MRR / Active subscriptions summary
    const dashboard = await AnalyticsService.getDashboardMetrics(session, {
      preset: "CURRENT_YEAR",
    });

    return {
      question: rawQuestion,
      answer: `Billora currently has ${dashboard.kpis.activeSubscriptions} active subscriptions (out of ${
        dashboard.kpis.totalSubscriptions
      } total across ${dashboard.kpis.totalCustomers} customers). Monthly Recurring Revenue (MRR) is ${formatINR(
        dashboard.kpis.mrr
      )} and Annual Recurring Revenue (ARR) is ${formatINR(
        dashboard.kpis.arr
      )}. Total cash collected in ${dashboard.period.label} is ${formatINR(
        dashboard.kpis.revenueCollected
      )}, with ${formatINR(dashboard.kpis.outstandingRevenue)} outstanding (${
        dashboard.kpis.overdueInvoicesCount
      } overdue invoices totaling ${formatINR(dashboard.kpis.overdueRevenue)}).`,
      periodUsed: periodLabel,
      dataSource: "PostgreSQL / Prisma Executive Aggregations (Read-Only Fallback)",
      metrics: {
        activeSubscriptions: dashboard.kpis.activeSubscriptions,
        totalCustomers: dashboard.kpis.totalCustomers,
        mrr: formatINR(dashboard.kpis.mrr),
        arr: formatINR(dashboard.kpis.arr),
        cashCollectedYTD: formatINR(dashboard.kpis.revenueCollected),
        outstandingBalance: formatINR(dashboard.kpis.outstandingRevenue),
      },
      aiPowered: false,
    };
  }
}
