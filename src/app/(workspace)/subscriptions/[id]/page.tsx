"use client";

import {
  ModalDialog,
  MoneyDisplay,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { formatINR } from "@/lib/money";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  PauseCircle,
  PlayCircle,
  Receipt,
  RefreshCw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

const LIFECYCLE_STEPS = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"];

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [sub, setSub] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionReasonModal, setActionReasonModal] = useState<{
    action: string;
    label: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${params.id}`);
      const json = await res.json();
      if (json.success) {
        setSub(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const executeTransition = async (action: string, customReason?: string) => {
    setWorking(true);
    try {
      const res = await fetch(`/api/subscriptions/${params.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: customReason || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({
          title: `Transition '${action}' Blocked`,
          description: json.error?.message,
          variant: "error",
        });
        return;
      }
      toast({
        title: `Subscription ${action}D`,
        description: `Status is now ${json.data.status}. Recorded in SubscriptionHistory.`,
        variant: "success",
      });
      setActionReasonModal(null);
      setReason("");
      loadSubscription();
    } finally {
      setWorking(false);
    }
  };

  const handleBillNow = async () => {
    setWorking(true);
    try {
      const res = await fetch("/api/billing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionIds: [params.id],
          asOfDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        const item = json.data.results?.[0];
        if (item?.status === "GENERATED") {
          toast({
            title: `Invoice ${item.invoiceNumber} Generated`,
            description: `Idempotency Key: ${item.idempotencyKey}`,
            variant: "success",
          });
        } else {
          toast({
            title: `Billing Run: ${item?.status || "SKIPPED"}`,
            description: item?.invoiceNumber
              ? `Existing invoice ${item.invoiceNumber} prevented duplicate billing.`
              : "No new invoice required for current period.",
            variant: "info",
          });
        }
        loadSubscription();
      }
    } finally {
      setWorking(false);
    }
  };

  if (loading || !sub) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/subscriptions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Subscriptions
        </Link>
      </div>

      <PageHeader
        category={`SUBSCRIPTION CONTRACT • ${sub.billingFrequency}`}
        title={sub.subscriptionNumber}
        description={`Customer: ${sub.customer.companyName || sub.customer.contactName} (${
          sub.customer.customerCode
        }) • Plan: ${sub.plan.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {sub.status === "DRAFT" && (
              <button
                type="button"
                onClick={() => executeTransition("CONFIRM", "Confirmed by operator")}
                className="h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
              >
                Confirm Subscription
              </button>
            )}
            {sub.status === "CONFIRMED" && (
              <button
                type="button"
                onClick={() => executeTransition("ACTIVATE", "Activated for recurring billing")}
                className="inline-flex items-center gap-1.5 h-8 rounded-md bg-semantic-success px-3 text-xs font-semibold text-white"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Activate Subscription
              </button>
            )}
            {sub.status === "ACTIVE" && (
              <>
                <button
                  type="button"
                  disabled={working}
                  onClick={handleBillNow}
                  className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Generate Next Cycle Invoice
                </button>
                {sub.plan.allowPause && (
                  <button
                    type="button"
                    onClick={() =>
                      setActionReasonModal({ action: "PAUSE", label: "Pause Subscription" })
                    }
                    className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-3 text-xs font-medium text-text-primary hover:bg-bg-subtle"
                  >
                    <PauseCircle className="h-3.5 w-3.5 text-semantic-warning" />
                    Pause
                  </button>
                )}
                {sub.plan.allowRenewal && (
                  <button
                    type="button"
                    onClick={() => executeTransition("RENEW", "Manual term renewal")}
                    className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-3 text-xs font-medium text-text-primary hover:bg-bg-subtle"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-brand" />
                    Renew Term
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setActionReasonModal({ action: "CANCEL", label: "Cancel Subscription" })
                  }
                  className="inline-flex items-center gap-1.5 h-8 rounded-md border border-semantic-danger/30 bg-semantic-danger-subtle px-3 text-xs font-semibold text-semantic-danger"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </>
            )}
            {sub.status === "PAUSED" && (
              <button
                type="button"
                onClick={() => executeTransition("RESUME", "Resumed from pause")}
                className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Resume Subscription
              </button>
            )}
            {(sub.status === "CANCELLED" || sub.status === "EXPIRED") && (
              <button
                type="button"
                onClick={() => executeTransition("CLOSE", "Contract closed")}
                className="h-8 rounded-md border border-border bg-bg-base px-3 text-xs font-medium"
              >
                Close Contract
              </button>
            )}
          </div>
        }
      />

      {/* Lifecycle Stepper Banner */}
      <div className="mb-6 rounded-lg border border-border bg-bg-base p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
            Lifecycle State Machine
          </span>
          <StatusBadge status={sub.status} />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {LIFECYCLE_STEPS.map((step) => {
            const isCurrent = sub.status === step;
            return (
              <div
                key={step}
                className={`rounded-md border px-3 py-2 text-center font-mono text-xs ${
                  isCurrent
                    ? "border-brand bg-brand text-white font-bold"
                    : "border-border bg-bg-subtle/50 text-text-secondary"
                }`}
              >
                {step}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule & Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-bg-base p-4">
          <div className="text-xs text-text-muted">Start & Anchor Day</div>
          <div className="mt-1 font-mono text-sm font-semibold text-text-primary">
            {sub.startDate.slice(0, 10)} (Day {sub.anchorBillingDay})
          </div>
          <div className="mt-1 text-[11px] text-text-muted">
            Month-end clamped in {sub.timezone}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-bg-base p-4">
          <div className="text-xs text-text-muted">Current Billing Period</div>
          <div className="mt-1 font-mono text-sm font-semibold text-text-primary">
            {sub.currentPeriodStart.slice(0, 10)} → {sub.currentPeriodEnd.slice(0, 10)}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">
            Next Bill: <strong className="font-mono">{sub.nextBillingDate.slice(0, 10)}</strong>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-bg-base p-4">
          <div className="text-xs text-text-muted">Plan Rules</div>
          <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-xs">
            <span className="rounded bg-bg-subtle px-2 py-0.5">
              Pause: {sub.plan.allowPause ? "YES" : "NO"}
            </span>
            <span className="rounded bg-bg-subtle px-2 py-0.5">
              Cancel: {sub.plan.allowEarlyCancel ? "YES" : "NO"}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-bg-base p-4">
          <div className="text-xs text-text-muted">Recurring Cycle Total</div>
          <div className="mt-1">
            <MoneyDisplay amount={sub.totalAmount} size="xl" />
          </div>
          <div className="mt-1 font-mono text-[11px] text-text-muted">
            Subtotal {formatINR(sub.subtotal)} • GST {formatINR(sub.taxAmount)}
          </div>
        </div>
      </div>

      {/* Snapshotted Product Lines */}
      <div className="mb-6 rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 bg-bg-subtle/40">
          <h2 className="text-sm font-semibold text-text-primary">
            Snapshotted Subscription Line Items
          </h2>
          <p className="text-xs text-text-muted">
            Unit prices, variant deltas, and tax rates are frozen at creation time so later catalog edits do not alter this contract.
          </p>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-subtle/20 font-mono text-[11px] uppercase text-text-muted">
              <th className="px-5 py-2.5">Product & Variant Snapshot</th>
              <th className="px-5 py-2.5 text-right">Qty</th>
              <th className="px-5 py-2.5 text-right">Base Price</th>
              <th className="px-5 py-2.5 text-right">+ Variant</th>
              <th className="px-5 py-2.5 text-right">Unit Price</th>
              <th className="px-5 py-2.5 text-right">Tax</th>
              <th className="px-5 py-2.5 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {sub.lines.map((line: any) => (
              <tr key={line.id}>
                <td className="px-5 py-3 font-sans font-semibold text-text-primary">
                  {line.productNameSnapshot}
                  {line.variantNameSnapshot && (
                    <span className="ml-1.5 rounded bg-brand-subtle px-1.5 py-0.5 font-mono text-[10px] text-brand">
                      {line.variantNameSnapshot}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">{line.quantity}</td>
                <td className="px-5 py-3 text-right">{formatINR(line.baseUnitPrice)}</td>
                <td className="px-5 py-3 text-right">+ {formatINR(line.variantPriceDelta)}</td>
                <td className="px-5 py-3 text-right font-semibold">{formatINR(line.unitPrice)}</td>
                <td className="px-5 py-3 text-right">
                  {formatINR(line.lineTaxAmount)} ({Number(line.taxRateSnapshot)}%)
                </td>
                <td className="px-5 py-3 text-right font-bold">{formatINR(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Linked Invoices & Immutable SubscriptionHistory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 bg-bg-subtle/40">
            <h2 className="text-sm font-semibold text-text-primary">
              Generated Recurring Invoices ({sub.invoices?.length || 0})
            </h2>
          </div>
          <div className="divide-y divide-border text-xs">
            {(sub.invoices || []).length === 0 ? (
              <div className="p-6 text-text-muted">No invoices generated yet.</div>
            ) : (
              sub.invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-mono font-semibold text-brand hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <div className="font-mono text-[11px] text-text-muted">
                      Issued {inv.invoiceDate.slice(0, 10)} • Due {inv.dueDate.slice(0, 10)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MoneyDisplay amount={inv.totalAmount} />
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 bg-bg-subtle/40">
            <h2 className="text-sm font-semibold text-text-primary">
              Immutable Subscription History ({sub.history?.length || 0})
            </h2>
          </div>
          <div className="divide-y divide-border text-xs">
            {(sub.history || []).map((h: any) => (
              <div key={h.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-text-primary">
                    {h.fromStatus || "INITIAL"} → {h.toStatus} ({h.action})
                  </span>
                  <span className="font-mono text-[11px] text-text-muted">
                    {new Date(h.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                {h.reason && <div className="mt-1 text-text-secondary">Reason: {h.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reason Confirmation Modal for Pause/Cancel */}
      <ModalDialog
        open={Boolean(actionReasonModal)}
        onClose={() => setActionReasonModal(null)}
        title={actionReasonModal?.label || "Confirm Action"}
        description="Every state transition is logged permanently in SubscriptionHistory with actor and reason."
        maxWidth="md"
      >
        <div className="space-y-4">
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for this subscription state transition..."
            className="w-full rounded-md border border-border bg-bg-base p-3 text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActionReasonModal(null)}
              className="h-8 rounded-md border border-border px-3 text-xs"
            >
              Abort
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() =>
                actionReasonModal && executeTransition(actionReasonModal.action, reason)
              }
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white"
            >
              Confirm {actionReasonModal?.action}
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
