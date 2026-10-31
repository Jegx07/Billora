"use client";

import {
  DataTable,
  FormField,
  ModalDialog,
  PageHeader,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";

interface TaxRow {
  id: string;
  name: string;
  taxType: string;
  percentage: number;
  applicability: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
}

export default function TaxesPage() {
  const { toast } = useToast();
  const [taxes, setTaxes] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [taxType, setTaxType] = useState("GST");
  const [percentage, setPercentage] = useState("18");
  const [applicability, setApplicability] = useState("ALL");
  const [effectiveFrom, setEffectiveFrom] = useState("2025-01-01");

  const loadTaxes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/taxes");
      const json = await res.json();
      if (json.success) setTaxes(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxes();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/taxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        taxType,
        percentage: Number(percentage),
        applicability,
        effectiveFrom,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Tax Creation Failed",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Tax Rule Created",
      description: `${json.data.name} (${json.data.percentage}%) added.`,
      variant: "success",
    });
    setCreateOpen(false);
    setName("");
    loadTaxes();
  };

  const toggleActive = async (t: TaxRow) => {
    await fetch("/api/taxes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, isActive: !t.isActive }),
    });
    loadTaxes();
  };

  return (
    <div>
      <PageHeader
        category="STATUTORY COMPLIANCE & SNAPSHOTS"
        title="Tax Rules Configuration"
        description="Configure GST, IGST, and custom tax percentages. Applied rates are snapshotted onto each invoice line so historical invoices never mutate when tax rules change."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            New Tax Rule
          </button>
        }
      />

      <DataTable
        columns={[
          {
            key: "name",
            header: "Tax Rule Name",
            render: (r) => <span className="font-semibold text-text-primary">{r.name}</span>,
          },
          {
            key: "type",
            header: "Tax Type",
            mono: true,
            render: (r) => <StatusBadge status={r.taxType} />,
          },
          {
            key: "pct",
            header: "Tax Rate (%)",
            mono: true,
            align: "right",
            render: (r) => <span className="font-bold text-brand">{r.percentage.toFixed(2)}%</span>,
          },
          {
            key: "app",
            header: "Applicability",
            mono: true,
            render: (r) => r.applicability,
          },
          {
            key: "effective",
            header: "Effective From",
            mono: true,
            render: (r) => r.effectiveFrom.slice(0, 10),
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
        data={taxes}
        rowKey={(r) => r.id}
        loading={loading}
      />

      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Configure Tax Rule"
        description="Add a statutory tax rule (e.g., GST 18%, IGST 18%, GST 5%)."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tax Name" required>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., GST 18% Standard"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
            <FormField label="Tax Type" required>
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 text-xs"
              >
                <option value="GST">GST</option>
                <option value="IGST">IGST</option>
                <option value="VAT">VAT</option>
                <option value="SALES_TAX">SALES_TAX</option>
              </select>
            </FormField>
            <FormField label="Tax Percentage (%)" required>
              <input
                type="number"
                step="0.01"
                required
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
            <FormField label="Effective Start Date" required>
              <input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
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
              Save Tax Rule
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
