"use client";

import {
  DataTable,
  MoneyDisplay,
  PageHeader,
  StatusBadge,
} from "@/components/ui/Primitives";
import { getClientCache, setClientCache } from "@/lib/swr-cache";
import { Eye, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [frequency, setFrequency] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const loadSubscriptions = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      search,
      ...(status ? { status } : {}),
      ...(frequency ? { frequency } : {}),
    });
    const cacheKey = `subscriptions:${qs.toString()}`;
    const cached = getClientCache<{ data: any[]; totalPages: number; total: number }>(cacheKey, 20_000);
    if (cached) {
      setSubscriptions(cached.data);
      setTotalPages(cached.totalPages);
      setTotalRecords(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/subscriptions?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        const totalPagesVal = json.meta?.totalPages || 1;
        const totalVal = json.meta?.total || json.data.length;
        setSubscriptions(json.data);
        setTotalPages(totalPagesVal);
        setTotalRecords(totalVal);
        setClientCache(cacheKey, { data: json.data, totalPages: totalPagesVal, total: totalVal });
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, status, frequency]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  return (
    <div>
      <PageHeader
        category="SUBSCRIPTION LIFECYCLE ENGINE"
        title="Recurring Subscriptions"
        description="Manage active contracts, billing schedules, anchor days, and state transitions (DRAFT → QUOTATION → CONFIRMED → ACTIVE → PAUSED / CANCELLED / EXPIRED → CLOSED)."
        actions={
          <Link
            href="/quotations"
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            Create via Quotation Builder
          </Link>
        }
      />

      <DataTable
        columns={[
          {
            key: "subNum",
            header: "Subscription #",
            mono: true,
            render: (r) => (
              <Link
                href={`/subscriptions/${r.id}`}
                className="font-semibold text-brand hover:underline"
              >
                {r.subscriptionNumber}
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
                  {r.customer?.customerCode}
                </div>
              </div>
            ),
          },
          {
            key: "plan",
            header: "Plan & Frequency",
            render: (r) => (
              <div>
                <div className="font-medium text-text-primary">{r.plan?.name}</div>
                <div className="font-mono text-[10px] text-text-muted">
                  {r.billingFrequency} • Anchor Day {r.anchorBillingDay}
                </div>
              </div>
            ),
          },
          {
            key: "nextBilling",
            header: "Next Billing Date",
            mono: true,
            render: (r) => r.nextBillingDate?.slice(0, 10) || "—",
          },
          {
            key: "amount",
            header: "Recurring Total",
            align: "right",
            render: (r) => <MoneyDisplay amount={r.totalAmount} />,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "action",
            header: "Detail",
            align: "right",
            render: (r) => (
              <Link
                href={`/subscriptions/${r.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded border border-border bg-bg-subtle px-2 py-1 text-xs font-medium text-text-primary hover:border-brand"
              >
                <Eye className="h-3 w-3" />
                Manage
              </Link>
            ),
          },
        ]}
        data={subscriptions}
        rowKey={(r) => r.id}
        loading={loading}
        searchPlaceholder="Search SUB-2026-*, customer, or plan..."
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
              <option value="ACTIVE">ACTIVE</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PAUSED">PAUSED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
            <select
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs text-text-secondary"
            >
              <option value="">All Frequencies</option>
              <option value="MONTHLY">MONTHLY</option>
              <option value="YEARLY">YEARLY</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="DAILY">DAILY</option>
            </select>
          </div>
        }
        page={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/subscriptions/${r.id}`)}
      />
    </div>
  );
}
