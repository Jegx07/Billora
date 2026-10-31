"use client";

import {
  DateRangePicker,
  MoneyDisplay,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { formatINR } from "@/lib/money";
import {
  AlertCircle,
  CalendarClock,
  Download,
  FileSpreadsheet,
  Play,
  Printer,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardResponse {
  period: {
    preset: string;
    label: string;
    startDate: string;
    endDate: string;
  };
  kpis: {
    totalCustomers: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    pausedSubscriptions: number;
    cancelledSubscriptions: number;
    mrr: number;
    arr: number;
    invoicedRevenue: number;
    recognizedRevenue: number;
    revenueCollected: number;
    outstandingRevenue: number;
    overdueRevenue: number;
    overdueInvoicesCount: number;
    upcomingRenewalsCount: number;
    expiringWithin7DaysCount: number;
  };
  charts: {
    monthlyRevenueTrends: {
      month: string;
      invoiced: number;
      recognized: number;
      collected: number;
    }[];
    revenueByPlan: {
      planId: string;
      planName: string;
      frequency: string;
      subscriptions: number;
      revenue: number;
    }[];
    paymentCollectionTrends: {
      month: string;
      collected: number;
      invoiced: number;
    }[];
    subscriptionGrowth: {
      month: string;
      newSubscriptions: number;
    }[];
    subscriptionCancellations: {
      month: string;
      cancelled: number;
    }[];
    outstandingInvoiceTrends: {
      month: string;
      outstanding: number;
    }[];
  };
  upcomingRenewals: {
    id: string;
    subscriptionNumber: string;
    customerName: string;
    customerCode: string;
    planName: string;
    billingFrequency: string;
    nextBillingDate: string;
    amount: number;
  }[];
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [preset, setPreset] = useState("CURRENT_YEAR");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningBilling, setRunningBilling] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ preset });
      if (preset === "CUSTOM" && customStart) qs.set("startDate", customStart);
      if (preset === "CUSTOM" && customEnd) qs.set("endDate", customEnd);

      const res = await fetch(`/api/analytics/dashboard?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleTriggerBilling = async () => {
    setRunningBilling(true);
    try {
      const res = await fetch("/api/billing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        const run = json.data.jobRun;
        toast({
          title: `Recurring Billing Engine Completed (${run.runCode})`,
          description: `Generated ${run.generatedCount} new invoices (${run.skippedCount} duplicate/not-due skipped, ${run.failedCount} failed).`,
          variant: "success",
        });
        fetchMetrics();
      } else {
        toast({
          title: "Billing Run Failed",
          description: json.error?.message || "Error running billing engine",
          variant: "error",
        });
      }
    } finally {
      setRunningBilling(false);
    }
  };

  const exportUrl = (format: "csv" | "excel") => {
    const qs = new URLSearchParams({ format, preset });
    if (preset === "CUSTOM" && customStart) qs.set("startDate", customStart);
    if (preset === "CUSTOM" && customEnd) qs.set("endDate", customEnd);
    return `/api/analytics/export?${qs.toString()}`;
  };

  const kpis = data?.kpis;

  return (
    <div>
      <PageHeader
        category="EXECUTIVE REVENUE INTELLIGENCE"
        title="Financial & Subscription Overview"
        description={
          data
            ? `SQL-aggregated metrics for ${data.period.label} (${data.period.startDate.slice(
                0,
                10
              )} to ${data.period.endDate.slice(0, 10)})`
            : "Loading executive financial metrics..."
        }
        actions={
          <>
            <button
              type="button"
              onClick={handleTriggerBilling}
              disabled={runningBilling}
              className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover active:bg-brand-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {runningBilling ? "Running Billing Engine..." : "Run Due Billing Cycle"}
            </button>
            <a
              href={exportUrl("csv")}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs font-medium text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </a>
            <a
              href={exportUrl("excel")}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs font-medium text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs font-medium text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={fetchMetrics}
              aria-label="Refresh dashboard"
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </>
        }
      />

      {/* Period Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker
          preset={preset}
          onPresetChange={setPreset}
          startDate={customStart}
          endDate={customEnd}
          onCustomChange={(s, e) => {
            setCustomStart(s);
            setCustomEnd(e);
          }}
        />
        <div className="text-xs font-mono text-text-muted">
          Business Timezone: <strong className="text-text-primary">Asia/Kolkata (IST)</strong>
        </div>
      </div>

      {/* Primary Recurring Revenue & Accounting Recognition Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          loading={loading}
          label="Monthly Recurring Revenue"
          formulaTag="MRR"
          value={formatINR(kpis?.mrr ?? 0)}
          subtitle={`Normalized across ${kpis?.activeSubscriptions.toLocaleString("en-IN") ?? 0} active contracts`}
          trend={{ label: "ARR: " + formatINR(kpis?.arr ?? 0), tone: "positive" }}
        />
        <StatCard
          loading={loading}
          label="Invoiced Revenue (Issued)"
          formulaTag="INVOICED"
          value={formatINR(kpis?.invoicedRevenue ?? 0)}
          subtitle="Confirmed & paid invoices issued in period"
        />
        <StatCard
          loading={loading}
          label="Recognized Revenue (Earned)"
          formulaTag="RECOGNIZED"
          value={formatINR(kpis?.recognizedRevenue ?? 0)}
          subtitle="Time-prorated earned service revenue"
        />
        <StatCard
          loading={loading}
          label="Cash Collected (Settled)"
          formulaTag="COLLECTED"
          value={formatINR(kpis?.revenueCollected ?? 0)}
          subtitle="Verified payments net of refunds"
          trend={{ label: "Settled in bank", tone: "positive" }}
        />
      </div>

      {/* Secondary Operational & Dunning KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          loading={loading}
          label="Total Customers"
          value={(kpis?.totalCustomers ?? 0).toLocaleString("en-IN")}
          subtitle="B2B & Portal Accounts"
        />
        <StatCard
          loading={loading}
          label="Total Subscriptions"
          value={(kpis?.totalSubscriptions ?? 0).toLocaleString("en-IN")}
          subtitle={`${kpis?.pausedSubscriptions ?? 0} paused`}
        />
        <StatCard
          loading={loading}
          label="Active Subscriptions"
          value={(kpis?.activeSubscriptions ?? 0).toLocaleString("en-IN")}
          trend={{ label: "Recurring", tone: "positive" }}
        />
        <StatCard
          loading={loading}
          label="Cancelled Subs"
          value={(kpis?.cancelledSubscriptions ?? 0).toLocaleString("en-IN")}
          trend={{ label: "Churned", tone: "negative" }}
        />
        <StatCard
          loading={loading}
          label="Outstanding Balance"
          value={formatINR(kpis?.outstandingRevenue ?? 0)}
          subtitle="Unpaid confirmed invoices"
        />
        <StatCard
          loading={loading}
          label="Overdue Invoices"
          value={(kpis?.overdueInvoicesCount ?? 0).toLocaleString("en-IN")}
          subtitle={formatINR(kpis?.overdueRevenue ?? 0) + " past due"}
          trend={{
            label: `${kpis?.upcomingRenewalsCount ?? 0} renewing (30d)`,
            tone: (kpis?.overdueInvoicesCount ?? 0) > 0 ? "negative" : "neutral",
          }}
        />
      </div>

      {/* 6 Executive Recharts Visualizations */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-72 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Chart 1: Monthly Revenue Trends (Invoiced vs Recognized vs Cash Collected) */}
          <div className="rounded-lg border border-border bg-bg-base p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  1. Monthly Revenue Trends (Invoiced vs. Recognized vs. Collected)
                </h2>
                <p className="text-xs text-text-muted">
                  Strict accounting separation of billed, earned, and cash-settled INR
                </p>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-bg-subtle border border-border text-text-secondary">
                INR (₹)
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts.monthlyRevenueTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: number) => formatINR(val)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="invoiced"
                    name="Invoiced Revenue"
                    stroke="#4F46E5"
                    fill="#4F46E5"
                    fillOpacity={0.14}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="recognized"
                    name="Recognized Revenue"
                    stroke="#0EA5E9"
                    fill="#0EA5E9"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Cash Collected"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.14}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Revenue by Subscription Plan */}
          <div className="rounded-lg border border-border bg-bg-base p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  2. Revenue by Subscription Plan
                </h2>
                <p className="text-xs text-text-muted">
                  Contracted recurring value segmented by plan tier
                </p>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-bg-subtle border border-border text-text-secondary">
                BY PLAN
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.revenueByPlan || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis dataKey="planName" type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number) => formatINR(val)} />
                  <Bar dataKey="revenue" name="Contract Revenue" fill="#4F46E5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Payment Collection Trends */}
          <div className="rounded-lg border border-border bg-bg-base p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  3. Payment Collection vs. Billed Trends
                </h2>
                <p className="text-xs text-text-muted">
                  Monthly cash realization efficiency against issued invoices
                </p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.paymentCollectionTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: number) => formatINR(val)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="invoiced" name="Invoiced" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="Cash Collected" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Subscription Growth */}
          <div className="rounded-lg border border-border bg-bg-base p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  4. Subscription Growth Velocity
                </h2>
                <p className="text-xs text-text-muted">
                  New recurring contracts activated per month
                </p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.charts.subscriptionGrowth || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="newSubscriptions"
                    name="New Subscriptions"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 5: Subscription Cancellations */}
          <div className="rounded-lg border border-border bg-bg-base p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  5. Subscription Cancellations (Churn Monitor)
                </h2>
                <p className="text-xs text-text-muted">
                  Monthly cancellations tracked via SubscriptionHistory
                </p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.subscriptionCancellations || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="cancelled"
                    name="Cancelled Subscriptions"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 6: Outstanding Invoice Trends */}
          <div className="rounded-lg border border-border bg-bg-base p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  6. Outstanding Accounts Receivable Trend
                </h2>
                <p className="text-xs text-text-muted">
                  Unpaid invoice balances by issue month
                </p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts.outstandingInvoiceTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: number) => formatINR(val)} />
                  <Area
                    type="monotone"
                    dataKey="outstanding"
                    name="Outstanding Balance"
                    stroke="#F59E0B"
                    fill="#F59E0B"
                    fillOpacity={0.16}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Renewals & Actionable Queue */}
      <div className="rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="h-4 w-4 text-brand" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Upcoming Subscription Renewals & Due Billing Queue
              </h2>
              <p className="text-xs text-text-muted">
                Active subscriptions scheduled for automated recurring invoice generation
              </p>
            </div>
          </div>
          <Link
            href="/subscriptions"
            className="text-xs font-medium text-brand hover:underline"
          >
            View All 2,000+ Subscriptions →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-subtle/60 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-2.5">Subscription</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Frequency</th>
                <th className="px-4 py-2.5">Next Billing Date</th>
                <th className="px-4 py-2.5 text-right">Cycle Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {(data?.upcomingRenewals || []).map((ren) => {
                const isDueNow = new Date(ren.nextBillingDate).getTime() <= Date.now();
                return (
                  <tr key={ren.id} className="hover:bg-bg-subtle/50">
                    <td className="px-4 py-3 font-mono font-medium">
                      <Link
                        href={`/subscriptions/${ren.id}`}
                        className="text-brand hover:underline"
                      >
                        {ren.subscriptionNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{ren.customerName}</div>
                      <div className="font-mono text-[10px] text-text-muted">
                        {ren.customerCode}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{ren.planName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ren.billingFrequency} />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className="mr-2">{ren.nextBillingDate.slice(0, 10)}</span>
                      {isDueNow && (
                        <span className="inline-flex items-center gap-1 rounded bg-semantic-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-semantic-warning border border-semantic-warning/30">
                          <AlertCircle className="h-3 w-3" /> DUE NOW
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MoneyDisplay amount={ren.amount} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
