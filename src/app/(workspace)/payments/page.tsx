"use client";

import {
  DataTable,
  ModalDialog,
  MoneyDisplay,
  PageHeader,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

export default function PaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [refundTarget, setRefundTarget] = useState<any | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("Customer billing adjustment");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        search,
        ...(method ? { method } : {}),
      });
      const res = await fetch(`/api/payments?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPayments(json.data);
        setTotalPages(json.meta?.totalPages || 1);
        setTotalRecords(json.meta?.total || json.data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, method]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REFUND",
        paymentId: refundTarget.id,
        refundAmount: Number(refundAmount),
        reason: refundReason,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Refund Failed",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Refund Processed",
      description: `Invoice ${json.data.invoice.invoiceNumber} balance adjusted.`,
      variant: "success",
    });
    setRefundTarget(null);
    loadPayments();
  };

  return (
    <div>
      <PageHeader
        category="CENTRALIZED SETTLEMENT & GATEWAY LEDGER"
        title="Payments & Refunds"
        description="Track UPI, Bank Transfer, Card, Cash, and Razorpay verified transactions with partial/full settlement and refund support."
      />

      <DataTable
        columns={[
          {
            key: "num",
            header: "Payment #",
            mono: true,
            render: (r) => <span className="font-semibold text-brand">{r.paymentNumber}</span>,
          },
          {
            key: "inv",
            header: "Invoice #",
            mono: true,
            render: (r) => (
              <Link
                href={`/invoices/${r.invoice?.id}`}
                className="font-medium text-brand hover:underline"
              >
                {r.invoice?.invoiceNumber}
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
            key: "method",
            header: "Method & Ref",
            mono: true,
            render: (r) => (
              <div>
                <span className="font-semibold">{r.method}</span>
                <div className="text-[10px] text-text-muted">
                  {r.transactionReference || r.razorpayPaymentId || "Manual"}
                </div>
              </div>
            ),
          },
          {
            key: "date",
            header: "Payment Date",
            mono: true,
            render: (r) => r.paymentDate?.slice(0, 10),
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            render: (r) => <MoneyDisplay amount={r.amount} />,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "action",
            header: "Refund",
            align: "right",
            render: (r) =>
              r.status === "VERIFIED" && r.amount - r.refundedAmount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setRefundTarget(r);
                    setRefundAmount(String(r.amount - r.refundedAmount));
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border bg-bg-subtle px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                >
                  <RotateCcw className="h-3 w-3" />
                  Refund
                </button>
              ) : (
                <span className="text-text-muted font-mono">—</span>
              ),
          },
        ]}
        data={payments}
        rowKey={(r) => r.id}
        loading={loading}
        searchPlaceholder="Search PAY-2026-*, UTR ref, invoice, or customer..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        filterSlot={
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs text-text-secondary"
          >
            <option value="">All Payment Methods</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            <option value="RAZORPAY">RAZORPAY</option>
            <option value="CREDIT_CARD">CREDIT_CARD</option>
            <option value="DEBIT_CARD">DEBIT_CARD</option>
            <option value="CASH">CASH</option>
          </select>
        }
        page={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        onPageChange={setPage}
      />

      <ModalDialog
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title={`Refund Payment ${refundTarget?.paymentNumber || ""}`}
        description="Refunds adjust the invoice's paid and outstanding balances inside a database transaction."
      >
        <form onSubmit={handleRefund} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Refund Amount (INR)</label>
            <input
              type="number"
              step="0.01"
              required
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Refund Reason</label>
            <input
              type="text"
              required
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRefundTarget(null)}
              className="h-8 rounded-md border border-border px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded-md bg-semantic-danger px-4 font-semibold text-white"
            >
              Confirm Refund
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
