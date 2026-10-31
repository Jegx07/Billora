"use client";

import {
  DataTable,
  FormField,
  ModalDialog,
  MoneyDisplay,
  PageHeader,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { Check, Plus, X } from "lucide-react";
import React, { useEffect, useState } from "react";

interface PlanRow {
  id: string;
  planCode: string;
  name: string;
  description: string | null;
  basePrice: number;
  billingFrequency: string;
  minQuantity: number;
  allowEarlyCancel: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  defaultTermMonths: number;
  status: string;
  _count?: { subscriptions: number };
}

export default function PlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("1000");
  const [billingFrequency, setBillingFrequency] = useState("MONTHLY");
  const [minQuantity, setMinQuantity] = useState("1");
  const [defaultTermMonths, setDefaultTermMonths] = useState("12");
  const [allowPause, setAllowPause] = useState(true);
  const [allowEarlyCancel, setAllowEarlyCancel] = useState(true);
  const [allowRenewal, setAllowRenewal] = useState(true);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plans");
      const json = await res.json();
      if (json.success) setPlans(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        basePrice: Number(basePrice),
        billingFrequency,
        minQuantity: Number(minQuantity),
        defaultTermMonths: Number(defaultTermMonths),
        allowPause,
        allowEarlyCancel,
        allowRenewal,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Plan Creation Failed",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Subscription Plan Created",
      description: `${json.data.planCode} (${json.data.name}) is now active.`,
      variant: "success",
    });
    setCreateOpen(false);
    setName("");
    setDescription("");
    loadPlans();
  };

  return (
    <div>
      <PageHeader
        category="SUBSCRIPTION ARCHITECTURE"
        title="Subscription Plans & Lifecycle Rules"
        description="Configure Daily, Weekly, Monthly, and Yearly billing frequencies with month-end clamping, leap-year safety, and lifecycle permissions."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Plan
          </button>
        }
      />

      <DataTable
        columns={[
          {
            key: "code",
            header: "Plan Code",
            mono: true,
            render: (r) => <span className="font-semibold text-brand">{r.planCode}</span>,
          },
          {
            key: "name",
            header: "Plan Name",
            render: (r) => (
              <div>
                <div className="font-semibold text-text-primary">{r.name}</div>
                {r.description && (
                  <div className="text-[11px] text-text-muted">{r.description}</div>
                )}
              </div>
            ),
          },
          {
            key: "freq",
            header: "Frequency",
            render: (r) => <StatusBadge status={r.billingFrequency} />,
          },
          {
            key: "price",
            header: "Base Price",
            align: "right",
            render: (r) => <MoneyDisplay amount={r.basePrice} />,
          },
          {
            key: "minQty",
            header: "Min Qty",
            align: "center",
            mono: true,
            render: (r) => r.minQuantity,
          },
          {
            key: "rules",
            header: "Lifecycle Permissions",
            render: (r) => (
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span
                  className={
                    r.allowPause ? "text-semantic-success" : "text-text-muted line-through"
                  }
                >
                  Pause
                </span>
                <span>•</span>
                <span
                  className={
                    r.allowEarlyCancel ? "text-semantic-success" : "text-text-muted line-through"
                  }
                >
                  EarlyCancel
                </span>
                <span>•</span>
                <span
                  className={
                    r.allowRenewal ? "text-semantic-success" : "text-text-muted line-through"
                  }
                >
                  Renew
                </span>
              </div>
            ),
          },
          {
            key: "subs",
            header: "Active Contracts",
            align: "right",
            mono: true,
            render: (r) => (r._count?.subscriptions ?? 0).toLocaleString("en-IN"),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
        ]}
        data={plans}
        rowKey={(r) => r.id}
        loading={loading}
      />

      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Subscription Plan"
        description="Define billing frequency, minimum quantity, and self-service lifecycle permissions."
      >
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <FormField label="Plan Name" required>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Enterprise Scale Monthly"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
            />
          </FormField>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Billing Frequency" required>
              <select
                value={billingFrequency}
                onChange={(e) => setBillingFrequency(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs"
              >
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
              </select>
            </FormField>
            <FormField label="Base Price (INR)" required>
              <input
                type="number"
                step="0.01"
                required
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs"
              />
            </FormField>
            <FormField label="Min Quantity" required>
              <input
                type="number"
                min="1"
                required
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs"
              />
            </FormField>
            <FormField label="Term (Months)" required>
              <input
                type="number"
                min="1"
                required
                value={defaultTermMonths}
                onChange={(e) => setDefaultTermMonths(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs"
              />
            </FormField>
          </div>

          <FormField label="Description">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
            />
          </FormField>

          <div className="rounded-md border border-border bg-bg-subtle/60 p-3 space-y-2 text-xs">
            <div className="font-mono text-[11px] uppercase text-text-muted">
              Plan Lifecycle Permissions
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowPause}
                onChange={(e) => setAllowPause(e.target.checked)}
              />
              <span>Allow subscription pause & resume</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowEarlyCancel}
                onChange={(e) => setAllowEarlyCancel(e.target.checked)}
              />
              <span>Allow customer early cancellation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowRenewal}
                onChange={(e) => setAllowRenewal(e.target.checked)}
              />
              <span>Allow automated & manual renewals</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover"
            >
              Create Plan
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
