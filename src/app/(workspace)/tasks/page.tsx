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
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Layers,
  LayoutGrid,
  List,
  MessageSquare,
  MoreVertical,
  Pause,
  PhoneCall,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";

interface TaskItem {
  id: string;
  taskCode: string;
  title: string;
  description: string | null;
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status:
    | "ASSIGNED"
    | "ACCEPTED"
    | "IN_PROGRESS"
    | "ON_HOLD"
    | "BLOCKED"
    | "AWAITING_APPROVAL"
    | "COMPLETED"
    | "CANCELLED";
  progress: number;
  blockerReason: string | null;
  startDate: string;
  dueDate: string | null;
  completedAt: string | null;
  isOverdue?: boolean;
  assignee?: { id: string; fullName: string; email: string } | null;
  creator?: { id: string; fullName: string; email: string } | null;
  manager?: { id: string; fullName: string; email: string } | null;
  customer?: { id: string; customerCode: string; contactName: string; companyName: string | null; email?: string; phone?: string } | null;
  subscription?: { id: string; subscriptionNumber: string; status: string; totalAmount: number; plan?: { name: string } } | null;
  invoice?: { id: string; invoiceNumber: string; totalAmount: number; status: string } | null;
  quotation?: { id: string; quotationNumber: string; totalAmount: number; status: string } | null;
  workflow?: { id: string; workflowCode: string; name: string } | null;
  workflowExecution?: { id: string; executionCode: string; status: string } | null;
  comments?: Array<{
    id: string;
    content: string;
    isInternal: boolean;
    createdAt: string;
    author: { id: string; fullName: string; email: string };
  }>;
  _count?: { comments: number; collaborators: number };
}

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role?: { name: string };
}

interface CustomerOption {
  id: string;
  customerCode: string;
  contactName: string;
  companyName: string | null;
}

