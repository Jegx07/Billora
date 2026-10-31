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
import { formatINR } from "@/lib/money";
import { ArrowRight, CheckCircle2, FileSpreadsheet, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

export default function QuotationsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Builder Modal State
  const [builderOpen, setBuilderOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [planId, setPlanId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [validityDays, setValidityDays] = useState("15");
  const [lines, setLines] = useState<
    { productId: string; variantId: string; quantity: number; taxRuleId: string }[]
  >([]);
  const [preview, setPreview] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        search,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/quotations?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        setQuotations(json.data);
        setTotalPages(json.meta?.totalPages || 1);
        setTotalRecords(json.meta?.total || json.data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  const openBuilder = async () => {
    setBuilderOpen(true);
    const [cRes, plRes, prRes, txRes, tplRes] = await Promise.all([
      fetch("/api/customers?pageSize=50").then((r) => r.json()),
      fetch("/api/plans").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/taxes").then((r) => r.json()),
      fetch("/api/quotation-templates").then((r) => r.json()),
    ]);

    const cList = cRes.data || [];
    const plList = plRes.data || [];
    const prList = prRes.data || [];
    const txList = txRes.data || [];
    const tplList = tplRes.data || [];

    setCustomers(cList);
    setPlans(plList);
    setProducts(prList);
    setTaxes(txList);
    setTemplates(tplList);

    if (cList[0]) setCustomerId(cList[0].id);
    if (plList[0]) setPlanId(plList[0].id);
    if (prList[0]) {
      setLines([
        {
          productId: prList[0].id,
          variantId: prList[0].variants?.[1]?.id || prList[0].variants?.[0]?.id || "",
          quantity: 1,
          taxRuleId: txList[0]?.id || "",
        },
      ]);
    }
  };

  // Server-calculated live pricing preview
  useEffect(() => {
    if (!builderOpen || lines.length === 0) return;
    const timer = setTimeout(async () => {
      const res = await fetch("/api/quotations/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            quantity: Number(l.quantity),
            taxRuleId: l.taxRuleId || null,
          })),
          discountCode: discountCode.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPreview(json.data);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [builderOpen, lines, discountCode]);

  const applyTemplate = (tplId: string) => {
    setTemplateId(tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setPlanId(tpl.planId);
    setValidityDays(String(tpl.validityDays));
    if (tpl.lines?.length) {
      setLines(
        tpl.lines.map((l: any) => ({
          productId: l.productId,
          variantId: l.variantId || "",
          quantity: l.defaultQuantity || 1,
          taxRuleId: tpl.taxRuleId || taxes[0]?.id || "",
        }))
      );
    }
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          planId,
          templateId: templateId || null,
          discountCode: discountCode.trim() || null,
          validityDays: Number(validityDays),
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            quantity: Number(l.quantity),
            taxRuleId: l.taxRuleId || null,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Quotation Error",
          description: json.error?.message,
          variant: "error",
        });
        return;
      }
      toast({
        title: `Quotation ${json.data.quotationNumber} Created`,
        description: `Server-calculated total: ${formatINR(json.data.totalAmount)}`,
        variant: "success",
      });
      setBuilderOpen(false);
      loadQuotations();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/quotations/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Status Update Failed",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: `Quotation marked ${status}`,
      variant: "info",
    });
    loadQuotations();
  };

  const handleConvert = async (id: string) => {
    const res = await fetch(`/api/quotations/${id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activateImmediately: true }),
    });
    const json = await res.json();
    if (!json.success) {
      toast({
        title: "Conversion Failed",
        description: json.error?.message,
        variant: "error",
      });
      return;
    }
    toast({
      title: "Converted to Subscription!",
      description: `Created ${json.data.subscriptionNumber} (${json.data.status})`,
      variant: "success",
    });
    router.push(`/subscriptions/${json.data.id}`);
  };

  return (
    <div>
      <PageHeader
        category="SALES & PROPOSAL ENGINE"
        title="Quotations & Reusable Templates"
        description="Build quotations from templates with live server-computed variant pricing, discounts, and GST, then convert confirmed quotations into subscriptions in 1 click."
        actions={
          <button
            type="button"
            onClick={openBuilder}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            New Quotation
          </button>
        }
      />

      <DataTable
        columns={[
          {
            key: "num",
            header: "Quotation #",
            mono: true,
            render: (r) => <span className="font-semibold text-brand">{r.quotationNumber}</span>,
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
            header: "Subscription Plan",
            render: (r) => (
              <div>
                <div className="font-medium text-text-primary">{r.plan?.name}</div>
                <div className="font-mono text-[10px] text-text-muted">
                  {r.plan?.billingFrequency}
                </div>
              </div>
            ),
          },
          {
            key: "expiry",
            header: "Valid Until",
            mono: true,
            render: (r) => r.expiryDate?.slice(0, 10),
          },
          {
            key: "total",
            header: "Total (Incl. Tax)",
            align: "right",
            render: (r) => <MoneyDisplay amount={r.totalAmount} />,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "actions",
            header: "Workflow Actions",
            align: "right",
            render: (r) => (
              <div className="flex items-center justify-end gap-1.5">
                {r.subscription ? (
                  <Link
                    href={`/subscriptions/${r.subscription.id}`}
                    className="inline-flex items-center gap-1 rounded bg-semantic-success-subtle px-2 py-1 font-mono text-[11px] font-semibold text-semantic-success"
                  >
                    {r.subscription.subscriptionNumber} →
                  </Link>
                ) : (
                  <>
                    {r.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(r.id, "QUOTATION")}
                        className="rounded border border-border bg-bg-subtle px-2 py-1 text-[11px] font-medium hover:border-brand"
                      >
                        Send Quote
                      </button>
                    )}
                    {(r.status === "DRAFT" || r.status === "QUOTATION") && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(r.id, "CONFIRMED")}
                        className="rounded bg-brand/10 border border-brand/30 px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white"
                      >
                        Confirm
                      </button>
                    )}
                    {r.status === "CONFIRMED" && (
                      <button
                        type="button"
                        onClick={() => handleConvert(r.id)}
                        className="inline-flex items-center gap-1 rounded bg-brand px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-hover"
                      >
                        Convert to Subscription
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ),
          },
        ]}
        data={quotations}
        rowKey={(r) => r.id}
        loading={loading}
        searchPlaceholder="Search QT number or customer..."
        searchValue={search}
        onSearchChange={setSearch}
        filterSlot={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs text-text-secondary"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="QUOTATION">QUOTATION</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        }
        page={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        onPageChange={setPage}
      />

      {/* Quotation Builder Modal */}
      <ModalDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title="Quotation Builder (Server-Side Pricing Preview)"
        description="Select a customer, optional template, and product variants. Prices, discounts, and GST are computed on the server."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveQuotation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Load Quotation Template">
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 text-xs"
              >
                <option value="">— Custom Quotation —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Customer" required>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 text-xs"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName || c.contactName} ({c.customerCode})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Subscription Plan" required>
              <select
                required
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 text-xs"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.billingFrequency})
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Product Lines */}
          <div className="rounded-lg border border-border p-3.5 space-y-3 bg-bg-subtle/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">
                Product & Variant Line Items
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!products[0]) return;
                  setLines((prev) => [
                    ...prev,
                    {
                      productId: products[0].id,
                      variantId: products[0].variants?.[0]?.id || "",
                      quantity: 1,
                      taxRuleId: taxes[0]?.id || "",
                    },
                  ]);
                }}
                className="text-xs font-medium text-brand hover:underline"
              >
                + Add Product Line
              </button>
            </div>

            {lines.map((line, idx) => {
              const selectedProd = products.find((p) => p.id === line.productId);
              const variants = selectedProd?.variants || [];
              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border-t border-border pt-2.5"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                      Product
                    </label>
                    <select
                      value={line.productId}
                      onChange={(e) => {
                        const newProd = products.find((p) => p.id === e.target.value);
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  productId: e.target.value,
                                  variantId: newProd?.variants?.[0]?.id || "",
                                }
                              : item
                          )
                        );
                      }}
                      className="h-8 w-full rounded border border-border bg-bg-base px-2 text-xs"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Base ₹{p.salesPrice})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                      Variant (+Delta)
                    </label>
                    <select
                      value={line.variantId}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, variantId: e.target.value } : item
                          )
                        )
                      }
                      className="h-8 w-full rounded border border-border bg-bg-base px-2 text-xs"
                    >
                      <option value="">Base (₹0)</option>
                      {variants.map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {v.name} (+₹{v.additionalPrice} = ₹{v.finalUnitPrice})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, quantity: Number(e.target.value) } : item
                          )
                        )
                      }
                      className="h-8 w-full rounded border border-border bg-bg-base px-2 font-mono text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                      Tax Rule
                    </label>
                    <select
                      value={line.taxRuleId}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, taxRuleId: e.target.value } : item
                          )
                        )
                      }
                      className="h-8 w-full rounded border border-border bg-bg-base px-2 text-xs"
                    >
                      <option value="">No Tax (0%)</option>
                      {taxes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.percentage}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-semantic-danger hover:bg-semantic-danger-subtle"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Discount Code (Optional)" hint="Try ENTERPRISE20 or FLAT500">
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                placeholder="ENTERPRISE20"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
            <FormField label="Validity Duration (Days)">
              <input
                type="number"
                min="1"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
          </div>

          {/* Live Server-Calculated Summary */}
          {preview && (
            <div className="rounded-lg border border-brand/30 bg-brand-subtle/40 p-4 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal (Base + Variant Prices):</span>
                <span>{formatINR(preview.subtotal)}</span>
              </div>
              <div className="flex justify-between text-semantic-success">
                <span>Discount ({preview.discountCode || "None"}):</span>
                <span>- {formatINR(preview.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Calculated GST / Tax:</span>
                <span>+ {formatINR(preview.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-text-primary">
                <span>Server-Computed Quotation Total:</span>
                <span className="text-brand">{formatINR(preview.totalAmount)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setBuilderOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover"
            >
              {submitting ? "Generating..." : "Save Quotation"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
