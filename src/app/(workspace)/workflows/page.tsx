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
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  Filter,
  GitBranch,
  History,
  Layers,
  LayoutGrid,
  List,
  Mail,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

interface CanvasNode {
  id: string;
  type: "TRIGGER" | "CONDITION" | "ACTION";
  subType: string;
  label: string;
  description?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  branch?: "TRUE" | "FALSE" | "DEFAULT" | "APPROVED" | "REJECTED";
  label?: string;
}

interface WorkflowItem {
  id: string;
  workflowCode: string;
  name: string;
  description: string | null;
  category: string;
  priority: string;
  triggerType: string;
  status: string;
  version: number;
  assignedDepartment: string | null;
  owner: { id: string; fullName: string; email: string };
  versions?: { id: string; version: number; definition: string }[];
  _count?: { executions: number; tasks: number };
  createdAt: string;
  updatedAt: string;
}

interface ExecutionItem {
  id: string;
  executionCode: string;
  workflowId: string;
  triggerEvent: string;
  status: string;
  currentStep: string | null;
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  workflow?: { name: string; workflowCode: string; category: string };
  customer?: { contactName: string; customerCode: string };
  steps?: {
    id: string;
    nodeId: string;
    nodeType: string;
    nodeLabel: string;
    status: string;
    inputPayload: string | null;
    outputPayload: string | null;
    errorMessage: string | null;
    completedAt: string | null;
  }[];
}

