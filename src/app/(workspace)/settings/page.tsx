"use client";

import { PageHeader, StatusBadge, useToast } from "@/components/ui/Primitives";
import { Play, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [billingInfo, setBillingInfo] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  const loadBillingJobs = async () => {
    const res = await fetch("/api/billing/run");
    const json = await res.json();
    if (json.success) setBillingInfo(json.data);
  };

  useEffect(() => {
    loadBillingJobs();
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
        description="Configure business timezone, BullMQ recurring billing schedules, Razorpay webhook verification, and idempotency locks."
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
    </div>
  );
}
