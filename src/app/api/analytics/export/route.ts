import { handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { AnalyticsService, DateRangePreset } from "@/server/services/analytics.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();
    const preset = (searchParams.get("preset") || "CURRENT_YEAR") as DateRangePreset;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const data = await AnalyticsService.getDashboardMetrics(session, {
      preset,
      startDate,
      endDate,
    });

    const rows = [
      ["Billora Executive Financial Report", data.period.label],
      ["Generated At", new Date().toISOString()],
      [],
      ["Metric", "Value (INR / Count)"],
      ["Total Customers", String(data.kpis.totalCustomers)],
      ["Total Subscriptions", String(data.kpis.totalSubscriptions)],
      ["Active Subscriptions", String(data.kpis.activeSubscriptions)],
      ["Cancelled Subscriptions", String(data.kpis.cancelledSubscriptions)],
      ["Monthly Recurring Revenue (MRR)", data.kpis.mrr.toFixed(2)],
      ["Annual Recurring Revenue (ARR)", data.kpis.arr.toFixed(2)],
      ["Invoiced Revenue (Issued)", data.kpis.invoicedRevenue.toFixed(2)],
      ["Recognized Revenue (Earned)", data.kpis.recognizedRevenue.toFixed(2)],
      ["Cash Collected (Settled)", data.kpis.revenueCollected.toFixed(2)],
      ["Outstanding Revenue", data.kpis.outstandingRevenue.toFixed(2)],
      ["Overdue Revenue", data.kpis.overdueRevenue.toFixed(2)],
      ["Overdue Invoices Count", String(data.kpis.overdueInvoicesCount)],
      [],
      ["Monthly Breakdown", "Invoiced (INR)", "Recognized (INR)", "Collected (INR)", "Outstanding (INR)"],
      ...data.charts.monthlyRevenueTrends.map((m, idx) => [
        m.month,
        m.invoiced.toFixed(2),
        m.recognized.toFixed(2),
        m.collected.toFixed(2),
        String(data.charts.outstandingInvoiceTrends[idx]?.outstanding?.toFixed(2) ?? "0.00"),
      ]),
    ];

    if (format === "excel" || format === "xls") {
      const tsv = rows.map((r) => r.join("\t")).join("\n");
      return new NextResponse(tsv, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="billora-financial-report-${preset.toLowerCase()}.xls"`,
        },
      });
    }

    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="billora-financial-report-${preset.toLowerCase()}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
