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
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";

interface DiscountRow {
  id: string;
  code: string;
  name: string;
  discountType: "FIXED" | "PERCENTAGE";
  value: number;
  minPurchaseAmount: number;
  minQuantity: number;
  startDate: string;
  endDate: string;
  maxUsageCount: number | null;
  currentUsageCount: number;
  isActive: boolean;
}

export default function DiscountsPage() {
  const { toast } = useToast();
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [value, setValue] = useState("20");
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1000");
  const [minQuantity, setMinQuantity] = useState("1");
  const [maxUsageCount, setMaxUsageCount] = useState("100");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2027-12-31");

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discounts");
      const json = await res.json();
      if (json.success) setDiscounts(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name,
        discountType,
        value: Number(value),
        minPurchaseAmount: Number(minPurchaseAmount),
        minQuantity: Number(minQuantity),
        maxUsageCount: maxUsageCount ? Number(maxUsageCount) : null,
        startDate,
        endDate,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Discount Creation Failed",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Discount Rule Created",
      description: `Code ${json.data.code} is active.`,
      variant: "success",
    });
    setCreateOpen(false);
    setCode("");
    setName("");
    loadDiscounts();
  };

  const toggleActive = async (d: DiscountRow) => {
    await fetch("/api/discounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, isActive: !d.isActive }),
    });
    loadDiscounts();
  };

  return (
    <div>
      <PageHeader
        category="PROMOTIONS & ATOMIC USAGE LIMITS"
        title="Discount Rules"
        description="Administrator-only fixed and percentage discount rules with atomic concurrency-safe usage limit enforcement."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            New Discount Rule
          </button>
        }
      />

      <DataTable
        columns={[
          {
            key: "code",
            header: "Code",
            mono: true,
            render: (r) => (
              <span className="rounded bg-brand-subtle px-2 py-0.5 font-mono font-bold text-brand">
                {r.code}
              </span>
            ),
          },
          {
            key: "name",
            header: "Discount Name",
            render: (r) => <span className="font-semibold text-text-primary">{r.name}</span>,
          },
          {
            key: "value",
            header: "Value",
            mono: true,
            render: (r) =>
              r.discountType === "PERCENTAGE" ? (
                <span className="font-bold text-semantic-success">{r.value}% OFF</span>
              ) : (
                <MoneyDisplay amount={r.value} />
              ),
          },
          {
            key: "minimums",
            header: "Minimum Requirements",
            mono: true,
            render: (r) => (
              <span className="text-text-secondary">
                Min ₹{r.minPurchaseAmount} • Min Qty {r.minQuantity}
              </span>
            ),
          },
          {
            key: "validity",
            header: "Validity Window",
            mono: true,
            render: (r) => (
              <span className="text-text-muted">
                {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}
              </span>
            ),
          },
          {
            key: "usage",
            header: "Atomic Usage Count",
            mono: true,
            align: "right",
            render: (r) => (
              <span>
                {r.currentUsageCount} / {r.maxUsageCount ?? "∞"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <button type="button" onClick={() => toggleActive(r)}>
                <StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} />
              </button>
            ),
          },
        ]}
        data={discounts}
        rowKey={(r) => r.id}
        loading={loading}
      />

      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Discount Rule"
        description="Configure percentage or fixed discount with date bounds and maximum usage cap."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Discount Code" required>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., ANNUAL25"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
            <FormField label="Discount Name" required>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="25% Annual Promo"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Type" required>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "PERCENTAGE" | "FIXED")}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs"
              >
                <option value="PERCENTAGE">PERCENTAGE (%)</option>
                <option value="FIXED">FIXED (INR)</option>
              </select>
            </FormField>
            <FormField label="Value" required>
              <input
                type="number"
                step="0.01"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs"
              />
            </FormField>
            <FormField label="Min Purchase (₹)" required>
              <input
                type="number"
                required
                value={minPurchaseAmount}
                onChange={(e) => setMinPurchaseAmount(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs"
              />
            </FormField>
            <FormField label="Max Usage Limit">
              <input
                type="number"
                value={maxUsageCount}
                onChange={(e) => setMaxUsageCount(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
            <FormField label="End Date" required>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
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
              Create Discount
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
