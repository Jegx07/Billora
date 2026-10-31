import { formatINR, toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { AnalyticsService } from "@/server/services/analytics.service";

export interface GeminiAssistantResult {
  question: string;
  answer: string;
  periodUsed: string;
  dataSource: string;
  metrics: Record<string, string | number>;
  records?: Record<string, unknown>[];
  modelUsed: string;
}

export class GeminiService {
  private static readonly FALLBACK_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
  ];

  // Cached connectivity status to avoid hammering Google API on every page reload
  private static cachedStatus: {
    isConnected: boolean;
    checkedAt: number;
    error?: string;
  } | null = null;

  /**
   * Checks whether a valid Gemini API key is configured in the environment.
   */
  static isAvailable(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(
      key &&
      key.trim().length > 10 &&
      !key.includes("your-gemini-api-key")
    );
  }

  /**
   * Returns the primary configured Gemini model name.
   */
  static getPrimaryModel(): string {
    return process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  }

  /**
   * Sanitizes any error message or string so API keys are never leaked to logs or clients.
   */
  private static sanitizeError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    const key = process.env.GEMINI_API_KEY?.trim();
    if (key && key.length > 5) {
      return msg.replaceAll(key, "[REDACTED_API_KEY]");
    }
    return msg;
  }

  /**
   * Verifies live connectivity with Google Gemini API without exposing credentials.
   * Caches result for 3 minutes for high performance.
   */
  static async checkConnectivity(): Promise<{
    isConfigured: boolean;
    isConnected: boolean;
    model: string;
    error?: string;
  }> {
    const isConfigured = this.isAvailable();
    const model = this.getPrimaryModel();

    if (!isConfigured) {
      return {
        isConfigured: false,
        isConnected: false,
        model,
        error: "GEMINI_API_KEY is not configured in .env",
      };
    }

    const now = Date.now();
    if (this.cachedStatus && now - this.cachedStatus.checkedAt < 180000) {
      return {
        isConfigured: true,
        isConnected: this.cachedStatus.isConnected,
        model,
        error: this.cachedStatus.error,
      };
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`;
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        this.cachedStatus = { isConnected: true, checkedAt: now };
        return { isConfigured: true, isConnected: true, model };
      } else {
        const errText = await res.text();
        const cleanErr = this.sanitizeError(`HTTP ${res.status}: ${errText}`);
        this.cachedStatus = { isConnected: false, checkedAt: now, error: cleanErr };
        return { isConfigured: true, isConnected: false, model, error: cleanErr };
      }
    } catch (err: unknown) {
      const cleanErr = this.sanitizeError(err);
      this.cachedStatus = { isConnected: false, checkedAt: now, error: cleanErr };
      return { isConfigured: true, isConnected: false, model, error: cleanErr };
    }
  }

  /**
   * Generates a precise, zero-hallucination financial response using Google Gemini
   * grounded strictly by live database metrics from PostgreSQL / SQLite via Prisma.
   */
  static async generateFinancialAnswer(
    session: AuthSessionContext,
    question: string
  ): Promise<GeminiAssistantResult> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Gather live, ground-truth financial context from the database
    const [ytdDashboard, mtdDashboard, overdueInvoices, upcomingRenewals] = await Promise.all([
      AnalyticsService.getDashboardMetrics(session, { preset: "CURRENT_YEAR" }),
      AnalyticsService.getDashboardMetrics(session, { preset: "CURRENT_MONTH" }),
      prisma.invoice.findMany({
        where: {
          status: "CONFIRMED",
          outstandingAmount: { gt: 0 },
          dueDate: { lt: now }, // True overdue invoices
        },
        include: { customer: true },
        orderBy: { outstandingAmount: "desc" },
        take: 10,
      }),
      prisma.subscription.findMany({
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
      }),
    ]);

    const totalOverdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + toNumber2(inv.outstandingAmount),
      0
    );

    const groundTruthContext = {
      timestamp: now.toISOString(),
      currentPeriod: {
        ytdLabel: ytdDashboard.period.label,
        mtdLabel: mtdDashboard.period.label,
      },
      kpis: {
        activeSubscriptions: ytdDashboard.kpis.activeSubscriptions,
        totalSubscriptions: ytdDashboard.kpis.totalSubscriptions,
        totalCustomers: ytdDashboard.kpis.totalCustomers,
        mrrINR: ytdDashboard.kpis.mrr,
        mrrFormatted: formatINR(ytdDashboard.kpis.mrr),
        arrINR: ytdDashboard.kpis.arr,
        arrFormatted: formatINR(ytdDashboard.kpis.arr),
        cashCollectedThisMonth: formatINR(mtdDashboard.kpis.revenueCollected),
        cashCollectedYTD: formatINR(ytdDashboard.kpis.revenueCollected),
        invoicedYTD: formatINR(ytdDashboard.kpis.invoicedRevenue),
        outstandingBalance: formatINR(ytdDashboard.kpis.outstandingRevenue),
        overdueInvoicesCount: overdueInvoices.length,
        totalOverdueAmountINR: totalOverdueAmount,
        totalOverdueFormatted: formatINR(totalOverdueAmount),
      },
      topPlansByRevenue: ytdDashboard.charts.revenueByPlan.slice(0, 5).map((p) => ({
        planName: p.planName,
        frequency: p.frequency,
        subscriptions: p.subscriptions,
        revenueFormatted: formatINR(p.revenue),
      })),
      overdueInvoicesList: overdueInvoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer.companyName || inv.customer.contactName,
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        outstandingAmount: formatINR(inv.outstandingAmount),
      })),
      upcomingRenewalsNext7Days: upcomingRenewals.map((s) => ({
        subscriptionNumber: s.subscriptionNumber,
        customer: s.customer.companyName || s.customer.contactName,
        plan: s.plan.name,
        nextBillingDate: s.nextBillingDate.toISOString().slice(0, 10),
        amount: formatINR(s.totalAmount),
      })),
    };

    const systemInstruction = `You are Billora's elite AI Revenue Intelligence Assistant.
Billora is a high-precision SaaS & FinTech subscription billing platform.
Your objective is to provide executive-grade, crystal-clear, mathematically exact answers based EXCLUSIVELY on the live database snapshot provided in the prompt.

CRITICAL RULES:
1. ZERO HALLUCINATIONS: Do not guess, extrapolate, or invent financial figures. Every single number must come directly from the provided ground truth context.
2. CURRENCY: Always format Indian Rupees using the '₹' symbol with appropriate commas (e.g. ₹1,20,000.00).
3. TONE: Concise, authoritative, professional, and directly answers what was asked.
4. OUT-OF-SCOPE QUESTIONS: If the user asks an unrelated, non-business question (e.g. general trivia, coding, casual conversation), politely explain that you are specialized in Billora's revenue intelligence, and guide them on what financial metrics you can answer.
5. JSON RESPONSE FORMAT: You must return ONLY a valid, parseable JSON object adhering strictly to this schema:
{
  "answer": "string containing the direct natural-language answer with clear formatting",
  "periodUsed": "string specifying the exact period (e.g., 'Current Year (2026)', 'Next 7 Days', etc.)",
  "dataSource": "string describing the Prisma / Database tables referenced",
  "metrics": {
    "metricName": "number or formatted string"
  }
}`;

    const promptText = `GROUND TRUTH DATABASE SNAPSHOT:
${JSON.stringify(groundTruthContext, null, 2)}

USER QUESTION:
"${question}"

Generate the JSON response answering the question accurately using the data above.`;

    // Try primary model first, followed by fallbacks if necessary
    const primary = this.getPrimaryModel();
    const modelsToTry = [
      primary,
      ...this.FALLBACK_MODELS.filter((m) => m !== primary),
    ];

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Gemini API error ${res.status}: ${this.sanitizeError(errBody)}`);
        }

        const data = await res.json();
        let rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJsonText) {
          throw new Error("Empty response from Gemini API");
        }

        // Clean any markdown wrapper like ```json ... ```
        rawJsonText = rawJsonText.trim();
        if (rawJsonText.startsWith("```")) {
          rawJsonText = rawJsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        const parsed = JSON.parse(rawJsonText);

        // Ensure key metrics are present and guaranteed mathematically exact
        const metrics: Record<string, string | number> = parsed.metrics || {};

        const qLower = question.toLowerCase();
        if (
          qLower.includes("subscription") ||
          qLower.includes("active") ||
          metrics.activeSubscriptions === undefined
        ) {
          metrics.activeSubscriptions = ytdDashboard.kpis.activeSubscriptions;
        }
        if (qLower.includes("mrr") || qLower.includes("recurring") || qLower.includes("health") || qLower.includes("summary")) {
          metrics.mrr = formatINR(ytdDashboard.kpis.mrr);
          metrics.arr = formatINR(ytdDashboard.kpis.arr);
        }
        if (qLower.includes("overdue") || qLower.includes("unpaid")) {
          metrics.matchingInvoicesCount = overdueInvoices.length;
          metrics.totalOutstandingINR = formatINR(totalOverdueAmount);
        }
        if (qLower.includes("renew") || qLower.includes("expire") || qLower.includes("week") || qLower.includes("7 days")) {
          metrics.dueWithin7Days = upcomingRenewals.length;
        }
        if (qLower.includes("collected") || qLower.includes("this month") || qLower.includes("revenue")) {
          metrics.cashCollectedThisMonth = formatINR(mtdDashboard.kpis.revenueCollected);
        }

        // Attach relevant records if applicable to the query
        let records: Record<string, unknown>[] | undefined;
        if (qLower.includes("overdue") || qLower.includes("unpaid")) {
          records = groundTruthContext.overdueInvoicesList;
        } else if (qLower.includes("renew") || qLower.includes("expire") || qLower.includes("week")) {
          records = groundTruthContext.upcomingRenewalsNext7Days;
        } else if (qLower.includes("plan")) {
          records = groundTruthContext.topPlansByRevenue;
        }

        return {
          question,
          answer: parsed.answer || "Query answered successfully.",
          periodUsed: parsed.periodUsed || ytdDashboard.period.label,
          dataSource: `Google Gemini (${model}) • Live Database Aggregations`,
          metrics,
          records,
          modelUsed: model,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[GeminiService] Model ${model} failed, attempting fallback:`,
          this.sanitizeError(lastError)
        );
      }
    }

    throw lastError || new Error("Failed to generate response from Gemini API");
  }
}
