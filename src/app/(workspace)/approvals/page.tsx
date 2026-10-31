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
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  LayoutGrid,
  List,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

interface ApprovalItem {
  id: string;
  approvalCode: string;
  type:
    | "DISCOUNT_OVERRIDE"
    | "CANCELLATION"
    | "REFUND"
    | "HIGH_VALUE_QUOTATION"
    | "BULK_EMAIL"
    | "TASK_COMPLETION";
  title: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionComment: string | null;
  requestedAt: string;
  decidedAt: string | null;
  metadata: string | null;
  requestedBy: { id: string; fullName: string; email: string };
  approver?: { id: string; fullName: string; email: string } | null;
  task?: { id: string; taskCode: string; title: string; priority: string } | null;
  workflowExecution?: { id: string; executionCode: string; workflow?: { name: string } } | null;
}

export default function ApprovalsPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Metrics state
  const [pendingCount, setPendingCount] = useState(0);

  // Action Modals
  const [decideModal, setDecideModal] = useState<{
    open: boolean;
    approval: ApprovalItem | null;
    decision: "APPROVED" | "REJECTED";
  }>({
    open: false,
    approval: null,
    decision: "APPROVED",
  });
  const [decisionNote, setDecisionNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  // Details Modal
  const [inspectedApproval, setInspectedApproval] = useState<ApprovalItem | null>(null);

  // New Approval Request Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [newApproval, setNewApproval] = useState({
    type: "DISCOUNT_OVERRIDE" as ApprovalItem["type"],
    title: "",
    description: "",
    impact: "",
  });

  // Load approvals
  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        status: activeTab,
        ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
      });

      const res = await fetch(`/api/approvals?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setApprovals(json.data.items || []);
        setTotalPages(json.data.totalPages || 1);
        setTotalRecords(json.data.total || 0);
        if (activeTab === "PENDING") {
          setPendingCount(json.data.total || 0);
        }
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Failed to load approval requests",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, typeFilter, page, toast]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  // Handle Approve / Reject decision
  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decideModal.approval) return;

    if (decideModal.decision === "REJECTED" && !decisionNote.trim()) {
      toast({
        title: "Rejection Rationale Required",
        description: "Please provide a reason when rejecting an approval request.",
        variant: "error",
      });
      return;
    }

    setDeciding(true);
    try {
      const res = await fetch(`/api/approvals/${decideModal.approval.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decideModal.decision,
          comment: decisionNote.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: `Request ${decideModal.decision === "APPROVED" ? "Approved" : "Rejected"}`,
          description: `Decision recorded for ${decideModal.approval.approvalCode}. Resuming downstream workflow.`,
          variant: "success",
        });
        setDecideModal({ open: false, approval: null, decision: "APPROVED" });
        setDecisionNote("");
        setInspectedApproval(null);
        loadApprovals();
      } else {
        toast({
          title: "Decision Failed",
          description: json.error?.message || "Could not record decision",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Failed to submit decision",
        variant: "error",
      });
    } finally {
      setDeciding(false);
    }
  };

  // Submit new approval request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApproval.title.trim()) {
      toast({ title: "Title is required", description: "Please enter a descriptive title", variant: "error" });
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newApproval.type,
          title: newApproval.title.trim(),
          description: newApproval.description.trim() || undefined,
          metadata: newApproval.impact.trim() ? { impactNotes: newApproval.impact.trim() } : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: "Approval Requested",
          description: `Request ${json.data.approvalCode} submitted to leadership.`,
          variant: "success",
        });
        setCreateModalOpen(false);
        setNewApproval({
          type: "DISCOUNT_OVERRIDE",
          title: "",
          description: "",
          impact: "",
        });
        loadApprovals();
      } else {
        toast({
          title: "Submission Error",
          description: json.error?.message || "Could not submit request",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Network error occurred",
        variant: "error",
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case "DISCOUNT_OVERRIDE":
        return "bg-amber-500/10 text-amber-500 border-amber-500/25";
      case "CANCELLATION":
        return "bg-rose-500/10 text-rose-500 border-rose-500/25";
      case "REFUND":
        return "bg-purple-500/10 text-purple-500 border-purple-500/25";
      case "HIGH_VALUE_QUOTATION":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/25";
      case "BULK_EMAIL":
        return "bg-blue-500/10 text-blue-500 border-blue-500/25";
      case "TASK_COMPLETION":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/25";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/25";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        category="GOVERNANCE & COMPLIANCE"
        title="Approval Centre & Operations Control"
        description="Review financial overrides, subscription cancellations, high-value quotations, and operational sign-offs."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadApprovals()}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-bg-surface text-text-secondary hover:text-text-primary text-xs font-medium hover:bg-bg-subtle transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-white hover:bg-brand-hover text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Request Approval
            </button>
          </div>
        }
      />

      {/* Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1.5">
          {[
            { id: "PENDING", label: "Pending Decisions", count: pendingCount },
            { id: "APPROVED", label: "Approved History" },
            { id: "REJECTED", label: "Rejected / Declined" },
            { id: "ALL", label: "All Requests" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeTab === tab.id
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle"
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-md border border-border bg-bg-subtle p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              viewMode === "grid"
                ? "bg-bg-surface text-text-primary shadow-xs"
                : "text-text-muted hover:text-text-primary"
            )}
            title="Card Grid View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              viewMode === "table"
                ? "bg-bg-surface text-text-primary shadow-xs"
                : "text-text-muted hover:text-text-primary"
            )}
            title="Table List View"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Request Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="ALL">All Categories</option>
            <option value="DISCOUNT_OVERRIDE">Discount Override</option>
            <option value="CANCELLATION">Subscription Cancellation</option>
            <option value="REFUND">Refund Issuance</option>
            <option value="HIGH_VALUE_QUOTATION">High-Value Quotation</option>
            <option value="BULK_EMAIL">Bulk Customer Email</option>
            <option value="TASK_COMPLETION">Employee Task Sign-Off</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-surface/50 p-12 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500/40 mb-3" />
          <h3 className="text-sm font-semibold text-text-primary">No approvals found</h3>
          <p className="mt-1 text-xs text-text-muted max-w-sm mx-auto">
            {activeTab === "PENDING"
              ? "All clear! There are no pending governance or override requests awaiting decision."
              : "No approval records match your current filter."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {approvals.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-lg border border-border bg-bg-surface p-4.5 hover:border-brand/40 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-semibold text-brand">
                    {item.approvalCode}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-semibold border uppercase",
                        getTypeBadgeStyle(item.type)
                      )}
                    >
                      {item.type.replace(/_/g, " ")}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>

                <h3
                  onClick={() => setInspectedApproval(item)}
                  className="text-sm font-semibold text-text-primary hover:text-brand cursor-pointer line-clamp-1 mb-1"
                >
                  {item.title}
                </h3>

                {item.description && (
                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed mb-3">
                    {item.description}
                  </p>
                )}

                {/* Linked Task or Workflow */}
                <div className="space-y-1 text-xs">
                  {item.task && (
                    <div className="text-[11px] text-text-muted">
                      Task: <span className="font-mono text-brand font-medium">{item.task.taskCode}</span> - {item.task.title}
                    </div>
                  )}
                  {item.workflowExecution && (
                    <div className="text-[11px] text-text-muted">
                      Workflow: <span className="text-text-primary font-medium">{item.workflowExecution.workflow?.name}</span>
                    </div>
                  )}
                  {item.decisionComment && (
                    <div className="p-2 rounded bg-bg-subtle text-[11px] text-text-secondary border border-border mt-2">
                      <span className="font-semibold text-text-primary">Decision Note: </span>
                      {item.decisionComment}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                <div>
                  <div className="text-[11px] text-text-muted">
                    Requested by <span className="font-medium text-text-primary">{item.requestedBy.fullName}</span>
                  </div>
                  <div className="font-mono text-[10px] text-text-muted">
                    {new Date(item.requestedAt).toLocaleDateString()}
                  </div>
                </div>

                {item.status === "PENDING" ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setDecideModal({
                          open: true,
                          approval: item,
                          decision: "REJECTED",
                        })
                      }
                      className="px-2.5 py-1 rounded border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-medium transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() =>
                        setDecideModal({
                          open: true,
                          approval: item,
                          decision: "APPROVED",
                        })
                      }
                      className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-xs transition-colors"
                    >
                      Approve
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setInspectedApproval(item)}
                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Details
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <DataTable
          rowKey={(r) => r.id}
          columns={[
            {
              key: "approvalCode",
              header: "Approval #",
              mono: true,
              render: (r: ApprovalItem) => (
                <button
                  onClick={() => setInspectedApproval(r)}
                  className="font-semibold text-brand hover:underline font-mono"
                >
                  {r.approvalCode}
                </button>
              ),
            },
            {
              key: "type",
              header: "Category",
              render: (r: ApprovalItem) => (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-semibold border uppercase",
                    getTypeBadgeStyle(r.type)
                  )}
                >
                  {r.type.replace(/_/g, " ")}
                </span>
              ),
            },
            {
              key: "title",
              header: "Request Title & Impact",
              render: (r: ApprovalItem) => (
                <div>
                  <div
                    onClick={() => setInspectedApproval(r)}
                    className="font-semibold text-text-primary hover:text-brand cursor-pointer line-clamp-1"
                  >
                    {r.title}
                  </div>
                  {r.task && (
                    <div className="text-[11px] text-text-muted mt-0.5">
                      Linked Task: {r.task.taskCode}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "requestedBy",
              header: "Requester",
              render: (r: ApprovalItem) => (
                <div className="text-xs text-text-primary">
                  {r.requestedBy.fullName}
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r: ApprovalItem) => <StatusBadge status={r.status} />,
            },
            {
              key: "requestedAt",
              header: "Submitted",
              render: (r: ApprovalItem) => (
                <div className="text-xs text-text-muted font-mono">
                  {new Date(r.requestedAt).toLocaleDateString()}
                </div>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              render: (r: ApprovalItem) =>
                r.status === "PENDING" ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setDecideModal({
                          open: true,
                          approval: r,
                          decision: "APPROVED",
                        })
                      }
                      className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        setDecideModal({
                          open: true,
                          approval: r,
                          decision: "REJECTED",
                        })
                      }
                      className="px-2 py-1 rounded border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-medium"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setInspectedApproval(r)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-bg-subtle border border-border text-xs text-text-secondary hover:text-brand"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Details
                  </button>
                ),
            },
          ]}
          data={approvals}
          totalRecords={totalRecords}
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => setPage(p)}
        />
      )}

      {/* DECIDE MODAL (APPROVE / REJECT) */}
      <ModalDialog
        open={decideModal.open}
        onClose={() => setDecideModal({ open: false, approval: null, decision: "APPROVED" })}
        title={`${decideModal.decision === "APPROVED" ? "Approve" : "Reject"} Request: ${decideModal.approval?.approvalCode}`}
        description={
          decideModal.decision === "APPROVED"
            ? "Confirming approval will immediately execute downstream workflow steps and notify the requesting employee."
            : "Please enter a mandatory rejection reason. Downstream tasks will be blocked and the employee will be alerted."
        }
        maxWidth="md"
      >
        <form onSubmit={handleDecision} className="space-y-4 pt-2">
          <FormField
            label={decideModal.decision === "APPROVED" ? "Approval Comment (Optional)" : "Rejection Rationale"}
            required={decideModal.decision === "REJECTED"}
          >
            <textarea
              rows={3}
              required={decideModal.decision === "REJECTED"}
              placeholder={
                decideModal.decision === "APPROVED"
                  ? "e.g. Terms reviewed and financial override authorized."
                  : "e.g. Discount exceeds permitted departmental ceiling. Please revise to 10% max."
              }
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              className="w-full p-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDecideModal({ open: false, approval: null, decision: "APPROVED" })}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deciding}
              className={cn(
                "px-3.5 py-1.5 rounded-md text-xs font-semibold text-white shadow-sm transition-colors",
                decideModal.decision === "APPROVED"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {deciding
                ? "Processing..."
                : decideModal.decision === "APPROVED"
                ? "Confirm Approval"
                : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* CREATE APPROVAL REQUEST MODAL */}
      <ModalDialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Submit Approval Request"
        description="Request management sign-off for financial overrides or critical actions."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4 pt-2">
          <FormField label="Approval Category" required>
            <select
              value={newApproval.type}
              onChange={(e) =>
                setNewApproval({
                  ...newApproval,
                  type: e.target.value as ApprovalItem["type"],
                })
              }
              className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="DISCOUNT_OVERRIDE">Discount Override</option>
              <option value="CANCELLATION">Subscription Cancellation</option>
              <option value="REFUND">Refund Issuance</option>
              <option value="HIGH_VALUE_QUOTATION">High-Value Quotation</option>
              <option value="BULK_EMAIL">Bulk Customer Email</option>
              <option value="TASK_COMPLETION">Employee Task Completion</option>
            </select>
          </FormField>

          <FormField label="Request Title" required>
            <input
              type="text"
              required
              placeholder="e.g. 20% Special Discount Approval for Key Account Acme Corp"
              value={newApproval.title}
              onChange={(e) => setNewApproval({ ...newApproval, title: e.target.value })}
              className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>

          <FormField label="Description & Justification">
            <textarea
              rows={3}
              placeholder="Provide background, customer agreement terms, or operational justification..."
              value={newApproval.description}
              onChange={(e) =>
                setNewApproval({ ...newApproval, description: e.target.value })
              }
              className="w-full p-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>

          <FormField label="Financial / Operational Impact">
            <input
              type="text"
              placeholder="e.g. ₹24,000 ARR impact; client commits to 2-year term"
              value={newApproval.impact}
              onChange={(e) => setNewApproval({ ...newApproval, impact: e.target.value })}
              className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSubmitting}
              className="px-3.5 py-1.5 rounded-md bg-brand text-white text-xs font-semibold hover:bg-brand-hover shadow-sm transition-colors"
            >
              {createSubmitting ? "Submitting..." : "Submit for Approval"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* INSPECT DETAILS MODAL */}
      {inspectedApproval && (
        <ModalDialog
          open={Boolean(inspectedApproval)}
          onClose={() => setInspectedApproval(null)}
          title={`Approval Request: ${inspectedApproval.approvalCode}`}
          maxWidth="lg"
        >
          <div className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto pr-1 text-xs">
            <div className="p-3 rounded-md bg-bg-subtle border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-semibold border uppercase",
                    getTypeBadgeStyle(inspectedApproval.type)
                  )}
                >
                  {inspectedApproval.type.replace(/_/g, " ")}
                </span>
                <StatusBadge status={inspectedApproval.status} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">
                {inspectedApproval.title}
              </h3>
              {inspectedApproval.description && (
                <p className="text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {inspectedApproval.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-md border border-border bg-bg-surface">
              <div>
                <span className="text-text-muted block text-[11px]">Requested By</span>
                <span className="font-medium text-text-primary">
                  {inspectedApproval.requestedBy.fullName}
                </span>
                <span className="text-text-muted block font-mono text-[10px]">
                  {inspectedApproval.requestedBy.email}
                </span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Submission Date</span>
                <span className="font-mono text-text-primary">
                  {new Date(inspectedApproval.requestedAt).toLocaleString()}
                </span>
              </div>
            </div>

            {inspectedApproval.decidedAt && (
              <div className="p-3 rounded-md border border-border bg-bg-surface space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Decided By:</span>
                  <span className="font-medium text-text-primary">
                    {inspectedApproval.approver?.fullName || "Supervisor"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Decision Date:</span>
                  <span className="font-mono text-text-primary">
                    {new Date(inspectedApproval.decidedAt).toLocaleString()}
                  </span>
                </div>
                {inspectedApproval.decisionComment && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-text-muted block mb-1">Decision Comment:</span>
                    <div className="p-2 rounded bg-bg-subtle text-text-primary font-medium">
                      {inspectedApproval.decisionComment}
                    </div>
                  </div>
                )}
              </div>
            )}

            {inspectedApproval.status === "PENDING" && (
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  onClick={() =>
                    setDecideModal({
                      open: true,
                      approval: inspectedApproval,
                      decision: "REJECTED",
                    })
                  }
                  className="px-3 py-1.5 rounded-md border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-medium"
                >
                  Reject
                </button>
                <button
                  onClick={() =>
                    setDecideModal({
                      open: true,
                      approval: inspectedApproval,
                      decision: "APPROVED",
                    })
                  }
                  className="px-3.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-xs"
                >
                  Approve Request
                </button>
              </div>
            )}
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