export default function MyTasksPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<
    "assigned_to_me" | "created_by_me" | "all" | "overdue" | "awaiting_approval" | "completed"
  >("assigned_to_me");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Metrics & Team state
  const [metrics, setMetrics] = useState<{
    myPendingTasks: number;
    myOverdueTasks: number;
    allOpenTasks: number;
    pendingApprovals: number;
  }>({
    myPendingTasks: 0,
    myOverdueTasks: 0,
    allOpenTasks: 0,
    pendingApprovals: 0,
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // Task Drawer / Details state
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [isCustomerInteraction, setIsCustomerInteraction] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [customProgress, setCustomProgress] = useState<number>(0);
  const [blockerModalOpen, setBlockerModalOpen] = useState(false);
  const [blockerText, setBlockerText] = useState("");
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");

  // Create Task Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "CUSTOMER_ONBOARDING",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    assigneeId: "",
    managerId: "",
    customerId: "",
    dueDate: "",
  });

  // Load metrics & team members
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/overview");
      const json = await res.json();
      if (json.success) {
        setMetrics(json.data.metrics);
        if (json.data.teamMembers) {
          setTeamMembers(json.data.teamMembers);
        }
      }
    } catch {
      // silently fallback
    }
  }, []);

  // Load customer options for create task
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

  // Load tasks with filters
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        page: String(page),
        limit: "30",
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(priorityFilter !== "ALL" ? { priority: priorityFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setTasks(json.data.items || []);
        setTotalPages(json.data.totalPages || 1);
        setTotalRecords(json.data.total || 0);
      } else {
        toast({
          title: "Error fetching tasks",
          description: json.error?.message || "Failed to load tasks",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Could not load task records",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, statusFilter, priorityFilter, search, toast]);

  useEffect(() => {
    loadOverview();
    loadCustomers();
  }, [loadOverview, loadCustomers]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load full details for selected task
  const openTaskDetail = async (task: TaskItem) => {
    setSelectedTask(task);
    setCustomProgress(task.progress || 0);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      const json = await res.json();
      if (json.success) {
        setSelectedTask(json.data);
        setCustomProgress(json.data.progress || 0);
      }
    } catch {
      // use local preview
    } finally {
      setDetailLoading(false);
    }
  };

  // Update task status or progress
  const updateTaskStatus = async (
    status?: string,
    progressVal?: number,
    blockerReasonText?: string | null
  ) => {
    if (!selectedTask) return;
    try {
      const payload: any = {};
      if (status !== undefined) payload.status = status;
      if (progressVal !== undefined) payload.progress = progressVal;
      if (blockerReasonText !== undefined) payload.blockerReason = blockerReasonText;

      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        toast({
          title: "Task Updated",
          description: `Task status updated to ${status || selectedTask.status}`,
          variant: "success",
        });
        openTaskDetail({ ...selectedTask, ...payload });
        loadTasks();
        loadOverview();
      } else {
        toast({
          title: "Update Failed",
          description: json.error?.message || "Could not update task",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Request failed to execute",
        variant: "error",
      });
    }
  };

  // Post comment or customer interaction
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newCommentText.trim()) return;

    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newCommentText.trim(),
          isInternal: !isCustomerInteraction,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast({
          title: isCustomerInteraction ? "Customer Contact Logged" : "Comment Added",
          description: "Activity recorded successfully.",
          variant: "success",
        });
        setNewCommentText("");
        // refresh task details
        openTaskDetail(selectedTask);
      } else {
        toast({
          title: "Error",
          description: json.error?.message || "Failed to add comment",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Could not submit note",
        variant: "error",
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) {
      toast({ title: "Validation Error", description: "Title is required", variant: "error" });
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || undefined,
          category: newTask.category,
          priority: newTask.priority,
          assigneeId: newTask.assigneeId || undefined,
          managerId: newTask.managerId || undefined,
          customerId: newTask.customerId || undefined,
          dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : undefined,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast({
          title: "Task Created",
          description: `Task ${json.data.taskCode} has been assigned.`,
          variant: "success",
        });
        setCreateModalOpen(false);
        setNewTask({
          title: "",
          description: "",
          category: "CUSTOMER_ONBOARDING",
          priority: "MEDIUM",
          assigneeId: "",
          managerId: "",
          customerId: "",
          dueDate: "",
        });
        loadTasks();
        loadOverview();
      } else {
        toast({
          title: "Creation Failed",
          description: json.error?.message || "Could not create task",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "error",
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Submit approval request for task sign-off
  const handleRequestApproval = async () => {
    if (!selectedTask) return;
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TASK_COMPLETION",
          title: `Sign-off for Task ${selectedTask.taskCode}: ${selectedTask.title}`,
          description: approvalNote.trim() || `Sign-off requested by responsible assignee for ${selectedTask.title}`,
          taskId: selectedTask.id,
          entityType: "WorkflowTask",
          entityId: selectedTask.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Approval Requested",
          description: `Request ${json.data.approvalCode} sent to manager.`,
          variant: "success",
        });
        setApprovalModalOpen(false);
        setApprovalNote("");
        updateTaskStatus("AWAITING_APPROVAL");
      } else {
        toast({
          title: "Failed",
          description: json.error?.message || "Could not request approval",
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to submit approval request",
        variant: "error",
      });
    }
  };

  // Priority color styling helper
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-rose-500/10 text-rose-500 border-rose-500/25";
      case "HIGH":
        return "bg-amber-500/10 text-amber-500 border-amber-500/25";
      case "MEDIUM":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/25";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/25";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        category="EMPLOYEE OPERATIONS"
        title="My Tasks & Activity Management"
        description="Collaborate across teams, execute workflow assignments, log customer touchpoints, and manage operational approvals."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadTasks();
                loadOverview();
              }}
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
              Create Task
            </button>
          </div>
        }
      />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Assigned to Me</span>
            <UserCheck className="h-4 w-4 text-brand" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-text-primary">
            {metrics.myPendingTasks}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Pending execution</div>
        </div>

        <div className="rounded-lg border border-border bg-bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Overdue Tasks</span>
            <AlertTriangle className="h-4 w-4 text-semantic-danger" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-semantic-danger">
            {metrics.myOverdueTasks}
          </div>
          <div className="mt-1 text-[11px] text-semantic-danger/80">Requires immediate attention</div>
        </div>

        <div className="rounded-lg border border-border bg-bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Awaiting Approval</span>
            <Clock className="h-4 w-4 text-semantic-warning" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-semantic-warning">
            {metrics.pendingApprovals}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Pending manager sign-off</div>
        </div>

        <div className="rounded-lg border border-border bg-bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>All Open Tasks</span>
            <Layers className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-text-primary">
            {metrics.allOpenTasks}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Active across all departments</div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: "assigned_to_me", label: "Assigned to Me" },
            { id: "created_by_me", label: "Created by Me" },
            { id: "all", label: "All Team Tasks" },
            { id: "overdue", label: "Overdue" },
            { id: "awaiting_approval", label: "Awaiting Approval" },
            { id: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle"
              )}
            >
              {tab.label}
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search by task code, title, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-9 pr-3 rounded-md border border-border bg-bg-surface text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="BLOCKED">Blocked</option>
            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Task Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-surface/50 p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-text-muted opacity-40 mb-3" />
          <h3 className="text-sm font-semibold text-text-primary">No tasks found</h3>
          <p className="mt-1 text-xs text-text-muted max-w-sm mx-auto">
            {search || statusFilter !== "ALL" || priorityFilter !== "ALL"
              ? "No tasks match your current filter criteria."
              : "You're all caught up! No operational tasks currently require attention in this view."}
          </p>
          <div className="mt-4">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create a Task
            </button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const isBlocked = task.status === "BLOCKED";
            return (
              <div
                key={task.id}
                onClick={() => openTaskDetail(task)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-lg border bg-bg-surface p-4.5 cursor-pointer transition-all hover:border-brand/40 hover:shadow-md",
                  isBlocked
                    ? "border-rose-500/40 bg-rose-500/[0.02]"
                    : task.isOverdue
                    ? "border-amber-500/40 bg-amber-500/[0.02]"
                    : "border-border"
                )}
              >
                <div>
                  {/* Top Bar: Code, Priority Pill & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold text-brand">
                      {task.taskCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border uppercase",
                          getPriorityStyle(task.priority)
                        )}
                      >
                        {task.priority}
                      </span>
                      <StatusBadge status={task.status} />
                    </div>
                  </div>

                  {/* Task Title */}
                  <h3 className="text-sm font-semibold text-text-primary line-clamp-1 group-hover:text-brand transition-colors">
                    {task.title}
                  </h3>

                  {/* Description excerpt */}
                  {task.description && (
                    <p className="mt-1 text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Associated Entities */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {task.customer && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-subtle text-[11px] text-text-secondary border border-border">
                        <User className="h-3 w-3 text-text-muted" />
                        {task.customer.contactName || task.customer.companyName}
                      </span>
                    )}
                    {task.subscription && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-subtle text-[11px] text-text-secondary border border-border font-mono">
                        <Tag className="h-3 w-3 text-brand" />
                        {task.subscription.subscriptionNumber}
                      </span>
                    )}
                    {task.workflow && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand/10 text-[11px] text-brand border border-brand/20">
                        {task.workflow.name}
                      </span>
                    )}
                  </div>

                  {/* Blocker reason if blocked */}
                  {isBlocked && task.blockerReason && (
                    <div className="mt-2.5 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">Blocker: {task.blockerReason}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Section: Progress bar, Due Date & Assignee */}
                <div className="mt-4 pt-3 border-t border-border/80">
                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
                      <span>Progress</span>
                      <span className="font-mono font-medium">{task.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-bg-subtle overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          task.status === "COMPLETED"
                            ? "bg-emerald-500"
                            : isBlocked
                            ? "bg-rose-500"
                            : "bg-brand"
                        )}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-muted">
                    {/* Due date indicator */}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {task.dueDate ? (
                        <span
                          className={cn(
                            task.isOverdue && "text-semantic-danger font-semibold"
                          )}
                        >
                          {new Date(task.dueDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                          {task.isOverdue && " (Overdue)"}
                        </span>
                      ) : (
                        <span>No deadline</span>
                      )}
                    </div>

                    {/* Assignee / Activity */}
                    <div className="flex items-center gap-2">
                      {task._count && task._count.comments > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px]">
                          <MessageSquare className="h-3 w-3" />
                          {task._count.comments}
                        </span>
                      )}
                      <span className="font-medium text-text-secondary truncate max-w-[110px]">
                        {task.assignee?.fullName || "Unassigned"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <DataTable
          rowKey={(r) => r.id}
          columns={[
            {
              key: "taskCode",
              header: "Task Code",
              mono: true,
              render: (r: TaskItem) => (
                <button
                  onClick={() => openTaskDetail(r)}
                  className="font-semibold text-brand hover:underline"
                >
                  {r.taskCode}
                </button>
              ),
            },
            {
              key: "title",
              header: "Task Title & Details",
              render: (r: TaskItem) => (
                <div>
                  <div className="font-semibold text-text-primary hover:text-brand cursor-pointer line-clamp-1" onClick={() => openTaskDetail(r)}>
                    {r.title}
                  </div>
                  <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5">
                    <span>{r.category.replace(/_/g, " ")}</span>
                    {r.customer && (
                      <span>• Customer: {r.customer.contactName || r.customer.companyName}</span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "priority",
              header: "Priority",
              render: (r: TaskItem) => (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border uppercase",
                    getPriorityStyle(r.priority)
                  )}
                >
                  {r.priority}
                </span>
              ),
            },
            {
              key: "progress",
              header: "Progress",
              render: (r: TaskItem) => (
                <div className="w-24">
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span>{r.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-bg-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${r.progress}%` }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r: TaskItem) => <StatusBadge status={r.status} />,
            },
            {
              key: "dueDate",
              header: "Due Date",
              render: (r: TaskItem) => (
                <div
                  className={cn(
                    "text-xs font-mono",
                    r.isOverdue ? "text-semantic-danger font-semibold" : "text-text-muted"
                  )}
                >
                  {r.dueDate
                    ? new Date(r.dueDate).toLocaleDateString()
                    : "None"}
                  {r.isOverdue && <span className="block text-[10px]">Overdue</span>}
                </div>
              ),
            },
            {
              key: "assignee",
              header: "Assignee",
              render: (r: TaskItem) => (
                <div className="text-xs text-text-primary">
                  {r.assignee?.fullName || "Unassigned"}
                </div>
              ),
            },
            {
              key: "actions",
              header: "Action",
              render: (r: TaskItem) => (
                <button
                  onClick={() => openTaskDetail(r)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-bg-subtle border border-border text-xs text-text-secondary hover:text-brand hover:border-brand/40 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Details
                </button>
              ),
            },
          ]}
          data={tasks}
          totalRecords={totalRecords}
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => setPage(p)}
        />
      )}

      {/* TASK DETAIL DRAWER / MODAL */}
      {selectedTask && (
        <ModalDialog
          open={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          title={`Task: ${selectedTask.taskCode}`}
          maxWidth="2xl"
        >
          <div className="space-y-6 pt-1 max-h-[80vh] overflow-y-auto pr-1">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold border uppercase",
                      getPriorityStyle(selectedTask.priority)
                    )}
                  >
                    {selectedTask.priority}
                  </span>
                  <StatusBadge status={selectedTask.status} />
                  <span className="text-xs text-text-muted">
                    Category: {selectedTask.category.replace(/_/g, " ")}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-text-primary">
                  {selectedTask.title}
                </h2>
              </div>

              {/* Status Action Transitions */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedTask.status === "ASSIGNED" && (
                  <button
                    onClick={() => updateTaskStatus("IN_PROGRESS", 20)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-white text-xs font-semibold hover:bg-brand-hover shadow-sm"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Accept & Start
                  </button>
                )}

                {selectedTask.status === "IN_PROGRESS" && (
                  <>
                    <button
                      onClick={() => setBlockerModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-medium"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Report Blocker
                    </button>
                    <button
                      onClick={() => setApprovalModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 text-xs font-medium"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Request Sign-Off
                    </button>
                    <button
                      onClick={() => updateTaskStatus("COMPLETED", 100)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Complete Task
                    </button>
                  </>
                )}

                {selectedTask.status === "BLOCKED" && (
                  <button
                    onClick={() => updateTaskStatus("IN_PROGRESS", undefined, null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Clear Blocker & Resume
                  </button>
                )}

                {selectedTask.status === "COMPLETED" && (
                  <button
                    onClick={() => updateTaskStatus("IN_PROGRESS", 80)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-text-secondary hover:text-text-primary"
                  >
                    Reopen Task
                  </button>
                )}
              </div>
            </div>

            {/* Blocker alert if present */}
            {selectedTask.status === "BLOCKED" && selectedTask.blockerReason && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Active Blocker: </span>
                  {selectedTask.blockerReason}
                </div>
              </div>
            )}

            {/* Description */}
            {selectedTask.description && (
              <div>
                <h4 className="text-xs font-semibold text-text-secondary mb-1">
                  Description & Instructions
                </h4>
                <div className="p-3 rounded-md bg-bg-subtle text-xs text-text-primary whitespace-pre-wrap leading-relaxed border border-border">
                  {selectedTask.description}
                </div>
              </div>
            )}

            {/* Interactive Progress Bar */}
            <div className="p-3.5 rounded-md border border-border bg-bg-surface">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-primary">
                  Execution Progress
                </span>
                <span className="font-mono text-xs font-bold text-brand">
                  {customProgress}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={customProgress}
                onChange={(e) => setCustomProgress(Number(e.target.value))}
                className="w-full h-2 bg-bg-subtle rounded-lg appearance-none cursor-pointer accent-brand"
              />
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => updateTaskStatus(undefined, customProgress)}
                  className="px-2.5 py-1 rounded bg-bg-subtle border border-border text-xs font-medium text-text-secondary hover:text-brand hover:border-brand transition-colors"
                >
                  Save Progress
                </button>
              </div>
            </div>

            {/* Associated Entities Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Customer */}
              <div className="p-3 rounded-md border border-border bg-bg-subtle/50 text-xs">
                <span className="text-text-muted block text-[11px] mb-1">
                  Associated Customer
                </span>
                {selectedTask.customer ? (
                  <div>
                    <div className="font-semibold text-text-primary">
                      {selectedTask.customer.contactName || selectedTask.customer.companyName}
                    </div>
                    <div className="font-mono text-[11px] text-brand">
                      {selectedTask.customer.customerCode}
                    </div>
                    {selectedTask.customer.email && (
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {selectedTask.customer.email}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-text-muted italic">None linked</span>
                )}
              </div>

              {/* Assignment Details */}
              <div className="p-3 rounded-md border border-border bg-bg-subtle/50 text-xs">
                <span className="text-text-muted block text-[11px] mb-1">
                  Team Ownership
                </span>
                <div className="space-y-1">
                  <div>
                    <span className="text-text-muted">Assignee: </span>
                    <span className="font-medium text-text-primary">
                      {selectedTask.assignee?.fullName || "Unassigned"}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Manager: </span>
                    <span className="font-medium text-text-primary">
                      {selectedTask.manager?.fullName || "Not specified"}
                    </span>
                  </div>
                  {selectedTask.dueDate && (
                    <div>
                      <span className="text-text-muted">Due Date: </span>
                      <span className="font-mono font-medium text-text-primary">
                        {new Date(selectedTask.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Linked Subscription or Workflow */}
            {(selectedTask.subscription || selectedTask.workflow) && (
              <div className="p-3 rounded-md border border-border bg-bg-subtle/50 text-xs flex flex-wrap items-center gap-4">
                {selectedTask.subscription && (
                  <div>
                    <span className="text-text-muted block text-[10px]">
                      Subscription
                    </span>
                    <span className="font-mono font-semibold text-brand">
                      {selectedTask.subscription.subscriptionNumber}
                    </span>
                  </div>
                )}
                {selectedTask.workflow && (
                  <div>
                    <span className="text-text-muted block text-[10px]">
                      Workflow Origin
                    </span>
                    <span className="font-medium text-text-primary">
                      {selectedTask.workflow.name} ({selectedTask.workflow.workflowCode})
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Comments & Customer Interaction Activity Timeline */}
            <div className="pt-2 border-t border-border">
              <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center justify-between">
                <span>Activity, Comments & Customer Contacts</span>
                <span className="text-[11px] font-normal text-text-muted">
                  {selectedTask.comments?.length || 0} entries
                </span>
              </h4>

              {/* New Comment / Call Log Form */}
              <form onSubmit={handleAddComment} className="mb-4 space-y-2">
                <textarea
                  rows={2}
                  placeholder={
                    isCustomerInteraction
                      ? "Log customer interaction, call notes, or follow-up summary..."
                      : "Add internal team comment or status note..."
                  }
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary select-none">
                    <input
                      type="checkbox"
                      checked={isCustomerInteraction}
                      onChange={(e) => setIsCustomerInteraction(e.target.checked)}
                      className="rounded border-border text-brand focus:ring-brand"
                    />
                    <PhoneCall className="h-3.5 w-3.5 text-brand" />
                    <span>Customer Interaction / Call Log</span>
                  </label>

                  <button
                    type="submit"
                    disabled={commentSubmitting || !newCommentText.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {commentSubmitting ? "Posting..." : "Record Note"}
                  </button>
                </div>
              </form>

              {/* Comments Timeline */}
              <div className="space-y-3">
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "p-3 rounded-md border text-xs leading-relaxed",
                        c.isInternal
                          ? "border-border bg-bg-surface"
                          : "border-brand/30 bg-brand/[0.03]"
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] text-text-muted mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-text-primary">
                            {c.author?.fullName || "Employee"}
                          </span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
                              c.isInternal
                                ? "bg-bg-subtle text-text-muted"
                                : "bg-brand/10 text-brand border border-brand/20"
                            )}
                          >
                            {c.isInternal ? "Internal Note" : "Customer Contact"}
                          </span>
                        </div>
                        <span className="font-mono text-[10px]">
                          {new Date(c.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <p className="text-text-secondary whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-text-muted italic text-center py-4">
                    No notes or customer interaction records logged yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* BLOCKER REPORT MODAL */}
      <ModalDialog
        open={blockerModalOpen}
        onClose={() => setBlockerModalOpen(false)}
        title="Report Task Blocker"
        description="Specify why this task cannot proceed. The task will be marked BLOCKED."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <FormField label="Blocker Reason" required>
            <textarea
              rows={3}
              placeholder="e.g. Waiting for customer financial confirmation or manager approval..."
              value={blockerText}
              onChange={(e) => setBlockerText(e.target.value)}
              className="w-full p-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setBlockerModalOpen(false)}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!blockerText.trim()) return;
                updateTaskStatus("BLOCKED", undefined, blockerText.trim());
                setBlockerModalOpen(false);
                setBlockerText("");
              }}
              className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              Submit Blocker
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* REQUEST APPROVAL MODAL */}
      <ModalDialog
        open={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        title="Request Manager Sign-Off"
        description="Submit an official approval request to your manager to sign off on this task's completion."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <FormField label="Submission Notes & Evidence">
            <textarea
              rows={3}
              placeholder="Detail actions completed and justification for final sign-off..."
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              className="w-full p-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setApprovalModalOpen(false)}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleRequestApproval}
              className="px-3 py-1.5 rounded-md bg-brand text-white text-xs font-semibold hover:bg-brand-hover"
            >
              Send Approval Request
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* CREATE TASK MODAL */}
      <ModalDialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Operational Task"
        description="Assign a business activity to yourself or a colleague."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
          <FormField label="Task Title" required>
            <input
              type="text"
              required
              placeholder="e.g. Conduct 7-Day Renewal Check-in with Key Account"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>

          <FormField label="Description & Checklist">
            <textarea
              rows={3}
              placeholder="Detailed guidelines, customer contact links, or checklist..."
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full p-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Category">
              <select
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="CUSTOMER_ONBOARDING">Customer Onboarding</option>
                <option value="SUBSCRIPTION_RENEWAL">Subscription Renewal</option>
                <option value="INVOICE_COLLECTION">Invoice Collection</option>
                <option value="TECH_SUPPORT">Tech Support</option>
                <option value="SALES_FOLLOWUP">Sales Follow-up</option>
                <option value="GENERAL">General Activity</option>
              </select>
            </FormField>

            <FormField label="Priority">
              <select
                value={newTask.priority}
                onChange={(e) =>
                  setNewTask({
                    ...newTask,
                    priority: e.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                  })
                }
                className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Assignee">
              <select
                value={newTask.assigneeId}
                onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Assign to Me (Default)</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} ({member.role?.name || "Member"})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Responsible Manager">
              <select
                value={newTask.managerId}
                onChange={(e) => setNewTask({ ...newTask, managerId: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">None specified</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Associated Customer">
              <select
                value={newTask.customerId}
                onChange={(e) => setNewTask({ ...newTask, customerId: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">No Customer Link</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contactName || c.companyName} ({c.customerCode})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Due Date">
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </FormField>
          </div>

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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {createSubmitting ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
