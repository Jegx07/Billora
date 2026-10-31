"use client";

import {
  MoneyDisplay,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
} from "@/components/ui/Primitives";
import { formatINR } from "@/lib/money";
import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ForecastingPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/forecasting")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        category="PREDICTIVE REVENUE INTELLIGENCE"
        title="Revenue Forecasting & Churn Risk Analysis"
        description="6-month statistical recurring revenue projections, overdue customer risk scoring, and payment anomaly detection."
      />

      {/* Mandatory Estimate Disclosure Banner (Section 19 of SPEC.md) */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-brand/30 bg-brand-subtle/40 p-4 text-xs">
        <Info className="h-4 w-4 text-brand shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-text-primary">
            Forecast Methodology & Assumption Disclosure
          </div>
          <p className="mt-0.5 text-text-secondary">
            {data?.disclaimer ||
              "Forecasts are statistical estimates based on historical contract retention and expansion assumptions, not guaranteed financial outcomes."}
          </p>
        </div>
      </div>

      {/* Assumptions KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          loading={loading}
          label="Baseline MRR"
          value={formatINR(data?.assumptions?.currentMrr ?? 0)}
          subtitle="Active contract run-rate"
        />
        <StatCard
          loading={loading}
          label="Baseline ARR"
          value={formatINR(data?.assumptions?.currentArr ?? 0)}
          subtitle="Annualized baseline"
        />
        <StatCard
          loading={loading}
          label="Historical Churn Rate"
          value={`${data?.assumptions?.monthlyChurnRatePct ?? 0}% / mo`}
          subtitle="Observed cancellation velocity"
        />
        <StatCard
          loading={loading}
          label="Assumed Expansion"
          value={`${data?.assumptions?.monthlyExpansionRatePct ?? 0}% / mo`}
          subtitle="Seat & variant upgrades"
        />
        <StatCard
          loading={loading}
          label="Net Monthly Growth"
          value={`+${data?.assumptions?.netMonthlyGrowthPct ?? 0}% / mo`}
          trend={{ label: "6-Month Model", tone: "positive" }}
        />
      </div>

      {loading ? (
        <Skeleton className="h-80 w-full mb-6" />
      ) : (
        <div className="rounded-lg border border-border bg-bg-base p-5 shadow-xs mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                6-Month Projected MRR Trajectory (Baseline vs. Optimistic / Conservative Bands)
              </h2>
              <p className="text-xs text-text-muted">
                Estimated monthly recurring revenue based on active renewal schedules and historical retention
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-brand" />
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.projections || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(val: number) => formatINR(val)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="optimisticMrr"
                  name="Optimistic Band (+8%)"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.08}
                />
                <Area
                  type="monotone"
                  dataKey="projectedMrr"
                  name="Expected MRR Estimate"
                  stroke="#4F46E5"
                  fill="#4F46E5"
                  fillOpacity={0.18}
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="conservativeMrr"
                  name="Conservative Band (-7%)"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.08}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Frequently Overdue Customers Risk Table */}
      <div className="rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5 bg-bg-subtle/40">
          <AlertTriangle className="h-4 w-4 text-semantic-warning" />
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Frequently Overdue Customers & Dunning Risk Watchlist
            </h2>
            <p className="text-xs text-text-muted">
              Customers ranked by unpaid past-due invoice exposure
            </p>
          </div>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-subtle/20 font-mono text-[11px] uppercase text-text-muted">
              <th className="px-5 py-2.5">Customer Code</th>
              <th className="px-5 py-2.5">Customer / Company</th>
              <th className="px-5 py-2.5 text-right">Overdue Invoices</th>
              <th className="px-5 py-2.5 text-right">Total Past-Due Exposure</th>
              <th className="px-5 py-2.5">Risk Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data?.frequentlyOverdueCustomers || []).map((c: any) => (
              <tr key={c.customerId} className="hover:bg-bg-subtle/40">
                <td className="px-5 py-3 font-mono font-semibold text-brand">{c.customerCode}</td>
                <td className="px-5 py-3 font-semibold text-text-primary">{c.customerName}</td>
                <td className="px-5 py-3 text-right font-mono">{c.overdueInvoiceCount}</td>
                <td className="px-5 py-3 text-right">
                  <MoneyDisplay amount={c.totalOverdueAmount} />
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={c.riskLevel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
