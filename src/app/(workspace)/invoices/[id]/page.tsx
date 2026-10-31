"use client";

import {
  FormField,
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
  BellRing,
  CreditCard,
  Download,
  Printer,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { BilloraLogo } from "@/components/brand/Logo";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual Payment Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Razorpay Gateway Verification Modal
  const [rzpOrder, setRzpOrder] = useState<any | null>(null);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${params.id}`);
      const json = await res.json();
      if (json.success) {
        setInvoice(json.data);
        setPayAmount(String(Number(json.data.outstandingAmount)));
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: Number(payAmount),
          method: payMethod,
          transactionReference: payRef || `TXN-${Date.now()}`,
          notes: payNotes,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Payment Rejected",
          description: json.error?.message,
          variant: "error",
        });
        return;
      }
      toast({
        title: `Payment Recorded (${json.data.payment.paymentNumber})`,
        description: `Invoice status: ${json.data.updatedInvoice.status} • Remaining balance: ${formatINR(
          json.data.updatedInvoice.outstandingAmount
        )}`,
        variant: "success",
      });
      setPayModalOpen(false);
      loadInvoice();
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitiateRazorpay = async () => {
    const res = await fetch("/api/payments/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Razorpay Order Error",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    setRzpOrder(json.data);
  };

  const handleVerifyRazorpay = async () => {
    if (!rzpOrder) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: rzpOrder.orderId,
          razorpayPaymentId: rzpOrder.testSignaturePreview?.sampleRazorpayPaymentId,
          razorpaySignature: rzpOrder.testSignaturePreview?.sampleSignature,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Signature Verification Failed",
          description: json.error?.message,
          variant: "error",
        });
        return;
      }
      toast({
        title: "Razorpay HMAC SHA-256 Verified!",
        description: `Invoice ${invoice.invoiceNumber} is now ${json.data.invoice.status}.`,
        variant: "success",
      });
      setRzpOrder(null);
      loadInvoice();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminder = async () => {
    const res = await fetch(`/api/invoices/${invoice.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SEND_REMINDER" }),
    });
    const json = await res.json();
    if (json.success) {
      toast({
        title: "Payment Reminder Dispatched",
        description: `Sent notification to ${invoice.customer.email}.`,
        variant: "info",
      });
    }
  };

  if (loading || !invoice) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const outstanding = Number(invoice.outstandingAmount);

  return (
    <div>
      <div className="no-print mb-4">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Invoices
        </Link>
      </div>

      <PageHeader
        className="no-print"
        category="TAX INVOICE & SETTLEMENT LEDGER"
        title={invoice.invoiceNumber}
        description={`Billed to ${invoice.customer.companyName || invoice.customer.contactName} (${
          invoice.customer.customerCode
        })`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {outstanding > 0 && invoice.status !== "CANCELLED" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPayAmount(String(outstanding));
                    setPayModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Record Payment (Partial / Full)
                </button>
                <button
                  type="button"
                  onClick={handleInitiateRazorpay}
                  className="inline-flex items-center gap-1.5 h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Pay via Razorpay
                </button>
                <button
                  type="button"
                  onClick={handleSendReminder}
                  className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  Send Reminder
                </button>
              </>
            )}
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-3 text-xs font-medium text-text-primary hover:bg-bg-subtle"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-3 text-xs font-medium text-text-primary hover:bg-bg-subtle"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        }
      />

      {/* Printable Tax Invoice Document */}
      <div className="rounded-lg border border-border bg-bg-base p-6 sm:p-8 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <BilloraLogo variant="light" size="md" />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Unified Subscription, Billing & Revenue Intelligence Platform
            </p>
            {invoice.idempotencyKey && (
              <div className="mt-2 font-mono text-[10px] text-text-muted">
                Idempotency Lock: {invoice.idempotencyKey}
              </div>
            )}
          </div>

          <div className="text-left sm:text-right">
            <div className="flex items-center sm:justify-end gap-2">
              <span className="font-mono text-lg font-bold text-text-primary">
                {invoice.invoiceNumber}
              </span>
              <StatusBadge status={invoice.status} />
              {invoice.isOverdue && <StatusBadge status="OVERDUE" />}
            </div>
            <div className="mt-1 font-mono text-xs text-text-secondary">
              Issue Date: {invoice.invoiceDate.slice(0, 10)} • Due Date:{" "}
              {invoice.dueDate.slice(0, 10)}
            </div>
            {invoice.billingPeriodStart && invoice.billingPeriodEnd && (
              <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                Billing Period: {invoice.billingPeriodStart.slice(0, 10)} →{" "}
                {invoice.billingPeriodEnd.slice(0, 10)}
              </div>
            )}
          </div>
        </div>

        {/* Customer & Contract Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-border text-xs">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1">
              Billed To Customer
            </div>
            <div className="text-sm font-semibold text-text-primary">
              {invoice.customer.companyName || invoice.customer.contactName}
            </div>
            <div className="text-text-secondary mt-0.5">
              {invoice.customer.contactName} ({invoice.customer.email})
            </div>
            <div className="font-mono text-text-muted mt-1">
              Code: {invoice.customer.customerCode} • GSTIN:{" "}
              {invoice.customer.gstin || "Unregistered"}
            </div>
          </div>

          <div className="sm:text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1">
              Subscription Reference
            </div>
            {invoice.subscription ? (
              <Link
                href={`/subscriptions/${invoice.subscription.id}`}
                className="font-mono text-sm font-semibold text-brand hover:underline"
              >
                {invoice.subscription.subscriptionNumber}
              </Link>
            ) : (
              <div className="font-mono text-sm">Direct Invoice</div>
            )}
            <div className="mt-2 font-mono text-xs">
              Outstanding Balance:{" "}
              <strong
                className={
                  outstanding > 0 ? "text-semantic-warning" : "text-semantic-success"
                }
              >
                {formatINR(invoice.outstandingAmount)}
              </strong>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border font-mono text-[11px] uppercase text-text-muted">
                <th className="py-2.5">Description (Historical Snapshot)</th>
                <th className="py-2.5 text-right">Qty</th>
                <th className="py-2.5 text-right">Base Price</th>
                <th className="py-2.5 text-right">+ Variant</th>
                <th className="py-2.5 text-right">Unit Price</th>
                <th className="py-2.5 text-right">GST / Tax</th>
                <th className="py-2.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {invoice.lines.map((l: any) => (
                <tr key={l.id}>
                  <td className="py-3 font-sans font-medium text-text-primary">
                    {l.description}
                  </td>
                  <td className="py-3 text-right">{l.quantity}</td>
                  <td className="py-3 text-right">{formatINR(l.baseUnitPrice)}</td>
                  <td className="py-3 text-right">+ {formatINR(l.variantPriceDelta)}</td>
                  <td className="py-3 text-right font-semibold">{formatINR(l.unitPrice)}</td>
                  <td className="py-3 text-right">
                    {formatINR(l.lineTaxAmount)} ({Number(l.taxRateSnapshot)}%)
                  </td>
                  <td className="py-3 text-right font-bold">{formatINR(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Block */}
        <div className="flex justify-end border-t border-border pt-6">
          <div className="w-full max-w-xs space-y-2 text-xs font-mono">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal:</span>
              <span>{formatINR(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-semantic-success">
              <span>Discount:</span>
              <span>- {formatINR(invoice.discountAmount)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>GST / Tax:</span>
              <span>+ {formatINR(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-text-primary">
              <span>Total Invoice Amount:</span>
              <span>{formatINR(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-semantic-success">
              <span>Verified Amount Paid:</span>
              <span>{formatINR(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
              <span>Outstanding Due:</span>
              <span className={outstanding > 0 ? "text-semantic-warning" : "text-semantic-success"}>
                {formatINR(invoice.outstandingAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Ledger for this Invoice */}
      <div className="no-print rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 bg-bg-subtle/40">
          <h2 className="text-sm font-semibold text-text-primary">
            Verified Payment & Settlement History ({invoice.payments?.length || 0})
          </h2>
        </div>
        <div className="divide-y divide-border text-xs">
          {(invoice.payments || []).length === 0 ? (
            <div className="p-6 text-text-muted">No payments recorded against this invoice yet.</div>
          ) : (
            invoice.payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-mono font-semibold text-text-primary">
                    {p.paymentNumber}
                  </span>
                  <span className="ml-2 font-mono text-text-muted">
                    ({p.method} • Ref: {p.transactionReference || "N/A"})
                  </span>
                  <div className="font-mono text-[11px] text-text-muted">
                    {new Date(p.paymentDate).toISOString().slice(0, 16).replace("T", " ")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MoneyDisplay amount={p.amount} />
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Record Manual / Partial Payment Modal */}
      <ModalDialog
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={`Record Payment for ${invoice.invoiceNumber}`}
        description={`Supports partial or full payment. Invoice becomes PAID only when outstanding balance (${formatINR(
          invoice.outstandingAmount
        )}) reaches ₹0.00.`}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={`Payment Amount (Max ₹${outstanding})`}
              required
              hint="Enter a smaller amount to record a partial payment"
            >
              <input
                type="number"
                step="0.01"
                max={outstanding}
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
            <FormField label="Payment Method" required>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 text-xs"
              >
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">BANK_TRANSFER (NEFT/RTGS)</option>
                <option value="CREDIT_CARD">CREDIT_CARD</option>
                <option value="DEBIT_CARD">DEBIT_CARD</option>
                <option value="CASH">CASH</option>
                <option value="OTHER">OTHER</option>
              </select>
            </FormField>
          </div>
          <FormField label="Transaction Reference / UTR Number">
            <input
              type="text"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g., UTR-HDFC-99882211"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
            />
          </FormField>
          <FormField label="Notes">
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setPayModalOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover"
            >
              {submitting ? "Recording..." : "Verify & Record Payment"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Razorpay Server Order + HMAC Verification Modal */}
      <ModalDialog
        open={Boolean(rzpOrder)}
        onClose={() => setRzpOrder(null)}
        title="Razorpay Gateway Order & HMAC SHA-256 Verification"
        description="Server-created Razorpay Order. Signature is cryptographically verified on the backend before updating invoice balance."
      >
        {rzpOrder && (
          <div className="space-y-4 text-xs font-mono">
            <div className="rounded-md border border-border bg-bg-subtle p-3.5 space-y-1.5">
              <div>
                <span className="text-text-muted">Order ID:</span>{" "}
                <strong>{rzpOrder.orderId}</strong>
              </div>
              <div>
                <span className="text-text-muted">Amount:</span>{" "}
                <strong>
                  {formatINR(rzpOrder.amount)} ({rzpOrder.amountInPaise} paise)
                </strong>
              </div>
              <div>
                <span className="text-text-muted">HMAC SHA-256 Signature:</span>
                <div className="truncate text-[10px] text-brand mt-0.5">
                  {rzpOrder.testSignaturePreview?.sampleSignature}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRzpOrder(null)}
                className="h-8 rounded-md border border-border px-3 font-sans text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleVerifyRazorpay}
                className="inline-flex items-center gap-1.5 h-8 rounded-md bg-emerald-600 px-4 font-sans text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <ShieldCheck className="h-4 w-4" />
                {submitting ? "Verifying HMAC..." : "Authorize & Verify Signature"}
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