export default function WorkflowsPage() {
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "studio" | "executions">("catalog");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Studio canvas state
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowItem | null>(null);
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [testingWorkflow, setTestingWorkflow] = useState(false);
  const [lastTestExecution, setLastTestExecution] = useState<ExecutionItem | null>(null);

  // Executions history state
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionItem | null>(null);

  // Create workflow modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWkfName, setNewWkfName] = useState("");
  const [newWkfDesc, setNewWkfDesc] = useState("");
  const [newWkfCategory, setNewWkfCategory] = useState("RENEWAL");
  const [newWkfTrigger, setNewWkfTrigger] = useState("SUBSCRIPTION_RENEWAL");
  const [newWkfDepartment, setNewWkfDepartment] = useState("Customer Success");
  const [newWkfPriority, setNewWkfPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows");
      const json = await res.json();
      if (json.success) {
        setWorkflows(json.data);
      }
    } catch {
      toast({ title: "Failed to load workflows", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadExecutions = async () => {
    setLoadingExecutions(true);
    try {
      const res = await fetch("/api/workflows/executions");
      const json = await res.json();
      if (json.success) {
        setExecutions(json.data.items || []);
      }
    } finally {
      setLoadingExecutions(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  useEffect(() => {
    if (activeTab === "executions") {
      loadExecutions();
    }
  }, [activeTab]);

  // Open workflow in Visual Studio Canvas
  const openInStudio = async (wkf: WorkflowItem) => {
    try {
      const res = await fetch(`/api/workflows/${wkf.id}`);
      const json = await res.json();
      if (json.success) {
        const full = json.data;
        setEditingWorkflow(full);
        const latestVersion = full.versions?.[0];
        if (latestVersion?.definition) {
          try {
            const def = JSON.parse(latestVersion.definition);
            setCanvasNodes(def.nodes || []);
            setCanvasEdges(def.edges || []);
          } catch {
            setCanvasNodes([]);
            setCanvasEdges([]);
          }
        }
        setSelectedNode(null);
        setLastTestExecution(null);
        setActiveTab("studio");
      }
    } catch {
      toast({ title: "Error opening workflow canvas", variant: "error" });
    }
  };

  // Create new custom workflow
  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWkfName.trim(),
          description: newWkfDesc.trim(),
          category: newWkfCategory,
          triggerType: newWkfTrigger,
          assignedDepartment: newWkfDepartment,
          priority: newWkfPriority,
          status: "ACTIVE",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: "Creation Failed", description: json.error?.message, variant: "error" });
        return;
      }
      toast({
        title: "Workflow Created",
        description: `${json.data.workflowCode} (${json.data.name}) is now ready in Studio.`,
        variant: "success",
      });
      setCreateModalOpen(false);
      loadWorkflows();
      openInStudio(json.data);
    } catch {
      toast({ title: "Error creating workflow", variant: "error" });
    }
  };

  // Run on-demand test execution
  const handleRunTest = async () => {
    if (!editingWorkflow) return;
    setTestingWorkflow(true);
    try {
      const res = await fetch(`/api/workflows/${editingWorkflow.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulatedMode: true }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setLastTestExecution(json.data);
        toast({
          title: "Workflow Test Succeeded",
          description: `Execution ${json.data.executionCode} traversed all nodes successfully.`,
          variant: "success",
        });
      } else {
        toast({
          title: "Test Execution Encountered Block",
          description: json.error?.message || "Execution did not complete all nodes.",
          variant: "error",
        });
      }
    } catch {
      toast({ title: "Error running workflow test", variant: "error" });
    } finally {
      setTestingWorkflow(false);
    }
  };

  // Toggle active/paused status
  const handleToggleStatus = async (wkf: WorkflowItem) => {
    const nextStatus = wkf.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/workflows/${wkf.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: `Workflow ${nextStatus === "ACTIVE" ? "Activated" : "Paused"}`,
          description: `${wkf.workflowCode} is now ${nextStatus.toLowerCase()}.`,
          variant: "success",
        });
        loadWorkflows();
        if (editingWorkflow?.id === wkf.id) {
          setEditingWorkflow({ ...editingWorkflow, status: nextStatus });
        }
      }
    } catch {
      toast({ title: "Status update failed", variant: "error" });
    }
  };

  // Filter workflows list
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((w) => {
      if (categoryFilter !== "ALL" && w.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && w.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          w.name.toLowerCase().includes(q) ||
          w.workflowCode.toLowerCase().includes(q) ||
          (w.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [workflows, categoryFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. Page Header                                                         */}
      {/* ---------------------------------------------------------------------- */}
      <PageHeader
        category="ENTERPRISE AUTOMATION"
        title="Workflow Studio & Business Operations"
        description="Design visual event-driven workflows, configure conditional logic branches, assign employee tasks, and orchestrate customer communications."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadWorkflows}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle focus-visible:outline-none"
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-brand-text shadow-xs hover:bg-brand-hover"
            >
              <Plus className="h-3.5 w-3.5" />
              New Workflow
            </button>
          </div>
        }
      />

      {/* ---------------------------------------------------------------------- */}
      {/* 2. Top Metric KPI Row                                                  */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-bg-base p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase">Active Workflows</span>
            <Activity className="h-4 w-4 text-semantic-success" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-text-primary">
            {workflows.filter((w) => w.status === "ACTIVE").length}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Published & listening to events</div>
        </div>

        <div className="rounded-lg border border-border bg-bg-base p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase">Total Executions</span>
            <Zap className="h-4 w-4 text-brand" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-text-primary">
            {workflows.reduce((acc, w) => acc + (w._count?.executions ?? 0), 0) + (executions.length || 0)}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Automated action triggers</div>
        </div>

        <div className="rounded-lg border border-border bg-bg-base p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase">Generated Tasks</span>
            <UserCheck className="h-4 w-4 text-semantic-info" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-text-primary">
            {workflows.reduce((acc, w) => acc + (w._count?.tasks ?? 0), 0)}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Dispatched to employees</div>
        </div>

        <div className="rounded-lg border border-border bg-bg-base p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase">Engine Status</span>
            <span className="flex h-2 w-2 rounded-full bg-semantic-success animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-semantic-success">
            100%
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Idempotent queue healthy</div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. Navigation View Switcher (Catalog vs Studio vs Executions)          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
              activeTab === "catalog"
                ? "bg-brand text-brand-text shadow-xs"
                : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            )}
          >
            <Workflow className="h-3.5 w-3.5" />
            <span>Workflow Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!editingWorkflow && workflows.length > 0) {
                openInStudio(workflows[0]);
              } else {
                setActiveTab("studio");
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
              activeTab === "studio"
                ? "bg-brand text-brand-text shadow-xs"
                : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>Visual Studio Canvas</span>
            {editingWorkflow && (
              <span className="ml-1 text-[10px] font-mono opacity-80">
                ({editingWorkflow.workflowCode})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("executions")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
              activeTab === "executions"
                ? "bg-brand text-brand-text shadow-xs"
                : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span>Execution History</span>
          </button>
        </div>

        {activeTab === "studio" && editingWorkflow && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleStatus(editingWorkflow)}
              className={cn(
                "inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-medium border transition-colors",
                editingWorkflow.status === "ACTIVE"
                  ? "border-semantic-warning/40 text-semantic-warning bg-semantic-warning-subtle"
                  : "border-semantic-success/40 text-semantic-success bg-semantic-success-subtle"
              )}
            >
              {editingWorkflow.status === "ACTIVE" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {editingWorkflow.status === "ACTIVE" ? "Pause Workflow" : "Activate Workflow"}
            </button>

            <button
              type="button"
              onClick={handleRunTest}
              disabled={testingWorkflow}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded bg-brand text-xs font-semibold text-brand-text hover:bg-brand-hover shadow-xs disabled:opacity-50"
            >
              <Play className={cn("h-3 w-3", testingWorkflow && "animate-spin")} />
              {testingWorkflow ? "Running Test..." : "Run Test Simulation"}
            </button>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4. Tab 1: Workflow Catalog                                             */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="rounded-lg border border-border bg-bg-base p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workflows by code, name, trigger..."
                className="h-8 w-full rounded border border-border bg-bg-base pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono text-text-muted">Category:</span>
                {["ALL", "RENEWAL", "COLLECTIONS", "ONBOARDING", "GENERAL"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-mono font-medium border",
                      categoryFilter === cat
                        ? "bg-brand/10 border-brand/40 text-brand font-semibold"
                        : "bg-bg-base border-border text-text-secondary hover:bg-bg-subtle"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-border mx-1" />

              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono text-text-muted">Status:</span>
                {["ALL", "ACTIVE", "PAUSED", "DRAFT"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-mono font-medium border",
                      statusFilter === st
                        ? "bg-brand/10 border-brand/40 text-brand font-semibold"
                        : "bg-bg-base border-border text-text-secondary hover:bg-bg-subtle"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Workflow Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-bg-base p-4 space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-3">
              <Workflow className="h-8 w-8 text-text-muted mx-auto" />
              <h4 className="text-sm font-semibold text-text-primary">No workflows match your criteria</h4>
              <p className="text-xs text-text-muted">Adjust search query or category filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkflows.map((wkf) => (
                <div
                  key={wkf.id}
                  className="rounded-lg border border-border bg-bg-base p-4 shadow-xs hover:border-brand/40 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                        {wkf.workflowCode}
                      </span>
                      <StatusBadge status={wkf.status} />
                    </div>

                    <h3 className="text-sm font-bold text-text-primary line-clamp-1 hover:text-brand transition-colors">
                      {wkf.name}
                    </h3>

                    <p className="text-xs text-text-muted line-clamp-2 min-h-[32px] leading-relaxed">
                      {wkf.description || "Automated multi-node business workflow."}
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-bg-subtle text-text-secondary border border-border">
                        {wkf.triggerType}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted">
                        v{wkf.version}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted">
                        {wkf.assignedDepartment || "Operations"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-[11px] text-text-muted">
                      {(wkf._count?.executions ?? 0)} runs • {(wkf._count?.tasks ?? 0)} tasks
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openInStudio(wkf)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand/10 text-brand font-semibold hover:bg-brand hover:text-brand-text transition-colors"
                      >
                        <GitBranch className="h-3 w-3" />
                        Open Studio
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 5. Tab 2: Visual Studio Canvas & Node Graph                            */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "studio" && editingWorkflow && (
        <div className="space-y-4">
          {/* Studio Top Control Banner */}
          <div className="rounded-lg border border-border bg-bg-base p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                  {editingWorkflow.workflowCode}
                </span>
                <span className="text-xs font-mono text-text-muted">v{editingWorkflow.version}</span>
                <StatusBadge status={editingWorkflow.status} />
              </div>
              <h2 className="text-lg font-bold text-text-primary mt-1">{editingWorkflow.name}</h2>
              <p className="text-xs text-text-muted">{editingWorkflow.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-text-muted">
                {canvasNodes.length} Nodes • {canvasEdges.length} Branches
              </span>
            </div>
          </div>

          {/* Test Execution Result Banner if run */}
          {lastTestExecution && (
            <div className="rounded-lg border border-semantic-success/30 bg-semantic-success-subtle p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-semantic-success shrink-0" />
                  <span className="font-semibold text-text-primary">
                    Execution Trace {lastTestExecution.executionCode} — STATUS: {lastTestExecution.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLastTestExecution(null)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                {lastTestExecution.steps?.map((step, idx) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-base border border-border shadow-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-semantic-success" />
                    <span className="font-semibold text-text-primary">{step.nodeLabel}</span>
                    <span className="text-text-muted text-[10px]">({step.status})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Node Graph Canvas Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Interactive Node Graph Canvas */}
            <div className="lg:col-span-8 rounded-lg border border-border bg-bg-canvas p-6 min-h-[540px] relative overflow-hidden flex flex-col justify-between shadow-inner">
              {/* Subtle Canvas Dot Grid Background */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(#4F46E5 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              {/* Visual Node Flow Stack */}
              <div className="relative z-10 flex flex-col items-center space-y-6 max-w-lg mx-auto w-full">
                {canvasNodes.map((node, idx) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isTrigger = node.type === "TRIGGER";
                  const isCondition = node.type === "CONDITION";
                  const isAction = node.type === "ACTION";

                  return (
                    <React.Fragment key={node.id}>
                      {/* Connection Edge Line between nodes */}
                      {idx > 0 && (
                        <div className="flex flex-col items-center">
                          <div className="w-0.5 h-6 bg-brand/40" />
                          <div className="w-2 h-2 rounded-full bg-brand" />
                        </div>
                      )}

                      {/* Visual Node Card */}
                      <div
                        onClick={() => setSelectedNode(node)}
                        className={cn(
                          "w-full rounded-lg border p-4 shadow-sm transition-all cursor-pointer bg-bg-base",
                          isSelected
                            ? "border-brand ring-2 ring-brand/20 shadow-md"
                            : "border-border hover:border-brand/40",
                          isTrigger && "border-l-4 border-l-amber-500",
                          isCondition && "border-l-4 border-l-indigo-500",
                          isAction && "border-l-4 border-l-emerald-500"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                isTrigger && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                isCondition && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
                                isAction && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {node.type}
                            </span>
                            <span className="font-mono text-[11px] text-text-muted">
                              {node.subType}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-text-muted">
                            <Settings className="h-3 w-3" />
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-text-primary">{node.label}</h4>
                        {node.description && (
                          <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                            {node.description}
                          </p>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Node Properties & Config Inspector Drawer */}
            <div className="lg:col-span-4 rounded-lg border border-border bg-bg-base p-5 shadow-xs space-y-4">
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-brand font-semibold">
                        {selectedNode.type} NODE
                      </span>
                      <h3 className="text-sm font-bold text-text-primary">{selectedNode.label}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNode(null)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-mono text-text-muted uppercase mb-1">
                        Node Identifier
                      </label>
                      <div className="font-mono text-xs bg-bg-subtle p-2 rounded border border-border text-text-secondary">
                        {selectedNode.id}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-text-muted uppercase mb-1">
                        Sub-Type
                      </label>
                      <div className="font-mono text-xs bg-bg-subtle p-2 rounded border border-border text-text-secondary">
                        {selectedNode.subType}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-text-muted uppercase mb-1">
                        Configuration Parameters
                      </label>
                      <pre className="p-2.5 rounded bg-bg-subtle border border-border font-mono text-[11px] text-text-secondary overflow-x-auto max-h-48">
                        {JSON.stringify(selectedNode.config || {}, null, 2)}
                      </pre>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleRunTest}
                        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded bg-brand text-xs font-semibold text-brand-text hover:bg-brand-hover shadow-xs"
                      >
                        <Play className="h-3 w-3" />
                        Test Node Step Execution
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 space-y-2">
                  <Settings className="h-8 w-8 text-text-muted mx-auto" />
                  <h4 className="text-xs font-semibold text-text-primary">Node Inspector</h4>
                  <p className="text-[11px] text-text-muted max-w-xs mx-auto leading-relaxed">
                    Click on any node in the canvas to view its configuration, trigger thresholds, and action parameters.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 6. Tab 3: Execution History & Step Traces                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "executions" && (
        <div className="space-y-4">
          <DataTable
            columns={[
              {
                key: "code",
                header: "Execution ID",
                mono: true,
                render: (r: ExecutionItem) => (
                  <span className="font-mono font-bold text-brand">{r.executionCode}</span>
                ),
              },
              {
                key: "workflow",
                header: "Workflow",
                render: (r: ExecutionItem) => (
                  <div>
                    <div className="font-semibold text-text-primary">{r.workflow?.name || "Automated Flow"}</div>
                    <div className="text-[11px] font-mono text-text-muted">{r.workflow?.workflowCode}</div>
                  </div>
                ),
              },
              {
                key: "trigger",
                header: "Trigger Event",
                mono: true,
                render: (r: ExecutionItem) => (
                  <span className="px-2 py-0.5 rounded bg-bg-subtle border border-border text-[11px]">
                    {r.triggerEvent}
                  </span>
                ),
              },
              {
                key: "customer",
                header: "Subject Entity",
                render: (r: ExecutionItem) => (
                  <span className="text-xs text-text-secondary">
                    {r.customer?.contactName || "Global / System"}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r: ExecutionItem) => <StatusBadge status={r.status} />,
              },
              {
                key: "started",
                header: "Started At",
                mono: true,
                render: (r: ExecutionItem) => (
                  <span className="text-xs text-text-muted">
                    {new Date(r.startedAt).toLocaleString("en-IN")}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Step Trace",
                align: "right",
                render: (r: ExecutionItem) => (
                  <button
                    type="button"
                    onClick={() => setSelectedExecution(r)}
                    className="inline-flex items-center gap-1 text-xs text-brand font-semibold hover:underline"
                  >
                    <Eye className="h-3 w-3" />
                    Inspect Nodes
                  </button>
                ),
              },
            ]}
            data={executions}
            rowKey={(r) => r.id}
            loading={loadingExecutions}
            emptyTitle="No workflow executions recorded yet"
            emptyDescription="Executions will appear automatically when trigger events occur or tests are run."
          />
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 7. Execution Step Trace Inspection Drawer                              */}
      {/* ---------------------------------------------------------------------- */}
      {selectedExecution && (
        <ModalDialog
          open={Boolean(selectedExecution)}
          onClose={() => setSelectedExecution(null)}
          title={`Execution Trace — ${selectedExecution.executionCode}`}
          description={`Workflow: ${selectedExecution.workflow?.name || selectedExecution.triggerEvent}`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-bg-subtle text-xs">
              <div>
                <span className="text-text-muted">Status: </span>
                <StatusBadge status={selectedExecution.status} />
              </div>
              <div className="font-mono text-text-muted">
                Started: {new Date(selectedExecution.startedAt).toLocaleString("en-IN")}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted">
                Executed Steps & Outcomes
              </h4>

              {selectedExecution.steps && selectedExecution.steps.length > 0 ? (
                <div className="space-y-2">
                  {selectedExecution.steps.map((st, idx) => (
                    <div
                      key={st.id}
                      className="rounded-lg border border-border bg-bg-base p-3 text-xs space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-brand font-bold">#{idx + 1}</span>
                          <span className="font-semibold text-text-primary">{st.nodeLabel}</span>
                          <span className="font-mono text-[10px] text-text-muted">({st.nodeType})</span>
                        </div>
                        <StatusBadge status={st.status} />
                      </div>

                      {st.outputPayload && (
                        <pre className="p-2 rounded bg-bg-subtle text-[11px] font-mono text-text-secondary overflow-x-auto">
                          {st.outputPayload}
                        </pre>
                      )}

                      {st.errorMessage && (
                        <div className="text-semantic-danger text-[11px] font-medium">
                          Error: {st.errorMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-text-muted p-4 text-center border border-dashed rounded">
                  Step details generated during live trigger execution.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedExecution(null)}
                className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary hover:bg-bg-subtle"
              >
                Close
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 8. Create Workflow Modal                                               */}
      {/* ---------------------------------------------------------------------- */}
      <ModalDialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Business Workflow"
        description="Configure event trigger, department, and baseline parameters for Workflow Studio."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateWorkflow} className="space-y-4">
          <FormField label="Workflow Name" required>
            <input
              type="text"
              required
              value={newWkfName}
              onChange={(e) => setNewWkfName(e.target.value)}
              placeholder="e.g., Customer Renewal Follow-Up & Account Executive Escalation"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Trigger Event" required>
              <select
                value={newWkfTrigger}
                onChange={(e) => setNewWkfTrigger(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs text-text-primary"
              >
                <option value="SUBSCRIPTION_RENEWAL">Subscription Approaching Expiry</option>
                <option value="SUBSCRIPTION_CREATED">Subscription Created</option>
                <option value="PAYMENT_FAILED">Payment Transaction Failed</option>
                <option value="PAYMENT_SUCCESS">Payment Successful</option>
                <option value="INVOICE_OVERDUE">Invoice Overdue</option>
                <option value="CUSTOMER_CREATED">New Customer Created</option>
                <option value="QUOTATION_CREATED">Quotation Created</option>
                <option value="MANUAL_TRIGGER">Manual Employee Trigger</option>
              </select>
            </FormField>

            <FormField label="Category" required>
              <select
                value={newWkfCategory}
                onChange={(e) => setNewWkfCategory(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs text-text-primary"
              >
                <option value="RENEWAL">Renewal</option>
                <option value="COLLECTIONS">Collections</option>
                <option value="ONBOARDING">Onboarding</option>
                <option value="BILLING">Billing</option>
                <option value="SUPPORT">Support</option>
                <option value="GENERAL">General</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Assigned Department">
              <input
                type="text"
                value={newWkfDepartment}
                onChange={(e) => setNewWkfDepartment(e.target.value)}
                placeholder="e.g., Sales & Customer Success"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary"
              />
            </FormField>

            <FormField label="Priority">
              <select
                value={newWkfPriority}
                onChange={(e) => setNewWkfPriority(e.target.value as any)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs text-text-primary"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </FormField>
          </div>

          <FormField label="Description">
            <textarea
              rows={2}
              value={newWkfDesc}
              onChange={(e) => setNewWkfDesc(e.target.value)}
              placeholder="Describe the business objective of this workflow..."
              className="w-full rounded-md border border-border bg-bg-base p-2.5 text-xs text-text-primary"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary hover:bg-bg-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-brand-text hover:bg-brand-hover"
            >
              Launch in Studio
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
