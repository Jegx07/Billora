"use client";

import { PageHeader, StatusBadge, useToast } from "@/components/ui/Primitives";
import { Database, Lock, Play, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [billingInfo, setBillingInfo] = useState<any | null>(null);
  const [supabaseInfo, setSupabaseInfo] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  const loadBillingJobs = async () => {
    const res = await fetch("/api/billing/run");
    const json = await res.json();
    if (json.success) setBillingInfo(json.data);
  };

  const loadSupabaseStatus = async () => {
    try {
      const res = await fetch("/api/supabase/status", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setSupabaseInfo(json.data);
    } catch {
      // Ignore if current role is non-admin/employee
    }
  };

  useEffect(() => {
    loadBillingJobs();
    loadSupabaseStatus();
  }, []);

  const triggerManualRun = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/billing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: `Billing Run ${json.data.jobRun.runCode} Completed`,
          description: `Generated ${json.data.jobRun.generatedCount} invoices.`,
          variant: "success",
        });
        loadBillingJobs();
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        category="PLATFORM CONFIGURATION"
        title="System & Recurring Billing Engine Settings"
        description="Configure business timezone, centralized Supabase PostgreSQL & RLS security, BullMQ recurring billing schedules, and idempotency locks."
        actions={
          <button
            type="button"
            disabled={running}
            onClick={triggerManualRun}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? "Executing..." : "Run Recurring Billing Job Now"}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-lg border border-border bg-bg-base p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-text-primary">
            Financial & Timezone Configuration
          </h2>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-text-secondary">Platform Identity</span>
            <span className="font-mono font-semibold">Billora (v1.0 Production)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-text-secondary">Business Billing Timezone</span>
            <span className="font-mono font-semibold">Asia/Kolkata (UTC+05:30)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-text-secondary">Currency & Rounding</span>
            <span className="font-mono font-semibold">INR (₹) • Decimal(14,2) ROUND_HALF_UP</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-text-secondary">Duplicate Invoice Prevention</span>
            <span className="inline-flex items-center gap-1 font-mono text-semantic-success font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" /> Composite Unique + Idempotency Key
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-base p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-text-primary">
            Recent Billing Engine Runs ({billingInfo?.recentRuns?.length || 0})
          </h2>
          <div className="text-text-muted">
            Currently Due Active Subscriptions:{" "}
            <strong className="font-mono text-text-primary">
              {billingInfo?.dueSubscriptionsCount ?? 0}
            </strong>
          </div>
          <div className="divide-y divide-border">
            {(billingInfo?.recentRuns || []).slice(0, 5).map((r: any) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between font-mono">
                <div>
                  <div className="font-semibold text-text-primary">{r.runCode}</div>
                  <div className="text-[10px] text-text-muted">
                    Eligible: {r.eligibleCount} • Generated: {r.generatedCount} • Skipped:{" "}
                    {r.skippedCount}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {supabaseInfo && (
        <div className="rounded-lg border border-border bg-bg-base p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-text-primary">
                Centralized Supabase Database, Auth, RLS & Storage Infrastructure
              </h2>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                supabaseInfo.supabase?.isLiveReady
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}
            >
              <Lock className="h-3 w-3" />
              {supabaseInfo.supabase?.mode === "SUPABASE_CLOUD_OR_SELF_HOSTED"
                ? "Supabase Connected"
                : "Local Centralized DB Active (Awaiting Supabase Env Keys)"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Supabase Configuration
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Project URL</span>
                <span className="font-mono font-semibold">
                  {supabaseInfo.supabase?.hasUrl ? "Configured" : "Not Set (.env)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Publishable / Anon Key</span>
                <span className="font-mono font-semibold">
                  {supabaseInfo.supabase?.hasAnonKey ? "Configured" : "Not Set (.env)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Service Role Key (Server-Only)</span>
                <span className="font-mono font-semibold">
                  {supabaseInfo.supabase?.hasServiceRoleKey ? "Configured" : "Not Set (.env)"}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Row Level Security & Storage
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">RLS Protected Tables</span>
                <span className="font-mono font-semibold text-semantic-success">
                  {supabaseInfo.centralizedDatabase?.rlsTablesProtected ?? 31} Tables Enabled
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Role Hierarchy</span>
                <span className="font-mono font-semibold">ADMIN • EMPLOYEE • CUSTOMER</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Private Storage Buckets</span>
                <span className="font-mono font-semibold">
                  {(supabaseInfo.storageBuckets || []).length} Buckets
                </span>
              </div>
            </div>

            <div className="rounded-md border border-border bg-bg-subtle p-3 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Centralized Record Counts
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Users / Customers / Employees</span>
                <span className="font-mono font-semibold">
                  {supabaseInfo.centralizedDatabase?.recordCounts?.users ?? 0} /{" "}
                  {supabaseInfo.centralizedDatabase?.recordCounts?.customers ?? 0} /{" "}
                  {supabaseInfo.centralizedDatabase?.recordCounts?.employees ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Products / Plans / Quotations</span>
                <span className="font-mono font-semibold">
                  {supabaseInfo.centralizedDatabase?.recordCounts?.products ?? 0} /{" "}
                  {supabaseInfo.centralizedDatabase?.recordCounts?.plans ?? 0} /{" "}
                  {supabaseInfo.centralizedDatabase?.recordCounts?.quotations ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Subscriptions / Invoices / Payments</span>
                <span className="font-mono font-semibold">
                  {supabaseInfo.centralizedDatabase?.recordCounts?.subscriptions ?? 0} /{" "}
                  {supabaseInfo.centralizedDatabase?.recordCounts?.invoices ?? 0} /{" "}
                  {supabaseInfo.centralizedDatabase?.recordCounts?.payments ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
