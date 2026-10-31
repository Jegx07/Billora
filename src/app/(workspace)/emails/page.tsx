"use client";

import {
  DataTable,
  FormField,
  ModalDialog,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Code,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  History,
  Inbox,
  Mail,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

interface EmailRecord {
  id: string;
  messageCode: string;
  senderEmail: string;
  recipientEmail: string;
  recipientName: string | null;
  cc: string | null;
  bcc: string | null;
  subject: string;
  bodyHtml: string;
  status: "DRAFT" | "SCHEDULED" | "QUEUED" | "ACCEPTED" | "DELIVERED" | "BOUNCED" | "FAILED";
  providerMessageId: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  template?: { templateCode: string; name: string } | null;
  customer?: { id: string; customerCode: string; contactName: string; companyName: string | null; email?: string } | null;
  subscription?: { id: string; subscriptionNumber: string } | null;
  deliveryEvents?: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
    details: string | null;
  }>;
}

interface TemplateRecord {
  id: string;
  templateCode: string;
  name: string;
  category: string;
  subject: string;
  bodyHtml: string;
  variables: string | null;
  isSystem: boolean;
}

interface CustomerOption {
  id: string;
  customerCode: string;
  contactName: string;
  companyName: string | null;
  email: string;
}

export default function EmailCentrePage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"history" | "compose" | "templates">("history");

  // History state
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Templates state
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Customers state
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // Composer Form state
  const [composeData, setComposeData] = useState({
    recipientEmail: "",
    recipientName: "",
    customerId: "",
    cc: "",
    bcc: "",
    subject: "",
    bodyHtml: "",
    templateId: "",
    scheduledFor: "",
  });
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [sending, setSending] = useState(false);

  // Email Preview / Details Modal
  const [inspectedEmail, setInspectedEmail] = useState<EmailRecord | null>(null);

  // Template Preview Modal
  const [inspectedTemplate, setInspectedTemplate] = useState<TemplateRecord | null>(null);

  // Load emails
  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const res = await fetch(`/api/emails?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEmails(json.data.items || []);
        setTotalPages(json.data.totalPages || 1);
        setTotalRecords(json.data.total || 0);
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Could not fetch email dispatch logs",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, toast]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/emails/templates");
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load customers
  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers?limit=100");
      const json = await res.json();
      if (json.success && json.data) {
        setCustomers(Array.isArray(json.data) ? json.data : json.data.items || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    loadTemplates();
    loadCustomers();
  }, [loadTemplates, loadCustomers]);

  // Handle template selection in composer
  const handleSelectTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) {
      setComposeData((prev) => ({ ...prev, templateId: "" }));
      return;
    }

    setComposeData((prev) => ({
      ...prev,
      templateId: tpl.id,
      subject: tpl.subject,
      bodyHtml: tpl.bodyHtml,
    }));
  };

  // Handle customer selection in composer
  const handleSelectCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) {
      setComposeData((prev) => ({ ...prev, customerId: "" }));
      return;
    }

    setComposeData((prev) => ({
      ...prev,
      customerId: cust.id,
      recipientEmail: cust.email || prev.recipientEmail,
      recipientName: cust.contactName || cust.companyName || "",
    }));
  };

  // Dynamic variable insertion helper
  const insertToken = (token: string) => {
    setComposeData((prev) => ({
      ...prev,
      bodyHtml: prev.bodyHtml + ` {{${token}}}`,
    }));
  };

  // Render preview with sample substitutions
  const renderedPreviewBody = React.useMemo(() => {
    let body = composeData.bodyHtml;
    const cust = customers.find((c) => c.id === composeData.customerId);
    const mockVals: Record<string, string> = {
      customer_name: composeData.recipientName || cust?.contactName || "Acme Executive",
      customer_code: cust?.customerCode || "CUST-1002",
      customer_email: composeData.recipientEmail || cust?.email || "billing@client.com",
      employee_name: "Billora Operations Agent",
      plan_name: "Enterprise Annual Commitment",
      renewal_date: "15-Nov-2026",
      invoice_number: "INV-2026-0089",
      invoice_amount: "₹12,000.00",
      payment_due_date: "22-Nov-2026",
      quotation_number: "QT-2026-0045",
      product_name: "Billora Revenue Cloud",
    };

    return body.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
      return mockVals[key] !== undefined ? mockVals[key] : `{{${key}}}`;
    });
  }, [composeData, customers]);

  // Dispatch / Schedule Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeData.recipientEmail.trim() || !composeData.subject.trim() || !composeData.bodyHtml.trim()) {
      toast({
        title: "Validation Error",
        description: "Recipient email, subject, and message body are required.",
        variant: "error",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: composeData.recipientEmail.trim(),
          recipientName: composeData.recipientName.trim() || undefined,
          customerId: composeData.customerId || undefined,
          cc: composeData.cc.trim() || undefined,
          bcc: composeData.bcc.trim() || undefined,
          subject: composeData.subject.trim(),
          bodyHtml: composeData.bodyHtml.trim(),
          templateId: composeData.templateId || undefined,
          scheduledFor: composeData.scheduledFor ? new Date(composeData.scheduledFor).toISOString() : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: composeData.scheduledFor ? "Email Scheduled" : "Email Dispatched",
          description: `Message ${json.data.messageCode} sent to ${composeData.recipientEmail}.`,
          variant: "success",
        });

        // Reset composer
        setComposeData({
          recipientEmail: "",
          recipientName: "",
          customerId: "",
          cc: "",
          bcc: "",
          subject: "",
          bodyHtml: "",
          templateId: "",
          scheduledFor: "",
        });
        setPreviewMode(false);
        setActiveTab("history");
        loadEmails();
      } else {
        toast({
          title: "Dispatch Failed",
          description: json.error?.message || "Failed to dispatch email",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Failed to connect to email service.",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  };

  const dynamicVariablesList = [
    { token: "customer_name", label: "Customer Name" },
    { token: "customer_email", label: "Customer Email" },
    { token: "employee_name", label: "Employee Name" },
    { token: "plan_name", label: "Plan Name" },
    { token: "renewal_date", label: "Renewal Date" },
    { token: "invoice_number", label: "Invoice Number" },
    { token: "invoice_amount", label: "Invoice Amount" },
    { token: "payment_due_date", label: "Due Date" },
    { token: "quotation_number", label: "Quotation #" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        category="COMMUNICATIONS INFRASTRUCTURE"
        title="Email Centre & Transactional Dispatch"
        description="Deliver lifecycle notifications, scheduled renewals, and automated customer communications with verifiable delivery tracking."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadEmails();
                loadTemplates();
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-bg-surface text-text-secondary hover:text-text-primary text-xs font-medium hover:bg-bg-subtle transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={() => setActiveTab("compose")}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-white hover:bg-brand-hover text-xs font-semibold shadow-sm transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              Compose Email
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            activeTab === "history"
              ? "bg-brand text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle"
          )}
        >
          <History className="h-3.5 w-3.5" />
          <span>Communications History</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">
            {totalRecords}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("compose")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            activeTab === "compose"
              ? "bg-brand text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle"
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Compose Email</span>
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            activeTab === "templates"
              ? "bg-brand text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle"
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Template Library</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">
            {templates.length}
          </span>
        </button>
      </div>

      {/* TAB 1: COMMUNICATIONS HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search by recipient, subject, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-9 pr-3 rounded-md border border-border bg-bg-surface text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="ALL">All Delivery Statuses</option>
                <option value="DELIVERED">Delivered</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="QUEUED">Queued</option>
                <option value="ACCEPTED">Accepted by Provider</option>
                <option value="BOUNCED">Bounced</option>
                <option value="FAILED">Failed</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>

          {/* History Table */}
          <DataTable
            rowKey={(r) => r.id}
            columns={[
              {
                key: "messageCode",
                header: "Message #",
                mono: true,
                render: (r: EmailRecord) => (
                  <button
                    onClick={() => setInspectedEmail(r)}
                    className="font-semibold text-brand hover:underline font-mono"
                  >
                    {r.messageCode}
                  </button>
                ),
              },
              {
                key: "recipient",
                header: "Recipient & Customer",
                render: (r: EmailRecord) => (
                  <div>
                    <div className="font-semibold text-text-primary">
                      {r.recipientEmail}
                    </div>
                    {r.customer && (
                      <div className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3" />
                        <span>{r.customer.contactName || r.customer.companyName}</span>
                        <span className="font-mono text-[10px]">({r.customer.customerCode})</span>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "subject",
                header: "Subject & Template",
                render: (r: EmailRecord) => (
                  <div>
                    <div
                      onClick={() => setInspectedEmail(r)}
                      className="font-medium text-text-primary hover:text-brand cursor-pointer line-clamp-1"
                    >
                      {r.subject}
                    </div>
                    {r.template && (
                      <span className="inline-block mt-0.5 text-[10px] font-mono text-brand bg-brand/10 px-1.5 py-0.2 rounded border border-brand/20">
                        {r.template.templateCode}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "providerMessageId",
                header: "Provider Ref",
                mono: true,
                render: (r: EmailRecord) => (
                  <div className="text-[11px] text-text-muted font-mono truncate max-w-[130px]">
                    {r.providerMessageId || "—"}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r: EmailRecord) => <StatusBadge status={r.status} />,
              },
              {
                key: "timestamp",
                header: "Dispatch Time",
                render: (r: EmailRecord) => (
                  <div className="text-xs text-text-muted font-mono">
                    {r.sentAt || r.scheduledFor || r.createdAt
                      ? new Date(r.sentAt || r.scheduledFor || r.createdAt).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                    {r.scheduledFor && new Date(r.scheduledFor) > new Date() && (
                      <span className="block text-[10px] text-brand">Scheduled</span>
                    )}
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                render: (r: EmailRecord) => (
                  <button
                    onClick={() => setInspectedEmail(r)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-bg-subtle border border-border text-xs text-text-secondary hover:text-brand hover:border-brand/40 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </button>
                ),
              },
            ]}
            data={emails}
            loading={loading}
            totalRecords={totalRecords}
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* TAB 2: COMPOSE EMAIL */}
      {activeTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Compose Form */}
          <div className="lg:col-span-2 space-y-4 rounded-lg border border-border bg-bg-surface p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">
                New Email Communication
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors",
                    previewMode
                      ? "bg-brand text-white border-brand"
                      : "border-border text-text-secondary hover:text-text-primary bg-bg-subtle"
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {previewMode ? "Edit HTML" : "Live Preview"}
                </button>
              </div>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              {/* Template quick loader */}
              <div className="p-3 rounded-md bg-bg-subtle border border-border">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Load Pre-Approved Template
                </label>
                <select
                  value={composeData.templateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">Start from blank / Scratch</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.templateCode}] {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Select Customer (Optional)">
                  <select
                    value={composeData.customerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="">Manual email address...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contactName || c.companyName} ({c.email || c.customerCode})
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Recipient Email Address" required>
                  <input
                    type="email"
                    required
                    placeholder="name@customer.com"
                    value={composeData.recipientEmail}
                    onChange={(e) =>
                      setComposeData({ ...composeData, recipientEmail: e.target.value })
                    }
                    className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </FormField>
              </div>

              {/* CC / BCC Toggle */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  className="text-xs text-brand hover:underline font-medium"
                >
                  {showCcBcc ? "Hide CC / BCC" : "+ Add CC / BCC"}
                </button>
              </div>

              {showCcBcc && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-bg-subtle border border-border">
                  <FormField label="CC">
                    <input
                      type="text"
                      placeholder="colleague@domain.com, manager@domain.com"
                      value={composeData.cc}
                      onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </FormField>
                  <FormField label="BCC">
                    <input
                      type="text"
                      placeholder="archive@billora.io"
                      value={composeData.bcc}
                      onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </FormField>
                </div>
              )}

              {/* Subject */}
              <FormField label="Subject" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. Action Required: Subscription Renewal for {{plan_name}}"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </FormField>

              {/* Body or Live Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-text-secondary">
                    Message Body (HTML Supported)
                  </label>
                  <span className="text-[11px] text-text-muted">
                    Click dynamic tokens on right to insert
                  </span>
                </div>

                {previewMode ? (
                  <div className="min-h-[260px] p-4 rounded-md border border-border bg-white text-slate-900 text-xs overflow-y-auto">
                    <div className="text-[11px] text-slate-400 border-b pb-2 mb-3">
                      <strong>Subject: </strong>
                      {composeData.subject || "(Empty Subject)"}
                    </div>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderedPreviewBody || "<p style='color:#999;'>No content</p>",
                      }}
                    />
                  </div>
                ) : (
                  <textarea
                    rows={12}
                    required
                    placeholder="Enter email content with HTML tags and dynamic placeholders like {{customer_name}}..."
                    value={composeData.bodyHtml}
                    onChange={(e) =>
                      setComposeData({ ...composeData, bodyHtml: e.target.value })
                    }
                    className="w-full p-3 rounded-md border border-border bg-bg-surface text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand leading-relaxed"
                  />
                )}
              </div>

              {/* Schedule and Dispatch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-text-muted" />
                  <span className="text-xs text-text-secondary whitespace-nowrap">
                    Schedule for:
                  </span>
                  <input
                    type="datetime-local"
                    value={composeData.scheduledFor}
                    onChange={(e) =>
                      setComposeData({ ...composeData, scheduledFor: e.target.value })
                    }
                    className="h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setComposeData({
                        recipientEmail: "",
                        recipientName: "",
                        customerId: "",
                        cc: "",
                        bcc: "",
                        subject: "",
                        bodyHtml: "",
                        templateId: "",
                        scheduledFor: "",
                      });
                      setPreviewMode(false);
                    }}
                    className="px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-text-primary"
                  >
                    Clear
                  </button>

                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-brand text-white text-xs font-semibold hover:bg-brand-hover shadow-sm disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending
                      ? "Processing..."
                      : composeData.scheduledFor
                      ? "Schedule Email"
                      : "Send Immediately"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Dynamic Variables Side Panel */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-bg-surface p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary mb-2">
                <Sparkles className="h-4 w-4 text-brand" />
                <span>Dynamic Variable Palette</span>
              </div>
              <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                Click any placeholder to append it into your email body. Variables are replaced with verified entity data during dispatch.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dynamicVariablesList.map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => insertToken(item.token)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg-subtle border border-border text-[11px] font-mono text-text-secondary hover:text-brand hover:border-brand/40 transition-colors"
                  >
                    <Plus className="h-2.5 w-2.5 text-brand" />
                    {"{{"}
                    {item.token}
                    {"}}"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg-surface p-4 text-xs space-y-2">
              <h4 className="font-semibold text-text-primary flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Provider Delivery Guarantee</span>
              </h4>
              <p className="text-text-muted leading-relaxed text-[11px]">
                Transactional emails are routed via provider APIs with real-time webhook confirmation, generating cryptographically verified message IDs.
              </p>
              <div className="pt-2 text-[10px] font-mono text-text-muted">
                Sender: billing@billora.io
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEMPLATE LIBRARY */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
            {[
              "ALL",
              "ONBOARDING",
              "BILLING",
              "RENEWAL",
              "PAYMENT",
              "OVERDUE",
              "QUOTATION",
              "LIFECYCLE",
            ].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  selectedCategory === cat
                    ? "bg-bg-subtle text-text-primary border border-border font-semibold"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates
              .filter(
                (t) => selectedCategory === "ALL" || t.category === selectedCategory
              )
              .map((template) => {
                const vars: string[] = template.variables
                  ? JSON.parse(template.variables)
                  : [];

                return (
                  <div
                    key={template.id}
                    className="flex flex-col justify-between rounded-lg border border-border bg-bg-surface p-4.5 hover:border-brand/40 hover:shadow-sm transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-semibold text-brand">
                          {template.templateCode}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-bg-subtle text-text-secondary border border-border uppercase">
                          {template.category}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-text-primary mb-1">
                        {template.name}
                      </h3>

                      <p className="text-xs text-text-muted font-mono line-clamp-1 mb-3">
                        Subject: {template.subject}
                      </p>

                      {/* Variables pill list */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {vars.slice(0, 4).map((v) => (
                          <span
                            key={v}
                            className="px-1.5 py-0.5 rounded bg-bg-subtle text-[10px] font-mono text-text-muted border border-border/80"
                          >
                            {"{{"}
                            {v}
                            {"}}"}
                          </span>
                        ))}
                        {vars.length > 4 && (
                          <span className="text-[10px] text-text-muted self-center">
                            +{vars.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <button
                        onClick={() => setInspectedTemplate(template)}
                        className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview HTML
                      </button>

                      <button
                        onClick={() => {
                          setComposeData((prev) => ({
                            ...prev,
                            templateId: template.id,
                            subject: template.subject,
                            bodyHtml: template.bodyHtml,
                          }));
                          setActiveTab("compose");
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors"
                      >
                        <Mail className="h-3 w-3" />
                        Use in Composer
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* EMAIL INSPECT MODAL */}
      {inspectedEmail && (
        <ModalDialog
          open={Boolean(inspectedEmail)}
          onClose={() => setInspectedEmail(null)}
          title={`Email Dispatch: ${inspectedEmail.messageCode}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto pr-1">
            <div className="p-3 rounded-md bg-bg-subtle border border-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Delivery Status:</span>
                <StatusBadge status={inspectedEmail.status} />
              </div>
              <div>
                <span className="text-text-muted">Provider Message ID: </span>
                <span className="font-mono text-text-primary">
                  {inspectedEmail.providerMessageId || "None"}
                </span>
              </div>
              <div>
                <span className="text-text-muted">To: </span>
                <span className="font-medium text-text-primary">
                  {inspectedEmail.recipientEmail}
                </span>
                {inspectedEmail.recipientName && (
                  <span className="text-text-muted"> ({inspectedEmail.recipientName})</span>
                )}
              </div>
              {inspectedEmail.customer && (
                <div>
                  <span className="text-text-muted">Customer: </span>
                  <span className="font-medium text-text-primary">
                    {inspectedEmail.customer.contactName || inspectedEmail.customer.companyName} (
                    {inspectedEmail.customer.customerCode})
                  </span>
                </div>
              )}
              <div>
                <span className="text-text-muted">Subject: </span>
                <span className="font-semibold text-text-primary">
                  {inspectedEmail.subject}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Timestamp: </span>
                <span className="font-mono text-text-primary">
                  {new Date(
                    inspectedEmail.sentAt || inspectedEmail.createdAt
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Delivery Events Timeline */}
            {inspectedEmail.deliveryEvents && inspectedEmail.deliveryEvents.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-primary mb-2">
                  Delivery Events Timeline
                </h4>
                <div className="space-y-1.5">
                  {inspectedEmail.deliveryEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between p-2 rounded bg-bg-surface border border-border text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="font-mono font-semibold text-text-primary">
                          {evt.eventType}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">
                        {new Date(evt.occurredAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Render Preview */}
            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-2">
                Rendered HTML Content
              </h4>
              <div
                className="p-4 rounded-md border border-border bg-white text-slate-900 text-xs overflow-y-auto max-h-96"
                dangerouslySetInnerHTML={{ __html: inspectedEmail.bodyHtml }}
              />
            </div>
          </div>
        </ModalDialog>
      )}

      {/* TEMPLATE PREVIEW MODAL */}
      {inspectedTemplate && (
        <ModalDialog
          open={Boolean(inspectedTemplate)}
          onClose={() => setInspectedTemplate(null)}
          title={`Template: ${inspectedTemplate.templateCode}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto pr-1">
            <div className="p-3 rounded-md bg-bg-subtle border border-border text-xs space-y-1">
              <div>
                <span className="text-text-muted">Name: </span>
                <span className="font-semibold text-text-primary">
                  {inspectedTemplate.name}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Category: </span>
                <span className="font-medium text-text-primary">
                  {inspectedTemplate.category}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Subject Pattern: </span>
                <span className="font-mono text-text-primary">
                  {inspectedTemplate.subject}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-2">
                Template Preview
              </h4>
              <div
                className="p-4 rounded-md border border-border bg-white text-slate-900 text-xs overflow-y-auto max-h-96"
                dangerouslySetInnerHTML={{ __html: inspectedTemplate.bodyHtml }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setComposeData((prev) => ({
                    ...prev,
                    templateId: inspectedTemplate.id,
                    subject: inspectedTemplate.subject,
                    bodyHtml: inspectedTemplate.bodyHtml,
                  }));
                  setInspectedTemplate(null);
                  setActiveTab("compose");
                }}
                className="px-3 py-1.5 rounded-md bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors"
              >
                Use in Composer
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
