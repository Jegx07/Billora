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
  getNodeCatalogEntry,
  NODE_CATEGORY_META,
  NodeCategoryKey,
  WORKFLOW_EXPRESSION_VARIABLES,
  WORKFLOW_NODE_CATALOG,
} from "@/lib/workflow-nodes";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileCode,
  GitBranch,
  History,
  KeyRound,
  Layers,
  LayoutGrid,
  Maximize2,
  Pause,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Undo2,
  Upload,
  Workflow,
  X,
  XCircle,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface CanvasNode {
  id: string;
  type: "TRIGGER" | "CONDITION" | "ACTION";
  subType: string;
  label: string;
  description?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  retryPolicy?: {
    maxRetries?: number;
    backoffMs?: number;
    timeoutMs?: number;
    continueOnError?: boolean;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  branch?: "TRUE" | "FALSE" | "DEFAULT" | "ERROR" | "APPROVED" | "REJECTED";
  label?: string;
}

interface WorkflowVersionItem {
  id: string;
  version: number;
  definition: string;
  changelog?: string | null;
  createdAt?: string;
}

interface WorkflowItem {
  id: string;
  workflowCode: string;
  name: string;
  description: string | null;
  category: string;
  priority: string;
  triggerType: string;
  triggerConfig?: string | null;
  status: string;
  version: number;
  assignedDepartment: string | null;
  ownerId: string;
  owner: { id: string; fullName: string; email: string };
  versions?: WorkflowVersionItem[];
  schedules?: { id: string; cronExpression: string; isActive: boolean; nextRunAt?: string }[];
  _count?: { executions: number; tasks: number };
  createdAt: string;
  updatedAt: string;
}

interface ExecutionStepItem {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: string;
  inputPayload: string | null;
  outputPayload: string | null;
  errorMessage: string | null;
  startedAt?: string;
  completedAt: string | null;
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
  retryCount?: number;
  failureReason: string | null;
  workflow?: { id?: string; name: string; workflowCode: string; category: string };
  customer?: { id?: string; contactName: string; customerCode: string; email?: string };
  subscription?: { id?: string; subscriptionNumber: string };
  steps?: ExecutionStepItem[];
}

interface IntegrationItem {
  id: string;
  integrationKey: string;
  name: string;
  providerType: string;
  endpointUrl: string | null;
  credentialMasked: string;
  isActive: boolean;
  isApprovedForEmployees: boolean;
  configJson: string | null;
  updatedAt: string;
}

const NODE_WIDTH = 236;
const NODE_HEIGHT = 96;

export default function WorkflowsPage() {
  const { toast } = useToast();

  // Session Role
  const [userRole, setUserRole] = useState<"ADMIN" | "EMPLOYEE">("ADMIN");
  const [userId, setUserId] = useState<string>("");

  // Primary Data
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "studio" | "executions" | "integrations">("catalog");

  // Catalog Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"updated" | "name" | "executions">("updated");

  // Studio State
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowItem | null>(null);
  const [workflowTitle, setWorkflowTitle] = useState("");
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdge[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"config" | "preview" | "connect">("config");
  const [activeConfigField, setActiveConfigField] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [testingWorkflow, setTestingWorkflow] = useState(false);
  const [lastTestExecution, setLastTestExecution] = useState<ExecutionItem | null>(null);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);

  // Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState<{ nodes: CanvasNode[]; edges: CanvasEdge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Canvas Viewport (Infinite Pan & Zoom)
  const [zoom, setZoom] = useState(0.95);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const draggingNodeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const wiringFromRef = useRef<{
    sourceId: string;
    branch: "TRUE" | "FALSE" | "DEFAULT" | "ERROR";
    x: number;
    y: number;
  } | null>(null);
  const [wiringCursor, setWiringCursor] = useState<{
    sourceId: string;
    branch: "TRUE" | "FALSE" | "DEFAULT" | "ERROR";
    x: number;
    y: number;
  } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Node Library Left Sidebar
  const [libSearch, setLibSearch] = useState("");
  const [expandedCat, setExpandedCat] = useState<NodeCategoryKey | "ALL">("TRIGGERS");

  // Executions State
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [execStatusFilter, setExecStatusFilter] = useState("ALL");
  const [selectedExecution, setSelectedExecution] = useState<ExecutionItem | null>(null);

  // Integrations State
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false);
  const [intKey, setIntKey] = useState("");
  const [intName, setIntName] = useState("");
  const [intProvider, setIntProvider] = useState("WEBHOOK");
  const [intEndpoint, setIntEndpoint] = useState("");
  const [intSecret, setIntSecret] = useState("");
  const [intEmployeeApproved, setIntEmployeeApproved] = useState(true);

  // Create & Import Workflow Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [newWkfName, setNewWkfName] = useState("");
  const [newWkfDesc, setNewWkfDesc] = useState("");
  const [newWkfCategory, setNewWkfCategory] = useState("RENEWAL");
  const [newWkfTrigger, setNewWkfTrigger] = useState("SUBSCRIPTION_RENEWAL");
  const [newWkfDepartment, setNewWkfDepartment] = useState("Customer Success");
  const [newWkfPriority, setNewWkfPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [newWkfCron, setNewWkfCron] = useState("0 9 * * *");

  // Push canvas snapshot into Undo/Redo stack
  const commitGraphChange = useCallback(
    (nextNodes: CanvasNode[], nextEdges: CanvasEdge[], markDirty = true) => {
      setCanvasNodes(nextNodes);
      setCanvasEdges(nextEdges);
      if (markDirty) setIsDirty(true);

      setHistoryStack((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const next = [
          ...sliced,
          {
            nodes: JSON.parse(JSON.stringify(nextNodes)),
            edges: JSON.parse(JSON.stringify(nextEdges)),
          },
        ].slice(-30);
        setHistoryIndex(next.length - 1);
        return next;
      });

      if (editingWorkflow && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `billora_wkf_draft_${editingWorkflow.id}`,
            JSON.stringify({ nodes: nextNodes, edges: nextEdges, savedAt: Date.now() })
          );
        } catch {}
      }
    },
    [editingWorkflow, historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIdx = historyIndex - 1;
      const snap = historyStack[targetIdx];
      if (snap) {
        setCanvasNodes(JSON.parse(JSON.stringify(snap.nodes)));
        setCanvasEdges(JSON.parse(JSON.stringify(snap.edges)));
        setHistoryIndex(targetIdx);
        setIsDirty(true);
      }
    }
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex + 1 < historyStack.length) {
      const targetIdx = historyIndex + 1;
      const snap = historyStack[targetIdx];
      if (snap) {
        setCanvasNodes(JSON.parse(JSON.stringify(snap.nodes)));
        setCanvasEdges(JSON.parse(JSON.stringify(snap.edges)));
        setHistoryIndex(targetIdx);
        setIsDirty(true);
      }
    }
  }, [historyIndex, historyStack]);

  const loadWorkflows = useCallback(async () => {
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
  }, [toast]);

  const loadExecutions = useCallback(async () => {
    setLoadingExecutions(true);
    try {
      const qs = new URLSearchParams({ limit: "30" });
      if (execStatusFilter !== "ALL") qs.set("status", execStatusFilter);
      const res = await fetch(`/api/workflows/executions?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        setExecutions(json.data.items || []);
      }
    } finally {
      setLoadingExecutions(false);
    }
  }, [execStatusFilter]);

  const loadIntegrations = useCallback(async () => {
    setLoadingIntegrations(true);
    try {
      const res = await fetch("/api/workflows/integrations");
      const json = await res.json();
      if (json.success) {
        setIntegrations(json.data || []);
      }
    } finally {
      setLoadingIntegrations(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.user) {
          setUserRole(j.data.user.role === "EMPLOYEE" ? "EMPLOYEE" : "ADMIN");
          setUserId(j.data.user.id || "");
        }
      })
      .catch(() => {});
    loadWorkflows();
    loadExecutions();
  }, [loadWorkflows, loadExecutions]);

  useEffect(() => {
    if (activeTab === "executions") loadExecutions();
    if (activeTab === "integrations") loadIntegrations();
  }, [activeTab, loadExecutions, loadIntegrations]);

  // Open workflow in Visual Studio Canvas
  const openInStudio = useCallback(
    async (wkf: WorkflowItem) => {
      try {
        const res = await fetch(`/api/workflows/${wkf.id}`);
        const json = await res.json();
        if (json.success) {
          const full = json.data as WorkflowItem;
          setEditingWorkflow(full);
          setWorkflowTitle(full.name);
          const latestVersion = full.versions?.[0];
          let initialNodes: CanvasNode[] = [];
          let initialEdges: CanvasEdge[] = [];
          if (latestVersion?.definition) {
            try {
              const def = JSON.parse(latestVersion.definition);
              initialNodes = (def.nodes || []).map((n: CanvasNode, idx: number) => ({
                ...n,
                position: n.position || { x: 80 + idx * 280, y: 180 },
              }));
              initialEdges = def.edges || [];
            } catch {}
          }
          setCanvasNodes(initialNodes);
          setCanvasEdges(initialEdges);
          setHistoryStack([
            {
              nodes: JSON.parse(JSON.stringify(initialNodes)),
              edges: JSON.parse(JSON.stringify(initialEdges)),
            },
          ]);
          setHistoryIndex(0);
          setIsDirty(false);
          setSelectedNodeId(initialNodes[0]?.id || null);
          setSelectedNodeIds(new Set(initialNodes[0] ? [initialNodes[0].id] : []));
          if ((full as any).executions?.length > 0) {
            setLastTestExecution((full as any).executions[0]);
          } else {
            setLastTestExecution(null);
          }
          setActiveTab("studio");
        }
      } catch {
        toast({ title: "Error opening workflow canvas", variant: "error" });
      }
    },
    [toast]
  );

  // Automatic DAG Topological Layout
  const handleAutoLayout = useCallback(() => {
    if (canvasNodes.length === 0) return;
    const rankMap = new Map<string, number>();
    for (const n of canvasNodes) rankMap.set(n.id, n.type === "TRIGGER" ? 0 : 1);

    for (let pass = 0; pass < canvasNodes.length; pass++) {
      for (const e of canvasEdges) {
        const srcRank = rankMap.get(e.source) ?? 0;
        const tgtRank = rankMap.get(e.target) ?? 0;
        if (tgtRank <= srcRank) {
          rankMap.set(e.target, srcRank + 1);
        }
      }
    }

    const columns = new Map<number, CanvasNode[]>();
    for (const n of canvasNodes) {
      const r = rankMap.get(n.id) ?? 0;
      const list = columns.get(r) || [];
      list.push(n);
      columns.set(r, list);
    }

    const layoutedNodes = canvasNodes.map((n) => {
      const col = rankMap.get(n.id) ?? 0;
      const colNodes = columns.get(col) || [n];
      const rowIdx = colNodes.findIndex((x) => x.id === n.id);
      return {
        ...n,
        position: {
          x: 70 + col * 290,
          y: 120 + rowIdx * 150,
        },
      };
    });

    commitGraphChange(layoutedNodes, canvasEdges);
    setPan({ x: 30, y: 30 });
    setZoom(0.92);
    toast({ title: "Auto-Layout Applied", description: "Nodes aligned by execution rank.", variant: "info" });
  }, [canvasNodes, canvasEdges, commitGraphChange, toast]);

  // Add node from Left Sidebar Library onto Canvas
  const handleAddNodeFromCatalog = (subType: string, customPos?: { x: number; y: number }) => {
    const meta = getNodeCatalogEntry(subType);
    if (!meta) return;

    const newId = `node_${subType.toLowerCase()}_${Date.now().toString(36).slice(-4)}`;
    const anchorNode = canvasNodes.find((n) => n.id === selectedNodeId) || canvasNodes[canvasNodes.length - 1];
    const position = customPos || {
      x: anchorNode ? anchorNode.position.x + 290 : 100,
      y: anchorNode ? anchorNode.position.y : 180,
    };

    const newNode: CanvasNode = {
      id: newId,
      type: meta.type,
      subType: meta.subType,
      label: meta.label,
      description: meta.description,
      config: JSON.parse(JSON.stringify(meta.defaultConfig || {})),
      position,
      retryPolicy: { maxRetries: 1, backoffMs: 150, continueOnError: false },
    };

    const nextNodes = [...canvasNodes, newNode];
    const nextEdges = [...canvasEdges];

    if (anchorNode && newNode.type !== "TRIGGER") {
      const defaultBranch = anchorNode.type === "CONDITION" ? "TRUE" : "DEFAULT";
      nextEdges.push({
        id: `edge_${Date.now().toString(36)}`,
        source: anchorNode.id,
        target: newNode.id,
        branch: defaultBranch,
        label: defaultBranch === "TRUE" ? "YES" : undefined,
      });
    }

    commitGraphChange(nextNodes, nextEdges);
    setSelectedNodeId(newNode.id);
    setSelectedNodeIds(new Set([newNode.id]));
  };

  // Duplicate selected node
  const handleDuplicateNode = (node: CanvasNode) => {
    const copyId = `${node.id}_copy_${Date.now().toString(36).slice(-3)}`;
    const copyNode: CanvasNode = {
      ...JSON.parse(JSON.stringify(node)),
      id: copyId,
      label: `${node.label} (Copy)`,
      position: { x: node.position.x + 40, y: node.position.y + 120 },
    };
    commitGraphChange([...canvasNodes, copyNode], canvasEdges);
    setSelectedNodeId(copyId);
    setSelectedNodeIds(new Set([copyId]));
  };

  // Delete node & attached edges
  const handleDeleteNode = (nodeId: string) => {
    const nextNodes = canvasNodes.filter((n) => n.id !== nodeId);
    const nextEdges = canvasEdges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    commitGraphChange(nextNodes, nextEdges);
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(nextNodes[0]?.id || null);
    }
  };

  // Save Workflow Version to Backend
  const handleSaveWorkflow = async () => {
    if (!editingWorkflow) return;
    setSavingWorkflow(true);
    try {
      const triggerNode = canvasNodes.find((n) => n.type === "TRIGGER");
      const res = await fetch(`/api/workflows/${editingWorkflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowTitle.trim() || editingWorkflow.name,
          triggerType: triggerNode?.subType || editingWorkflow.triggerType,
          triggerConfig: triggerNode?.config || {},
          definition: {
            nodes: canvasNodes,
            edges: canvasEdges,
          },
          changelog: `Saved in Visual Studio (${canvasNodes.length} nodes, ${canvasEdges.length} connections)`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingWorkflow(json.data);
        setIsDirty(false);
        loadWorkflows();
        toast({
          title: `Workflow Saved (v${json.data.version})`,
          description: `${json.data.workflowCode} persisted with ${canvasNodes.length} nodes.`,
          variant: "success",
        });
      } else {
        toast({
          title: "Save Blocked",
          description: json.error?.message || "Could not save workflow",
          variant: "error",
        });
      }
    } finally {
      setSavingWorkflow(false);
    }
  };

  // Execute / Test Workflow on Backend Engine
  const handleExecuteWorkflow = async (simulatedMode = true) => {
    if (!editingWorkflow) return;
    if (isDirty) {
      await handleSaveWorkflow();
    }
    setTestingWorkflow(true);
    setBottomPanelOpen(true);
    try {
      const res = await fetch(`/api/workflows/${editingWorkflow.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulatedMode }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setLastTestExecution(json.data);
        loadExecutions();
        loadWorkflows();
        toast({
          title: simulatedMode ? "Test Execution Completed" : "Manual Execution Completed",
          description: `Run ${json.data.executionCode} finished with status ${json.data.status}.`,
          variant: json.data.status === "COMPLETED" ? "success" : "error",
        });
      } else {
        toast({
          title: "Execution Error",
          description: json.error?.message || "Workflow execution did not complete.",
          variant: "error",
        });
      }
    } finally {
      setTestingWorkflow(false);
    }
  };

  // Toggle Active / Paused status
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
          description: `${wkf.workflowCode} is now ${nextStatus}.`,
          variant: "success",
        });
        loadWorkflows();
        if (editingWorkflow?.id === wkf.id) {
          setEditingWorkflow(json.data);
        }
      } else {
        toast({ title: "Permission Denied", description: json.error?.message, variant: "error" });
      }
    } catch {
      toast({ title: "Status update failed", variant: "error" });
    }
  };

  // Duplicate Workflow in Catalog
  const handleDuplicateWorkflow = async (wkf: WorkflowItem) => {
    const res = await fetch(`/api/workflows/${wkf.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DUPLICATE" }),
    });
    const json = await res.json();
    if (json.success) {
      toast({
        title: "Workflow Duplicated",
        description: `Created ${json.data.workflowCode} (${json.data.name}).`,
        variant: "success",
      });
      loadWorkflows();
    }
  };

  // Delete Workflow
  const handleDeleteWorkflow = async (wkf: WorkflowItem) => {
    const res = await fetch(`/api/workflows/${wkf.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast({
        title: "Workflow Deleted",
        description: `${wkf.workflowCode} removed.`,
        variant: "info",
      });
      loadWorkflows();
      if (editingWorkflow?.id === wkf.id) {
        setEditingWorkflow(null);
        setActiveTab("catalog");
      }
    } else {
      toast({ title: "Delete Failed", description: json.error?.message, variant: "error" });
    }
  };

  // Export Workflow JSON
  const handleExportWorkflow = async (wkf: WorkflowItem) => {
    const res = await fetch(`/api/workflows/${wkf.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "EXPORT_JSON" }),
    });
    const json = await res.json();
    if (json.success) {
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${wkf.workflowCode.toLowerCase()}.workflow.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Workflow JSON Exported", variant: "success" });
    }
  };

  // Import Workflow JSON
  const handleImportWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJsonText);
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "IMPORT_JSON", payload: parsed }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Workflow Imported",
          description: `${json.data.workflowCode} imported as DRAFT.`,
          variant: "success",
        });
        setImportModalOpen(false);
        setImportJsonText("");
        loadWorkflows();
        openInStudio(json.data);
      } else {
        toast({ title: "Import Failed", description: json.error?.message, variant: "error" });
      }
    } catch {
      toast({ title: "Invalid JSON Format", description: "Please paste valid workflow JSON.", variant: "error" });
    }
  };

  // Create New Workflow
  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
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
        scheduleCron: newWkfTrigger === "SCHEDULE_TRIGGER" ? newWkfCron : undefined,
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
      description: `${json.data.workflowCode} (${json.data.name}) opened in Studio.`,
      variant: "success",
    });
    setCreateModalOpen(false);
    setNewWkfName("");
    setNewWkfDesc("");
    loadWorkflows();
    openInStudio(json.data);
  };

  // Retry or Cancel Execution
  const handleExecutionAction = async (executionId: string, action: "RETRY" | "CANCEL") => {
    const res = await fetch("/api/workflows/executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId, action }),
    });
    const json = await res.json();
    if (json.success) {
      toast({
        title: action === "RETRY" ? "Execution Retried Successfully" : "Execution Cancelled",
        description: `Execution is now ${json.data.status}.`,
        variant: "success",
      });
      loadExecutions();
      if (selectedExecution?.id === executionId) {
        setSelectedExecution(json.data);
      }
      if (lastTestExecution?.id === executionId) {
        setLastTestExecution(json.data);
      }
    } else {
      toast({ title: "Action Failed", description: json.error?.message, variant: "error" });
    }
  };

  // Save Integration (Admin Only)
  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/workflows/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integrationKey: intKey,
        name: intName,
        providerType: intProvider,
        endpointUrl: intEndpoint,
        credentialSecret: intSecret,
        isApprovedForEmployees: intEmployeeApproved,
      }),
    });
    const json = await res.json();
    if (json.success) {
      toast({
        title: "Integration Saved",
        description: `${json.data.integrationKey} stored securely server-side.`,
        variant: "success",
      });
      setIntegrationModalOpen(false);
      setIntKey("");
      setIntName("");
      setIntEndpoint("");
      setIntSecret("");
      loadIntegrations();
    } else {
      toast({ title: "Forbidden", description: json.error?.message, variant: "error" });
    }
  };

  // Canvas Mouse Drag & Wire Handlers
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
      return;
    }

    if (draggingNodeRef.current) {
      const { id, startX, startY, origX, origY } = draggingNodeRef.current;
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;
      const nextX = Math.max(10, Math.round((origX + dx) / 10) * 10);
      const nextY = Math.max(10, Math.round((origY + dy) / 10) * 10);
      setCanvasNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, position: { x: nextX, y: nextY } } : n))
      );
      setIsDirty(true);
      return;
    }

    if (wiringFromRef.current && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      setWiringCursor({
        ...wiringFromRef.current,
        x: canvasX,
        y: canvasY,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
    if (draggingNodeRef.current) {
      draggingNodeRef.current = null;
    }
    if (wiringFromRef.current) {
      wiringFromRef.current = null;
      setWiringCursor(null);
    }
  };

  const completeWireToNode = (targetNodeId: string) => {
    if (!wiringFromRef.current) return;
    const { sourceId, branch } = wiringFromRef.current;
    wiringFromRef.current = null;
    setWiringCursor(null);

    if (sourceId === targetNodeId) return;
    const exists = canvasEdges.some(
      (e) => e.source === sourceId && e.target === targetNodeId && (e.branch || "DEFAULT") === branch
    );
    if (exists) return;

    const newEdge: CanvasEdge = {
      id: `e_${Date.now().toString(36)}`,
      source: sourceId,
      target: targetNodeId,
      branch,
      label: branch === "TRUE" ? "YES" : branch === "FALSE" ? "NO" : branch === "ERROR" ? "ERR" : undefined,
    };
    commitGraphChange(canvasNodes, [...canvasEdges, newEdge]);
  };

  const selectedNode = useMemo(
    () => canvasNodes.find((n) => n.id === selectedNodeId) || null,
    [canvasNodes, selectedNodeId]
  );

  const selectedNodeCatalog = useMemo(
    () => (selectedNode ? getNodeCatalogEntry(selectedNode.subType) : undefined),
    [selectedNode]
  );

  const stepStatusByNodeId = useMemo(() => {
    const map = new Map<string, ExecutionStepItem>();
    for (const st of lastTestExecution?.steps || []) {
      map.set(st.nodeId, st);
    }
    return map;
  }, [lastTestExecution]);

  // Filtered & Sorted Workflows
  const filteredWorkflows = useMemo(() => {
    const filtered = workflows.filter((w) => {
      if (categoryFilter !== "ALL" && w.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && w.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          w.name.toLowerCase().includes(q) ||
          w.workflowCode.toLowerCase().includes(q) ||
          w.triggerType.toLowerCase().includes(q) ||
          (w.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "executions") {
        return (b._count?.executions ?? 0) - (a._count?.executions ?? 0);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [workflows, categoryFilter, statusFilter, searchQuery, sortBy]);

  // Dashboard Summary Metrics (Phase 11)
  const kpiStats = useMemo(() => {
    const totalWkf = workflows.length;
    const activeWkf = workflows.filter((w) => w.status === "ACTIVE").length;
    const draftWkf = workflows.filter((w) => w.status === "DRAFT" || w.status === "PAUSED").length;
    const failedExecs = executions.filter((e) => e.status === "FAILED").length;
    const successExecs = executions.filter((e) => e.status === "COMPLETED").length;
    const totalExecs = Math.max(
      executions.length,
      workflows.reduce((acc, w) => acc + (w._count?.executions ?? 0), 0)
    );
    return { totalWkf, activeWkf, draftWkf, failedExecs, successExecs, totalExecs };
  }, [workflows, executions]);

  const filteredCatalogNodes = useMemo(() => {
    return WORKFLOW_NODE_CATALOG.filter((item) => {
      if (expandedCat !== "ALL" && item.category !== expandedCat) return false;
      if (libSearch.trim()) {
        const q = libSearch.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.subType.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expandedCat, libSearch]);

  const updateSelectedNodeConfig = (key: string, value: any) => {
    if (!selectedNode) return;
    const nextNodes = canvasNodes.map((n) =>
      n.id === selectedNode.id
        ? { ...n, config: { ...(n.config || {}), [key]: value } }
        : n
    );
    commitGraphChange(nextNodes, canvasEdges);
  };

  const insertExpressionToken = (token: string) => {
    if (!selectedNode) return;
    const targetKey =
      activeConfigField ||
      selectedNodeCatalog?.fields.find((f) => f.type === "expression" || f.type === "text")?.key ||
      "subject";
    const currentVal = String(selectedNode.config?.[targetKey] ?? "");
    updateSelectedNodeConfig(targetKey, currentVal ? `${currentVal} ${token}` : token);
  };

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. Page Header                                                         */}
      {/* ---------------------------------------------------------------------- */}
      <PageHeader
        category="VISUAL BUSINESS AUTOMATION PLATFORM"
        title="Billora Workflow Studio"
        description="Build, connect, schedule, and monitor event-driven customer workflows with conditional branching, dynamic expressions, and idempotent safeguards."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-md border border-border bg-bg-subtle font-mono text-[11px] text-text-secondary">
              Builder Role: <strong className="text-brand">{userRole}</strong>
            </span>
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs font-medium text-text-secondary hover:bg-bg-subtle"
            >
              <Upload className="h-3.5 w-3.5" />
              Import JSON
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
      {/* 2. Phase 11 Management KPI Bar                                         */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-border bg-bg-base p-3.5 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-text-muted">Total Workflows</div>
          <div className="mt-1 text-xl font-bold font-mono text-text-primary">{kpiStats.totalWkf}</div>
          <div className="text-[10px] text-text-muted mt-0.5">7 Default Templates</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-base p-3.5 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-semantic-success">Active Workflows</div>
          <div className="mt-1 text-xl font-bold font-mono text-semantic-success">{kpiStats.activeWkf}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Listening for triggers</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-base p-3.5 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-semantic-warning">Draft / Paused</div>
          <div className="mt-1 text-xl font-bold font-mono text-semantic-warning">{kpiStats.draftWkf}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Editable in Studio</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-base p-3.5 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-brand">Total Executions</div>
          <div className="mt-1 text-xl font-bold font-mono text-text-primary">{kpiStats.totalExecs}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Idempotent DAG runs</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-base p-3.5 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-semantic-success">Successful Runs</div>
          <div className="mt-1 text-xl font-bold font-mono text-semantic-success">{kpiStats.successExecs}</div>
          <div className="text-[10px] text-text-muted mt-0.5">All branches verified</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-base p-3.5 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-semantic-danger">Failed Runs</div>
          <div className="mt-1 text-xl font-bold font-mono text-semantic-danger">{kpiStats.failedExecs}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Retry-enabled</div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. Primary Navigation Tabs                                             */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
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
            <span>Workflow Catalog & Templates</span>
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
            <span>Visual Workflow Builder</span>
            {editingWorkflow && (
              <span className="ml-1 text-[10px] font-mono opacity-85">
                ({editingWorkflow.workflowCode} • v{editingWorkflow.version})
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
            <span>Execution Monitor & Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("integrations")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
              activeTab === "integrations"
                ? "bg-brand text-brand-text shadow-xs"
                : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            )}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Integrations & Credentials</span>
          </button>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* TAB 1: WORKFLOW CATALOG & READY-TO-USE TEMPLATES                       */}
      {/* ====================================================================== */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="rounded-lg border border-border bg-bg-base p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workflows by name, code, trigger..."
                className="h-8 w-full rounded border border-border bg-bg-base pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono text-text-muted">Category:</span>
                {["ALL", "ONBOARDING", "RENEWAL", "COLLECTIONS", "BILLING", "GENERAL"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-mono font-medium border",
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
                      "px-2 py-0.5 rounded text-[11px] font-mono font-medium border",
                      statusFilter === st
                        ? "bg-brand/10 border-brand/40 text-brand font-semibold"
                        : "bg-bg-base border-border text-text-secondary hover:bg-bg-subtle"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-7 rounded border border-border bg-bg-base px-2 text-[11px] font-mono text-text-secondary"
              >
                <option value="updated">Sort: Recently Updated</option>
                <option value="name">Sort: Alphabetical</option>
                <option value="executions">Sort: Most Executed</option>
              </select>
            </div>
          </div>

          {/* Workflow Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-bg-base p-4 space-y-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkflows.map((wkf) => {
                const isTemplate = wkf.workflowCode.startsWith("WKF-TPL-");
                const canDelete = userRole === "ADMIN" || wkf.ownerId === userId;
                return (
                  <div
                    key={wkf.id}
                    className="rounded-lg border border-border bg-bg-base p-4 shadow-xs hover:border-brand/40 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                            {wkf.workflowCode}
                          </span>
                          {isTemplate && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                              TEMPLATE
                            </span>
                          )}
                        </div>
                        <StatusBadge status={wkf.status} />
                      </div>

                      <h3
                        onClick={() => openInStudio(wkf)}
                        className="text-sm font-bold text-text-primary line-clamp-1 hover:text-brand cursor-pointer transition-colors"
                      >
                        {wkf.name}
                      </h3>

                      <p className="text-xs text-text-muted line-clamp-2 min-h-[32px] leading-relaxed">
                        {wkf.description || "Automated multi-node customer workflow."}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          ⚡ {wkf.triggerType}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-bg-subtle text-text-secondary border border-border">
                          {wkf.category}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted">
                          v{wkf.version}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted truncate max-w-[130px]">
                          Owner: {wkf.owner?.fullName || "Admin"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs gap-2">
                      <span className="text-[11px] font-mono text-text-muted">
                        {wkf._count?.executions ?? 0} runs • {wkf._count?.tasks ?? 0} tasks
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(wkf)}
                          title={wkf.status === "ACTIVE" ? "Pause Workflow" : "Activate Workflow"}
                          className="p-1.5 rounded border border-border hover:bg-bg-subtle text-text-secondary"
                        >
                          {wkf.status === "ACTIVE" ? (
                            <Pause className="h-3.5 w-3.5 text-semantic-warning" />
                          ) : (
                            <Play className="h-3.5 w-3.5 text-semantic-success" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateWorkflow(wkf)}
                          title="Duplicate Workflow"
                          className="p-1.5 rounded border border-border hover:bg-bg-subtle text-text-secondary"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportWorkflow(wkf)}
                          title="Export JSON"
                          className="p-1.5 rounded border border-border hover:bg-bg-subtle text-text-secondary"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {canDelete && !isTemplate && (
                          <button
                            type="button"
                            onClick={() => handleDeleteWorkflow(wkf)}
                            title="Delete Workflow"
                            className="p-1.5 rounded border border-border hover:bg-semantic-danger-subtle text-semantic-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openInStudio(wkf)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand text-brand-text font-semibold hover:bg-brand-hover transition-colors"
                        >
                          <GitBranch className="h-3 w-3" />
                          Studio
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 2: VISUAL WORKFLOW BUILDER (LEFT LIB + INFINITE CANVAS + INSPECTOR)*/}
      {/* ====================================================================== */}
      {activeTab === "studio" && editingWorkflow && (
        <div className="space-y-3">
          {/* TOP STUDIO TOOLBAR */}
          <div className="rounded-lg border border-border bg-bg-base px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20 shrink-0">
                {editingWorkflow.workflowCode}
              </span>
              <input
                type="text"
                value={workflowTitle}
                onChange={(e) => {
                  setWorkflowTitle(e.target.value);
                  setIsDirty(true);
                }}
                className="h-7 px-2 rounded border border-transparent hover:border-border focus:border-brand bg-transparent text-sm font-bold text-text-primary focus:outline-none min-w-[220px]"
              />
              <StatusBadge status={editingWorkflow.status} />
              {isDirty && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Unsaved Draft (Auto-Saved Locally)
                </span>
              )}
            </div>

            {/* Studio Action Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Version History Selector */}
              {editingWorkflow.versions && editingWorkflow.versions.length > 0 && (
                <select
                  value={editingWorkflow.version}
                  onChange={(e) => {
                    const verNum = Number(e.target.value);
                    const verObj = editingWorkflow.versions?.find((v) => v.version === verNum);
                    if (verObj?.definition) {
                      try {
                        const parsed = JSON.parse(verObj.definition);
                        commitGraphChange(parsed.nodes || [], parsed.edges || []);
                        toast({
                          title: `Loaded Version v${verNum}`,
                          description: verObj.changelog || "Historical snapshot restored to canvas.",
                          variant: "info",
                        });
                      } catch {}
                    }
                  }}
                  className="h-7 rounded border border-border bg-bg-subtle px-2 text-xs font-mono text-text-secondary"
                >
                  {editingWorkflow.versions.map((v) => (
                    <option key={v.id} value={v.version}>
                      Version v{v.version}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Undo (Ctrl+Z)"
                className="inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex + 1 >= historyStack.length}
                title="Redo (Ctrl+Y)"
                className="inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle disabled:opacity-40"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleAutoLayout}
                title="Auto-Layout Nodes"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-border bg-bg-base text-xs font-medium text-text-secondary hover:bg-bg-subtle"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Auto-Layout
              </button>

              <div className="inline-flex items-center rounded border border-border bg-bg-base h-7 px-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                  className="p-1 text-text-secondary hover:text-text-primary"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(0.95);
                    setPan({ x: 30, y: 30 });
                  }}
                  className="px-1.5 font-mono text-[11px] text-text-muted hover:text-text-primary"
                  title="Reset View"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
                  className="p-1 text-text-secondary hover:text-text-primary"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveWorkflow}
                disabled={savingWorkflow}
                className="inline-flex items-center gap-1 h-7 px-3 rounded border border-brand/40 bg-brand/10 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {savingWorkflow ? "Saving..." : "Save"}
              </button>

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
                {editingWorkflow.status === "ACTIVE" ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {editingWorkflow.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </button>

              <button
                type="button"
                onClick={() => handleExecuteWorkflow(true)}
                disabled={testingWorkflow}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border bg-bg-subtle text-xs font-semibold text-text-primary hover:bg-bg-raised disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3 text-brand" />
                Test
              </button>

              <button
                type="button"
                onClick={() => handleExecuteWorkflow(false)}
                disabled={testingWorkflow}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded bg-brand text-xs font-semibold text-brand-text hover:bg-brand-hover shadow-xs disabled:opacity-50"
              >
                <Play className={cn("h-3 w-3", testingWorkflow && "animate-spin")} />
                {testingWorkflow ? "Executing..." : "Execute"}
              </button>
            </div>
          </div>

          {/* 3-COLUMN STUDIO BODY: LEFT NODE LIBRARY + CENTRAL INFINITE CANVAS + RIGHT NODE INSPECTOR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[600px]">
            {/* LEFT SIDEBAR: 10-CATEGORY NODE LIBRARY */}
            <div className="lg:col-span-3 rounded-lg border border-border bg-bg-base flex flex-col max-h-[620px] overflow-hidden shadow-xs">
              <div className="p-3 border-b border-border space-y-2 bg-bg-subtle/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-primary">
                    Node Library (10 Categories)
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {WORKFLOW_NODE_CATALOG.length} Nodes
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-text-muted" />
                  <input
                    type="search"
                    value={libSearch}
                    onChange={(e) => setLibSearch(e.target.value)}
                    placeholder="Filter triggers, conditions, actions..."
                    className="h-7 w-full rounded border border-border bg-bg-base pl-8 pr-2 text-xs text-text-primary"
                  />
                </div>
                {/* Category Pills */}
                <div className="flex flex-wrap gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setExpandedCat("ALL")}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-mono border",
                      expandedCat === "ALL"
                        ? "bg-brand text-white border-brand"
                        : "bg-bg-base text-text-muted border-border"
                    )}
                  >
                    ALL
                  </button>
                  {NODE_CATEGORY_META.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setExpandedCat(cat.key)}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-mono border",
                        expandedCat === cat.key
                          ? "bg-brand text-white border-brand"
                          : "bg-bg-base text-text-secondary border-border hover:bg-bg-subtle"
                      )}
                    >
                      {cat.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {filteredCatalogNodes.map((item) => (
                  <div
                    key={item.subType}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/billora-node", item.subType);
                    }}
                    onClick={() => handleAddNodeFromCatalog(item.subType)}
                    className={cn(
                      "group rounded-md border border-border bg-bg-base p-2.5 hover:border-brand/50 hover:shadow-xs transition-all cursor-pointer border-l-4",
                      item.colorClass
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-text-primary group-hover:text-brand">
                        {item.label}
                      </span>
                      <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold", item.badgeClass)}>
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5 leading-snug">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CENTRAL INFINITE INTERACTIVE WORKFLOW CANVAS */}
            <div
              ref={canvasContainerRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const subType = e.dataTransfer.getData("application/billora-node");
                if (subType && canvasContainerRef.current) {
                  const rect = canvasContainerRef.current.getBoundingClientRect();
                  const dropX = Math.max(20, Math.round(((e.clientX - rect.left - pan.x) / zoom) / 10) * 10);
                  const dropY = Math.max(20, Math.round(((e.clientY - rect.top - pan.y) / zoom) / 10) * 10);
                  handleAddNodeFromCatalog(subType, { x: dropX, y: dropY });
                }
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === "true") {
                  setIsPanning(true);
                  panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    panX: pan.x,
                    panY: pan.y,
                  };
                }
              }}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              className="lg:col-span-6 rounded-lg border border-border bg-bg-canvas relative overflow-hidden min-h-[620px] select-none shadow-inner cursor-grab active:cursor-grabbing"
            >
              {/* Infinite Grid Pattern */}
              <div
                data-canvas-bg="true"
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage: "radial-gradient(#4F46E5 1.25px, transparent 1.25px)",
                  backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
                  backgroundPosition: `${pan.x}px ${pan.y}px`,
                }}
              />

              {/* Transformed Pan/Zoom Plane */}
              <div
                data-canvas-bg="true"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
                className="absolute top-0 left-0 w-[2600px] h-[1600px]"
              >
                {/* SVG Edges Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  <defs>
                    <marker
                      id="arrow-default"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366F1" />
                    </marker>
                    <marker
                      id="arrow-true"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
                    </marker>
                    <marker
                      id="arrow-false"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
                    </marker>
                  </defs>

                  {canvasEdges.map((edge) => {
                    const src = canvasNodes.find((n) => n.id === edge.source);
                    const tgt = canvasNodes.find((n) => n.id === edge.target);
                    if (!src || !tgt) return null;

                    const isTrue = edge.branch === "TRUE" || edge.branch === "APPROVED";
                    const isFalse = edge.branch === "FALSE" || edge.branch === "REJECTED";
                    const x1 = src.position.x + NODE_WIDTH;
                    const y1 =
                      src.type === "CONDITION"
                        ? isFalse
                          ? src.position.y + 68
                          : src.position.y + 32
                        : src.position.y + NODE_HEIGHT / 2;
                    const x2 = tgt.position.x;
                    const y2 = tgt.position.y + NODE_HEIGHT / 2;
                    const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
                    const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                    const strokeColor = isTrue ? "#10B981" : isFalse ? "#EF4444" : "#6366F1";
                    const markerEnd = isTrue
                      ? "url(#arrow-true)"
                      : isFalse
                      ? "url(#arrow-false)"
                      : "url(#arrow-default)";

                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;

                    return (
                      <g key={edge.id} className="pointer-events-auto group">
                        <path
                          d={pathData}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={2.2}
                          markerEnd={markerEnd}
                          className="transition-all"
                        />
                        {(edge.label || edge.branch === "TRUE" || edge.branch === "FALSE") && (
                          <g transform={`translate(${midX - 18}, ${midY - 10})`}>
                            <rect
                              width="36"
                              height="18"
                              rx="4"
                              fill={isTrue ? "#065F46" : isFalse ? "#7F1D1D" : "#1E1B4B"}
                            />
                            <text
                              x="18"
                              y="12"
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize="9"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {edge.label || edge.branch}
                            </text>
                          </g>
                        )}
                        <circle
                          cx={midX}
                          cy={midY + 14}
                          r={7}
                          fill="#EF4444"
                          className="opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            commitGraphChange(
                              canvasNodes,
                              canvasEdges.filter((x) => x.id !== edge.id)
                            );
                          }}
                        />
                      </g>
                    );
                  })}

                  {/* Active Dragged Wire Preview */}
                  {wiringCursor && (() => {
                    const src = canvasNodes.find((n) => n.id === wiringCursor.sourceId);
                    if (!src) return null;
                    const x1 = src.position.x + NODE_WIDTH;
                    const y1 =
                      src.type === "CONDITION" && wiringCursor.branch === "FALSE"
                        ? src.position.y + 68
                        : src.position.y + 40;
                    const x2 = wiringCursor.x;
                    const y2 = wiringCursor.y;
                    return (
                      <path
                        d={`M ${x1} ${y1} L ${x2} ${y2}`}
                        fill="none"
                        stroke="#6366F1"
                        strokeWidth={2}
                        strokeDasharray="5,5"
                      />
                    );
                  })()}
                </svg>

                {/* Draggable Visual Node Cards */}
                {canvasNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id || selectedNodeIds.has(node.id);
                  const stepTrace = stepStatusByNodeId.get(node.id);
                  const isTrigger = node.type === "TRIGGER";
                  const isCondition = node.type === "CONDITION";

                  return (
                    <div
                      key={node.id}
                      style={{
                        left: node.position.x,
                        top: node.position.y,
                        width: NODE_WIDTH,
                        minHeight: NODE_HEIGHT,
                      }}
                      onMouseDown={(ev) => {
                        ev.stopPropagation();
                        setSelectedNodeId(node.id);
                        if (ev.shiftKey) {
                          setSelectedNodeIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(node.id)) next.delete(node.id);
                            else next.add(node.id);
                            return next;
                          });
                        } else {
                          setSelectedNodeIds(new Set([node.id]));
                        }
                        draggingNodeRef.current = {
                          id: node.id,
                          startX: ev.clientX,
                          startY: ev.clientY,
                          origX: node.position.x,
                          origY: node.position.y,
                        };
                      }}
                      onMouseUp={(ev) => {
                        ev.stopPropagation();
                        if (wiringFromRef.current) {
                          completeWireToNode(node.id);
                        }
                      }}
                      className={cn(
                        "absolute rounded-lg border bg-bg-base p-3 shadow-md transition-shadow cursor-move border-l-4",
                        isSelected
                          ? "border-brand ring-2 ring-brand/25 shadow-lg"
                          : "border-border hover:border-brand/50",
                        isTrigger
                          ? "border-l-amber-500"
                          : isCondition
                          ? "border-l-indigo-500"
                          : "border-l-emerald-500"
                      )}
                    >
                      {/* Input Port Handle (Left Side) */}
                      {!isTrigger && (
                        <div
                          onMouseUp={(ev) => {
                            ev.stopPropagation();
                            completeWireToNode(node.id);
                          }}
                          title="Drop wire here to connect input"
                          className="absolute -left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-brand bg-bg-base hover:scale-125 transition-transform"
                        />
                      )}

                      {/* Output Port Handles (Right Side) */}
                      {isCondition ? (
                        <>
                          <div
                            onMouseDown={(ev) => {
                              ev.stopPropagation();
                              wiringFromRef.current = {
                                sourceId: node.id,
                                branch: "TRUE",
                                x: node.position.x + NODE_WIDTH,
                                y: node.position.y + 32,
                              };
                            }}
                            title="Drag from TRUE (Yes) port to target node"
                            className="absolute -right-2.5 top-6 h-4 w-4 rounded-full border-2 border-emerald-500 bg-emerald-500/20 hover:scale-125 transition-transform cursor-crosshair"
                          />
                          <div
                            onMouseDown={(ev) => {
                              ev.stopPropagation();
                              wiringFromRef.current = {
                                sourceId: node.id,
                                branch: "FALSE",
                                x: node.position.x + NODE_WIDTH,
                                y: node.position.y + 68,
                              };
                            }}
                            title="Drag from FALSE (No) port to target node"
                            className="absolute -right-2.5 top-14 h-4 w-4 rounded-full border-2 border-rose-500 bg-rose-500/20 hover:scale-125 transition-transform cursor-crosshair"
                          />
                        </>
                      ) : (
                        node.subType !== "COMPLETE_WORKFLOW" && (
                          <div
                            onMouseDown={(ev) => {
                              ev.stopPropagation();
                              wiringFromRef.current = {
                                sourceId: node.id,
                                branch: "DEFAULT",
                                x: node.position.x + NODE_WIDTH,
                                y: node.position.y + NODE_HEIGHT / 2,
                              };
                            }}
                            title="Drag to connect output to another node"
                            className="absolute -right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-brand bg-brand/20 hover:scale-125 transition-transform cursor-crosshair"
                          />
                        )
                      )}

                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={cn(
                            "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase",
                            isTrigger
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : isCondition
                              ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {node.subType}
                        </span>

                        <div className="flex items-center gap-1">
                          {stepTrace && (
                            <span
                              title={`Step Status: ${stepTrace.status}`}
                              className={cn(
                                "h-4 w-4 rounded-full flex items-center justify-center",
                                stepTrace.status === "SUCCESS"
                                  ? "bg-emerald-500/20 text-emerald-500"
                                  : "bg-rose-500/20 text-rose-500"
                              )}
                            >
                              {stepTrace.status === "SUCCESS" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <AlertCircle className="h-3 w-3" />
                              )}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleDuplicateNode(node);
                            }}
                            title="Duplicate Node"
                            className="text-text-muted hover:text-text-primary p-0.5"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          {canvasNodes.length > 1 && (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleDeleteNode(node.id);
                              }}
                              title="Delete Node"
                              className="text-text-muted hover:text-semantic-danger p-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-bold text-text-primary truncate">{node.label}</div>
                      <div className="text-[10px] text-text-muted line-clamp-2 mt-0.5">
                        {node.description || "Configured workflow step"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Canvas Minimap (Bottom Right) */}
              <div className="absolute bottom-3 right-3 z-20 w-40 h-24 rounded-md border border-border bg-bg-base/90 backdrop-blur-xs p-1.5 shadow-md pointer-events-none">
                <div className="text-[9px] font-mono text-text-muted uppercase mb-1 flex justify-between">
                  <span>Minimap</span>
                  <span>{canvasNodes.length}N / {canvasEdges.length}E</span>
                </div>
                <div className="relative w-full h-14 bg-bg-subtle rounded overflow-hidden">
                  {canvasNodes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        left: `${Math.min(92, Math.max(2, (n.position.x / 1600) * 100))}%`,
                        top: `${Math.min(85, Math.max(4, (n.position.y / 600) * 100))}%`,
                      }}
                      className={cn(
                        "absolute w-2.5 h-1.5 rounded-xs",
                        n.id === selectedNodeId
                          ? "bg-brand ring-1 ring-white"
                          : n.type === "TRIGGER"
                          ? "bg-amber-500"
                          : n.type === "CONDITION"
                          ? "bg-indigo-500"
                          : "bg-emerald-500"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Helper Legend Banner (Bottom Left) */}
              <div className="absolute bottom-3 left-3 z-20 rounded-md border border-border bg-bg-base/90 backdrop-blur-xs px-2.5 py-1 text-[10px] font-mono text-text-muted">
                Drag nodes to position • Drag right port ● to left port ○ to wire • Click red dot on edge to remove
              </div>
            </div>

            {/* RIGHT SIDEBAR: SELECTED NODE CONFIGURATION, EXPRESSIONS & DATA PREVIEW */}
            <div className="lg:col-span-3 rounded-lg border border-border bg-bg-base flex flex-col max-h-[620px] overflow-hidden shadow-xs">
              {selectedNode ? (
                <>
                  <div className="p-3 border-b border-border bg-bg-subtle/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase text-brand">
                          {selectedNode.type} • {selectedNode.subType}
                        </span>
                        <h3 className="text-xs font-bold text-text-primary truncate">
                          {selectedNode.label}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNode(selectedNode.id)}
                        className="text-text-muted hover:text-semantic-danger p-1"
                        title="Delete Node"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Inspector Sub-Tabs */}
                    <div className="grid grid-cols-3 gap-1 bg-bg-base p-0.5 rounded border border-border text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setInspectorTab("config")}
                        className={cn(
                          "py-1 rounded text-center",
                          inspectorTab === "config"
                            ? "bg-brand text-white"
                            : "text-text-secondary hover:bg-bg-subtle"
                        )}
                      >
                        Settings
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTab("connect")}
                        className={cn(
                          "py-1 rounded text-center",
                          inspectorTab === "connect"
                            ? "bg-brand text-white"
                            : "text-text-secondary hover:bg-bg-subtle"
                        )}
                      >
                        Connections
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTab("preview")}
                        className={cn(
                          "py-1 rounded text-center",
                          inspectorTab === "preview"
                            ? "bg-brand text-white"
                            : "text-text-secondary hover:bg-bg-subtle"
                        )}
                      >
                        I/O Preview
                      </button>
                    </div>
                  </div>

                  {/* Inspector Body */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                    {inspectorTab === "config" && (
                      <>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                            Node Label
                          </label>
                          <input
                            type="text"
                            value={selectedNode.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              commitGraphChange(
                                canvasNodes.map((n) =>
                                  n.id === selectedNode.id ? { ...n, label: val } : n
                                ),
                                canvasEdges
                              );
                            }}
                            className="h-8 w-full rounded border border-border bg-bg-base px-2.5 text-xs text-text-primary"
                          />
                        </div>

                        {/* Dynamic Fields from Node Catalog */}
                        {(selectedNodeCatalog?.fields || []).map((field) => {
                          const val =
                            selectedNode.config?.[field.key] ?? field.defaultValue ?? "";
                          return (
                            <div key={field.key}>
                              <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                                {field.label}
                              </label>
                              {field.type === "select" ? (
                                <select
                                  value={String(val)}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig(field.key, e.target.value)
                                  }
                                  className="h-8 w-full rounded border border-border bg-bg-base px-2 text-xs text-text-primary"
                                >
                                  {(field.options || []).map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === "boolean" ? (
                                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(val)}
                                    onChange={(e) =>
                                      updateSelectedNodeConfig(field.key, e.target.checked)
                                    }
                                  />
                                  <span>Enabled</span>
                                </label>
                              ) : field.type === "textarea" ? (
                                <textarea
                                  rows={3}
                                  value={String(val)}
                                  onFocus={() => setActiveConfigField(field.key)}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig(field.key, e.target.value)
                                  }
                                  className="w-full rounded border border-border bg-bg-base p-2 text-xs font-mono text-text-primary"
                                />
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : "text"}
                                  value={String(val)}
                                  placeholder={field.placeholder}
                                  onFocus={() => setActiveConfigField(field.key)}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig(
                                      field.key,
                                      field.type === "number"
                                        ? Number(e.target.value)
                                        : e.target.value
                                    )
                                  }
                                  className="h-8 w-full rounded border border-border bg-bg-base px-2.5 text-xs font-mono text-text-primary"
                                />
                              )}
                            </div>
                          );
                        })}

                        {/* Dynamic Expression Picker */}
                        <div className="pt-2 border-t border-border">
                          <div className="text-[10px] font-mono uppercase text-text-muted mb-1.5">
                            Insert Dynamic Expression (Click to Insert)
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 rounded bg-bg-subtle border border-border">
                            {WORKFLOW_EXPRESSION_VARIABLES.map((v) => (
                              <button
                                key={v.token}
                                type="button"
                                onClick={() => insertExpressionToken(v.token)}
                                title={v.description}
                                className="px-1.5 py-0.5 rounded bg-brand/10 hover:bg-brand hover:text-white text-brand font-mono text-[10px] transition-colors"
                              >
                                {v.token}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Reliability & Retry Policy */}
                        <div className="pt-2 border-t border-border space-y-2">
                          <div className="text-[10px] font-mono uppercase text-text-muted">
                            Reliability & Error Recovery
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-text-muted">Max Retries</label>
                              <input
                                type="number"
                                min={0}
                                max={3}
                                value={selectedNode.retryPolicy?.maxRetries ?? 1}
                                onChange={(e) => {
                                  const retries = Number(e.target.value);
                                  commitGraphChange(
                                    canvasNodes.map((n) =>
                                      n.id === selectedNode.id
                                        ? {
                                            ...n,
                                            retryPolicy: {
                                              ...(n.retryPolicy || {}),
                                              maxRetries: retries,
                                            },
                                          }
                                        : n
                                    ),
                                    canvasEdges
                                  );
                                }}
                                className="h-7 w-full rounded border border-border bg-bg-base px-2 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-text-muted">Backoff (ms)</label>
                              <input
                                type="number"
                                step={50}
                                value={selectedNode.retryPolicy?.backoffMs ?? 150}
                                onChange={(e) => {
                                  const backoff = Number(e.target.value);
                                  commitGraphChange(
                                    canvasNodes.map((n) =>
                                      n.id === selectedNode.id
                                        ? {
                                            ...n,
                                            retryPolicy: {
                                              ...(n.retryPolicy || {}),
                                              backoffMs: backoff,
                                            },
                                          }
                                        : n
                                    ),
                                    canvasEdges
                                  );
                                }}
                                className="h-7 w-full rounded border border-border bg-bg-base px-2 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {inspectorTab === "connect" && (
                      <div className="space-y-3">
                        <p className="text-[11px] text-text-muted">
                          Manage outgoing branch connections from <strong>{selectedNode.label}</strong>:
                        </p>

                        {/* Existing outgoing edges */}
                        <div className="space-y-1.5">
                          {canvasEdges
                            .filter((e) => e.source === selectedNode.id)
                            .map((edge) => {
                              const tgt = canvasNodes.find((n) => n.id === edge.target);
                              return (
                                <div
                                  key={edge.id}
                                  className="flex items-center justify-between p-2 rounded border border-border bg-bg-subtle text-xs"
                                >
                                  <div>
                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand mr-1.5">
                                      {edge.branch || "DEFAULT"}
                                    </span>
                                    <span className="font-semibold text-text-primary">
                                      → {tgt?.label || edge.target}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      commitGraphChange(
                                        canvasNodes,
                                        canvasEdges.filter((x) => x.id !== edge.id)
                                      )
                                    }
                                    className="text-semantic-danger hover:underline text-[11px]"
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                        </div>

                        {/* Add new branch connection */}
                        <div className="pt-2 border-t border-border space-y-2">
                          <div className="text-[10px] font-mono uppercase text-text-muted">
                            Add Outgoing Connection
                          </div>
                          {canvasNodes
                            .filter((n) => n.id !== selectedNode.id && n.type !== "TRIGGER")
                            .map((targetNode) => (
                              <div
                                key={targetNode.id}
                                className="flex items-center justify-between gap-1 p-1.5 rounded border border-border"
                              >
                                <span className="text-xs truncate">{targetNode.label}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {(selectedNode.type === "CONDITION"
                                    ? (["TRUE", "FALSE"] as const)
                                    : (["DEFAULT", "ERROR"] as const)
                                  ).map((br) => (
                                    <button
                                      key={br}
                                      type="button"
                                      onClick={() => {
                                        const newEdge: CanvasEdge = {
                                          id: `e_${Date.now().toString(36)}_${br}`,
                                          source: selectedNode.id,
                                          target: targetNode.id,
                                          branch: br,
                                          label: br === "TRUE" ? "YES" : br === "FALSE" ? "NO" : undefined,
                                        };
                                        commitGraphChange(canvasNodes, [...canvasEdges, newEdge]);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-bg-subtle hover:bg-brand hover:text-white font-mono text-[10px] border border-border"
                                    >
                                      +{br}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {inspectorTab === "preview" && (
                      <div className="space-y-3">
                        {(() => {
                          const trace = stepStatusByNodeId.get(selectedNode.id);
                          return trace ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase text-text-muted">
                                  Last Run Status
                                </span>
                                <StatusBadge status={trace.status} />
                              </div>
                              <div>
                                <div className="text-[10px] font-mono uppercase text-text-muted mb-1">
                                  Resolved Input Context
                                </div>
                                <pre className="p-2 rounded bg-bg-subtle border border-border font-mono text-[10px] text-text-secondary overflow-x-auto max-h-40">
                                  {trace.inputPayload
                                    ? JSON.stringify(JSON.parse(trace.inputPayload), null, 2)
                                    : "{}"}
                                </pre>
                              </div>
                              <div>
                                <div className="text-[10px] font-mono uppercase text-text-muted mb-1">
                                  Node Output Payload
                                </div>
                                <pre className="p-2 rounded bg-bg-subtle border border-border font-mono text-[10px] text-emerald-600 dark:text-emerald-400 overflow-x-auto max-h-48">
                                  {trace.outputPayload
                                    ? JSON.stringify(JSON.parse(trace.outputPayload), null, 2)
                                    : "{}"}
                                </pre>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-[11px] text-text-muted">
                                Click <strong>Test</strong> or <strong>Execute</strong> in the top toolbar to inspect live node I/O. Sample schema output:
                              </div>
                              <pre className="p-2.5 rounded bg-bg-subtle border border-border font-mono text-[10px] text-text-secondary overflow-x-auto">
                                {JSON.stringify(selectedNodeCatalog?.sampleOutput || {}, null, 2)}
                              </pre>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center space-y-2 my-auto">
                  <Settings className="h-7 w-7 text-text-muted mx-auto" />
                  <div className="text-xs font-semibold text-text-primary">No Node Selected</div>
                  <p className="text-[11px] text-text-muted">
                    Click any node on the canvas to configure its parameters, dynamic expressions, and conditional branches.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM PANEL: EXECUTION STATUS, STEP LOGS & DEBUGGER */}
          <div className="rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden">
            <div
              onClick={() => setBottomPanelOpen((v) => !v)}
              className="flex items-center justify-between px-4 py-2.5 bg-bg-subtle/60 border-b border-border cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs">
                <Terminal className="h-4 w-4 text-brand" />
                <span className="font-mono font-bold uppercase tracking-wider text-text-primary">
                  Execution Debugger & Step Console
                </span>
                {lastTestExecution && (
                  <>
                    <span className="font-mono text-brand font-semibold">
                      ({lastTestExecution.executionCode})
                    </span>
                    <StatusBadge status={lastTestExecution.status} />
                    <span className="text-[11px] font-mono text-text-muted">
                      {lastTestExecution.steps?.length || 0} nodes executed
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {lastTestExecution && lastTestExecution.status === "FAILED" && (
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleExecutionAction(lastTestExecution.id, "RETRY");
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand text-white text-[11px] font-semibold"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry Failed Run
                  </button>
                )}
                {bottomPanelOpen ? (
                  <ChevronDown className="h-4 w-4 text-text-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-text-muted" />
                )}
              </div>
            </div>

            {bottomPanelOpen && (
              <div className="p-3 max-h-56 overflow-y-auto space-y-2 text-xs">
                {lastTestExecution && lastTestExecution.steps?.length ? (
                  lastTestExecution.steps.map((st, idx) => (
                    <div
                      key={st.id}
                      onClick={() => setSelectedNodeId(st.nodeId)}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded border cursor-pointer transition-colors",
                        st.status === "FAILED"
                          ? "border-semantic-danger/40 bg-semantic-danger-subtle"
                          : "border-border bg-bg-base hover:bg-bg-subtle/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-brand">
                          #{idx + 1}
                        </span>
                        <StatusBadge status={st.status} />
                        <span className="font-semibold text-text-primary">{st.nodeLabel}</span>
                        <span className="font-mono text-[10px] text-text-muted">
                          [{st.nodeType}]
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-text-secondary truncate max-w-xl">
                        {st.errorMessage ? (
                          <span className="text-semantic-danger font-semibold">
                            Error: {st.errorMessage}
                          </span>
                        ) : (
                          st.outputPayload
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-text-muted font-mono">
                    Click &quot;Test&quot; or &quot;Execute&quot; in the toolbar above to run this workflow on the backend DAG engine and inspect live step outputs.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 3: EXECUTION MONITORING & STEP TIMELINE (PHASE 9)                  */}
      {/* ====================================================================== */}
      {activeTab === "executions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-base p-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-mono text-text-muted">Filter Status:</span>
              {["ALL", "COMPLETED", "FAILED", "RUNNING", "CANCELLED"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setExecStatusFilter(st)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-mono border",
                    execStatusFilter === st
                      ? "bg-brand text-white border-brand"
                      : "bg-bg-base text-text-secondary border-border hover:bg-bg-subtle"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadExecutions}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-border bg-bg-base text-xs font-medium text-text-secondary hover:bg-bg-subtle"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingExecutions && "animate-spin")} />
              Refresh Logs
            </button>
          </div>

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
                    <div className="font-semibold text-text-primary">
                      {r.workflow?.name || "Automated Workflow"}
                    </div>
                    <div className="text-[10px] font-mono text-text-muted">
                      {r.workflow?.workflowCode}
                    </div>
                  </div>
                ),
              },
              {
                key: "trigger",
                header: "Trigger Type",
                mono: true,
                render: (r: ExecutionItem) => (
                  <span className="px-2 py-0.5 rounded bg-bg-subtle border border-border text-[11px] font-mono">
                    {r.triggerEvent}
                  </span>
                ),
              },
              {
                key: "customer",
                header: "Customer Subject",
                render: (r: ExecutionItem) => (
                  <div>
                    <div className="text-xs font-medium text-text-primary">
                      {r.customer?.contactName || "System / Global"}
                    </div>
                    {r.customer?.customerCode && (
                      <div className="text-[10px] font-mono text-text-muted">
                        {r.customer.customerCode}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "nodes",
                header: "Executed / Failed Nodes",
                mono: true,
                render: (r: ExecutionItem) => {
                  const total = r.steps?.length || 0;
                  const failed = (r.steps || []).filter((s) => s.status === "FAILED").length;
                  return (
                    <span className="font-mono text-xs">
                      {total} steps{" "}
                      {failed > 0 && (
                        <span className="text-semantic-danger font-semibold">
                          ({failed} failed)
                        </span>
                      )}
                    </span>
                  );
                },
              },
              {
                key: "duration",
                header: "Duration",
                mono: true,
                render: (r: ExecutionItem) => {
                  const ms =
                    r.completedAt && r.startedAt
                      ? Math.max(
                          1,
                          new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
                        )
                      : null;
                  return (
                    <span className="font-mono text-xs text-text-muted">
                      {ms !== null ? `${ms} ms` : "Running..."}
                    </span>
                  );
                },
              },
              {
                key: "status",
                header: "Status",
                render: (r: ExecutionItem) => <StatusBadge status={r.status} />,
              },
              {
                key: "started",
                header: "Started Time",
                mono: true,
                render: (r: ExecutionItem) => (
                  <span className="text-xs text-text-muted">
                    {new Date(r.startedAt).toLocaleString("en-IN")}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r: ExecutionItem) => (
                  <div className="inline-flex items-center gap-2">
                    {r.status === "FAILED" && (
                      <button
                        type="button"
                        onClick={() => handleExecutionAction(r.id, "RETRY")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-brand/10 text-brand text-xs font-semibold hover:bg-brand hover:text-white"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                    {r.status === "RUNNING" && (
                      <button
                        type="button"
                        onClick={() => handleExecutionAction(r.id, "CANCEL")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-semantic-danger-subtle text-semantic-danger text-xs font-semibold"
                      >
                        <XCircle className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedExecution(r)}
                      className="inline-flex items-center gap-1 text-xs text-brand font-semibold hover:underline"
                    >
                      <Eye className="h-3 w-3" />
                      Timeline
                    </button>
                  </div>
                ),
              },
            ]}
            data={executions}
            rowKey={(r) => r.id}
            loading={loadingExecutions}
            emptyTitle="No workflow executions found"
            emptyDescription="Run any workflow from the Visual Studio or trigger an event to view step-by-step execution traces."
          />
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 4: INTEGRATIONS & SERVER-SIDE CREDENTIAL MANAGER (PHASE 10)        */}
      {/* ====================================================================== */}
      {activeTab === "integrations" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-bg-base p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Approved Integrations & Credential Vault
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Credentials are encrypted/stored strictly server-side and referenced by key (never embedded in workflow JSON).
              </p>
            </div>
            {userRole === "ADMIN" && (
              <button
                type="button"
                onClick={() => setIntegrationModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                Configure Global Integration
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((intItem) => (
              <div
                key={intItem.id}
                className="rounded-lg border border-border bg-bg-base p-4 shadow-xs space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                      {intItem.integrationKey}
                    </span>
                    <StatusBadge status={intItem.isActive ? "ACTIVE" : "PAUSED"} />
                  </div>
                  <h4 className="text-sm font-bold text-text-primary">{intItem.name}</h4>
                  <div className="text-[11px] font-mono text-text-muted break-all">
                    Endpoint: {intItem.endpointUrl || "Internal Provider"}
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] font-mono">
                  <span className="text-text-secondary">
                    Secret: <code>{intItem.credentialMasked}</code>
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded",
                      intItem.isApprovedForEmployees
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {intItem.isApprovedForEmployees ? "Employee Approved" : "Admin Only"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Execution Timeline Inspector Modal (Phase 9)                           */}
      {/* ---------------------------------------------------------------------- */}
      {selectedExecution && (
        <ModalDialog
          open={Boolean(selectedExecution)}
          onClose={() => setSelectedExecution(null)}
          title={`Execution Timeline — ${selectedExecution.executionCode}`}
          description={`Workflow: ${selectedExecution.workflow?.name || selectedExecution.triggerEvent}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg border border-border bg-bg-subtle text-xs">
              <div>
                <div className="text-[10px] font-mono text-text-muted uppercase">Status</div>
                <StatusBadge status={selectedExecution.status} />
              </div>
              <div>
                <div className="text-[10px] font-mono text-text-muted uppercase">Trigger</div>
                <div className="font-mono font-semibold">{selectedExecution.triggerEvent}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-text-muted uppercase">Started</div>
                <div className="font-mono">
                  {new Date(selectedExecution.startedAt).toLocaleTimeString("en-IN")}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-text-muted uppercase">Retries</div>
                <div className="font-mono">{selectedExecution.retryCount ?? 0}</div>
              </div>
            </div>

            {selectedExecution.failureReason && (
              <div className="rounded-lg border border-semantic-danger/40 bg-semantic-danger-subtle p-3 text-xs text-semantic-danger font-medium flex items-center justify-between">
                <span>Failure Reason: {selectedExecution.failureReason}</span>
                <button
                  type="button"
                  onClick={() => handleExecutionAction(selectedExecution.id, "RETRY")}
                  className="px-2.5 py-1 rounded bg-semantic-danger text-white text-xs font-semibold"
                >
                  Retry Execution
                </button>
              </div>
            )}

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {(selectedExecution.steps || []).map((st, idx) => (
                <div
                  key={st.id}
                  className={cn(
                    "rounded-lg border p-3 text-xs space-y-2 shadow-xs",
                    st.status === "FAILED"
                      ? "border-semantic-danger bg-semantic-danger-subtle/30"
                      : "border-border bg-bg-base"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-brand font-bold">Step #{idx + 1}</span>
                      <span className="font-bold text-text-primary">{st.nodeLabel}</span>
                      <span className="font-mono text-[10px] text-text-muted">({st.nodeType})</span>
                    </div>
                    <StatusBadge status={st.status} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] font-mono text-text-muted uppercase mb-0.5">
                        Input Context (Redacted)
                      </div>
                      <pre className="p-2 rounded bg-bg-subtle text-[10px] font-mono text-text-secondary overflow-x-auto max-h-28">
                        {st.inputPayload || "{}"}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-text-muted uppercase mb-0.5">
                        Output Payload
                      </div>
                      <pre className="p-2 rounded bg-bg-subtle text-[10px] font-mono text-text-primary overflow-x-auto max-h-28">
                        {st.outputPayload || "{}"}
                      </pre>
                    </div>
                  </div>

                  {st.errorMessage && (
                    <div className="text-semantic-danger text-[11px] font-semibold">
                      Error: {st.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ModalDialog>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Create New Workflow Modal                                              */}
      {/* ---------------------------------------------------------------------- */}
      <ModalDialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Automated Workflow"
        description="Configure trigger category, schedule/event, and baseline parameters."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateWorkflow} className="space-y-4">
          <FormField label="Workflow Name" required>
            <input
              type="text"
              required
              value={newWkfName}
              onChange={(e) => setNewWkfName(e.target.value)}
              placeholder="e.g., Enterprise High-Value Invoice Follow-Up"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Trigger Type" required>
              <select
                value={newWkfTrigger}
                onChange={(e) => setNewWkfTrigger(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs text-text-primary"
              >
                <option value="SUBSCRIPTION_RENEWAL">Subscription Approaching Expiry</option>
                <option value="SUBSCRIPTION_EXPIRED">Subscription Expired</option>
                <option value="SUBSCRIPTION_CREATED">Subscription Created</option>
                <option value="INVOICE_GENERATED">Invoice Generated</option>
                <option value="INVOICE_OVERDUE">Invoice Overdue</option>
                <option value="PAYMENT_SUCCESS">Payment Received (Verified)</option>
                <option value="PAYMENT_FAILED">Payment Failed</option>
                <option value="CUSTOMER_CREATED">Customer Created / Registered</option>
                <option value="QUOTATION_CONFIRMED">Quotation Confirmed</option>
                <option value="SCHEDULE_TRIGGER">Schedule Trigger (Cron / Interval)</option>
                <option value="WEBHOOK_TRIGGER">Webhook Trigger</option>
                <option value="MANUAL_TRIGGER">Manual Trigger</option>
              </select>
            </FormField>

            <FormField label="Category" required>
              <select
                value={newWkfCategory}
                onChange={(e) => setNewWkfCategory(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs text-text-primary"
              >
                <option value="ONBOARDING">Onboarding</option>
                <option value="RENEWAL">Renewal</option>
                <option value="COLLECTIONS">Collections</option>
                <option value="BILLING">Billing</option>
                <option value="GENERAL">General</option>
              </select>
            </FormField>
          </div>

          {newWkfTrigger === "SCHEDULE_TRIGGER" && (
            <FormField label="Cron Schedule Expression (Asia/Kolkata)">
              <input
                type="text"
                value={newWkfCron}
                onChange={(e) => setNewWkfCron(e.target.value)}
                placeholder="0 9 * * *"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs font-mono text-text-primary"
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Assigned Department">
              <input
                type="text"
                value={newWkfDepartment}
                onChange={(e) => setNewWkfDepartment(e.target.value)}
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
              placeholder="Describe the automation objective..."
              className="w-full rounded-md border border-border bg-bg-base p-2.5 text-xs text-text-primary"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover"
            >
              Create & Open Studio
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ---------------------------------------------------------------------- */}
      {/* Import Workflow JSON Modal                                             */}
      {/* ---------------------------------------------------------------------- */}
      <ModalDialog
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Workflow JSON"
        description="Paste a validated Billora workflow JSON definition."
        maxWidth="lg"
      >
        <form onSubmit={handleImportWorkflow} className="space-y-4">
          <FormField label="Workflow JSON Definition" required>
            <textarea
              rows={8}
              required
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{"workflow":{"name":"Imported Flow","triggerType":"CUSTOMER_CREATED","definition":{"nodes":[],"edges":[]}}}'
              className="w-full rounded-md border border-border bg-bg-base p-2.5 text-xs font-mono text-text-primary"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setImportModalOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white"
            >
              Validate & Import
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ---------------------------------------------------------------------- */}
      {/* Configure Global Integration Modal (Admin Only)                        */}
      {/* ---------------------------------------------------------------------- */}
      <ModalDialog
        open={integrationModalOpen}
        onClose={() => setIntegrationModalOpen(false)}
        title="Configure Global Integration Credential"
        description="Secrets are stored server-side only and never exposed in workflow JSON."
        maxWidth="md"
      >
        <form onSubmit={handleSaveIntegration} className="space-y-3">
          <FormField label="Integration Reference Key" required>
            <input
              type="text"
              required
              value={intKey}
              onChange={(e) => setIntKey(e.target.value)}
              placeholder="INT-SLACK-SALES"
              className="h-8 w-full rounded border border-border bg-bg-base px-2.5 text-xs font-mono"
            />
          </FormField>
          <FormField label="Display Name" required>
            <input
              type="text"
              required
              value={intName}
              onChange={(e) => setIntName(e.target.value)}
              placeholder="Slack #sales-renewals Webhook"
              className="h-8 w-full rounded border border-border bg-bg-base px-2.5 text-xs"
            />
          </FormField>
          <FormField label="Provider Type" required>
            <select
              value={intProvider}
              onChange={(e) => setIntProvider(e.target.value)}
              className="h-8 w-full rounded border border-border bg-bg-base px-2 text-xs"
            >
              <option value="WEBHOOK">Webhook</option>
              <option value="EMAIL">Email Service</option>
              <option value="SMS">SMS Provider</option>
              <option value="SLACK">Slack</option>
              <option value="TEAMS">Microsoft Teams</option>
              <option value="GOOGLE_SHEETS">Google Sheets</option>
              <option value="CRM">External CRM</option>
              <option value="HTTP_API">HTTP API</option>
            </select>
          </FormField>
          <FormField label="Endpoint URL">
            <input
              type="text"
              value={intEndpoint}
              onChange={(e) => setIntEndpoint(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="h-8 w-full rounded border border-border bg-bg-base px-2.5 text-xs font-mono"
            />
          </FormField>
          <FormField label="Server-Side API Key / Secret" required>
            <input
              type="password"
              required
              value={intSecret}
              onChange={(e) => setIntSecret(e.target.value)}
              placeholder="Enter secret token (stored encrypted server-side)"
              className="h-8 w-full rounded border border-border bg-bg-base px-2.5 text-xs font-mono"
            />
          </FormField>
          <label className="flex items-center gap-2 text-xs text-text-secondary pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={intEmployeeApproved}
              onChange={(e) => setIntEmployeeApproved(e.target.checked)}
            />
            <span>Approve for Employee-built workflows</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIntegrationModalOpen(false)}
              className="h-8 rounded border border-border px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded bg-brand px-4 text-xs font-semibold text-white"
            >
              Save Credential
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
