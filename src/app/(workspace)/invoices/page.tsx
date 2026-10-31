"use client";

import {
  DataTable,
  MoneyDisplay,
  PageHeader,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { getClientCache, invalidateClientCache, setClientCache } from "@/lib/swr-cache";
import { Download, Eye, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [runningBilling, setRunningBilling] = useState(false);

  const loadInvoices = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      search,
      ...(status ? { status } : {}),
      ...(overdueOnly ? { overdue: "true" } : {}),
    });
    const cacheKey = `invoices:${qs.toString()}`;
    const cached = getClientCache<{ data: any[]; totalPages: number; total: number }>(cacheKey, 20_000);
    if (cached) {
      setInvoices(cached.data);
      setTotalPages(cached.totalPages);
      setTotalRecords(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/invoices?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        const totalPagesVal = json.meta?.totalPages || 1;
        const totalVal = json.meta?.total || json.data.length;
        setInvoices(json.data);
        setTotalPages(totalPagesVal);
        setTotalRecords(totalVal);
        setClientCache(cacheKey, { data: json.data, totalPages: totalPagesVal, total: totalVal });
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, status, overdueOnly]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleRunBilling = async () => {
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
          title: `Billing Run ${run.runCode} Completed`,
          description: `Generated ${run.generatedCount} new invoices (${run.skippedCount} duplicate/not-due skipped).`,
          variant: "success",
        });
        invalidateClientCache("invoices:");
        invalidateClientCache("dashboard:");
        loadInvoices();
      }
    } finally {
      setRunningBilling(false);
    }
  };

  return (
    <div>
      <PageHeader
        category="ACCOUNTS RECEIVABLE & RECURRING BILLING"
        title="Invoices & GST Billing Ledger"
        description="Idempotent recurring invoices with server-computed totals, partial payment tracking, and downloadable tax PDFs."
        actions={
          <button
            type="button"
            disabled={runningBilling}
            onClick={handleRunBilling}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {runningBilling ? "Processing Due Subscriptions..." : "Run Due Billing Engine"}
          </button>
        }
      />

      <DataTable
        columns={[
          {
            key: "invNum",
            header: "Invoice #",
            mono: true,
            render: (r) => (
              <Link
                href={`/invoices/${r.id}`}
                className="font-semibold text-brand hover:underline"
              >
                {r.invoiceNumber}
              </Link>
            ),
          },
          {
            key: "customer",
            header: "Customer",
            render: (r) => (
              <div>
                <div className="font-semibold text-text-primary">
                  {r.customer?.companyName || r.customer?.contactName}
                </div>
                <div className="font-mono text-[10px] text-text-muted">
                  {r.subscription?.subscriptionNumber || "Direct"}
                </div>
              </div>
            ),
          },
          {
            key: "dates",
            header: "Issue / Due Date",
            mono: true,
            render: (r) => (
              <div>
                <div>{r.invoiceDate?.slice(0, 10)}</div>
                <div className="text-[11px] text-text-muted">Due {r.dueDate?.slice(0, 10)}</div>
              </div>
            ),
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            render: (r) => <MoneyDisplay amount={r.totalAmount} />,
          },
          {
            key: "paid",
            header: "Paid",
            align: "right",
            render: (r) => (
              <MoneyDisplay amount={r.amountPaid} className="text-semantic-success" />
            ),
          },
          {
            key: "outstanding",
            header: "Outstanding",
            align: "right",
            render: (r) => (
              <MoneyDisplay
                amount={r.outstandingAmount}
                className={r.outstandingAmount > 0 ? "text-semantic-warning font-semibold" : ""}
              />
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <StatusBadge status={r.status} />
                {r.isOverdue && <StatusBadge status="OVERDUE" />}
              </div>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (r) => (
              <div
                className="flex items-center justify-end gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={`/api/invoices/${r.id}/pdf`}
                  className="inline-flex items-center gap-1 rounded border border-border bg-bg-subtle px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                >
                  <Download className="h-3 w-3" />
                  PDF
                </a>
                <Link
                  href={`/invoices/${r.id}`}
                  className="inline-flex items-center gap-1 rounded bg-brand/10 border border-brand/30 px-2 py-1 text-[11px] font-semibold text-brand"
                >
                  <Eye className="h-3 w-3" />
                  Open
                </Link>
              </div>
            ),
          },
        ]}
        data={invoices}
        rowKey={(r) => r.id}
        loading={loading}
        searchPlaceholder="Search INV-2026-*, customer, or subscription..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        filterSlot={
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs text-text-secondary"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PAID">PAID</option>
              <option value="DRAFT">DRAFT</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => {
                  setOverdueOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Overdue Only
            </label>
          </div>
        }
        page={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/invoices/${r.id}`)}
      />
    </div>
  );
}
