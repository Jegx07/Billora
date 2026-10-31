"use client";

import {
  PlanCardImage,
  PlanFrequencyIllustration,
} from "@/components/plans/PlanIllustrations";
import {
  DataTable,
  FormField,
  ModalDialog,
  MoneyDisplay,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  Info,
  Layers,
  LayoutGrid,
  List,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Data Interfaces                                                            */
/* -------------------------------------------------------------------------- */
interface PlanProductRelation {
  id: string;
  productId: string;
  defaultQuantity: number;
  includedInBase: boolean;
  product: {
    id: string;
    productCode: string;
    name: string;
    salesPrice?: number;
    variants?: { id: string; name: string; sku: string }[];
  };
}

interface PlanRow {
  id: string;
  planCode: string;
  name: string;
  description: string | null;
  basePrice: number;
  billingFrequency: string; // DAILY, WEEKLY, MONTHLY, YEARLY
  minQuantity: number;
  allowEarlyCancel: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  defaultTermMonths: number;
  autoCloseDays: number | null;
  availableFrom: string | null;
  availableUntil: string | null;
  status: string; // ACTIVE, INACTIVE, ARCHIVED
  imageUrl?: string | null;
  planProducts?: PlanProductRelation[];
  _count?: { subscriptions: number };
  createdAt: string;
  updatedAt: string;
}

interface ProductOption {
  id: string;
  productCode: string;
  name: string;
  salesPrice: number;
}

type ViewMode = "grid" | "table";
type FrequencyFilter = "ALL" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type SortOption =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "contracts-desc"
  | "newest";

export default function PlansPage() {
  const { toast } = useToast();

  // Core Data State
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);

  // Display & Filter Controls State
  const [viewMode, setViewMode] = useState<ViewMode>("grid"); // Grid View by default
  const [searchQuery, setSearchQuery] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [page, setPage] = useState(1);
  const pageSize = viewMode === "grid" ? 8 : 10;

  // Drawer & Modal State
  const [selectedPlan, setSelectedPlan] = useState<PlanRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<PlanRow | null>(null);
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<PlanRow | null>(null);
  const [statusTogglePlan, setStatusTogglePlan] = useState<PlanRow | null>(null);
  const [activeMenuPlanId, setActiveMenuPlanId] = useState<string | null>(null);

  // Form State (Used for Create & Edit)
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBasePrice, setFormBasePrice] = useState("1000");
  const [formBillingFrequency, setFormBillingFrequency] = useState("MONTHLY");
  const [formMinQuantity, setFormMinQuantity] = useState("1");
  const [formDefaultTermMonths, setFormDefaultTermMonths] = useState("12");
  const [formAutoCloseDays, setFormAutoCloseDays] = useState("");
  const [formAllowPause, setFormAllowPause] = useState(true);
  const [formAllowEarlyCancel, setFormAllowEarlyCancel] = useState(true);
  const [formAllowRenewal, setFormAllowRenewal] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Plans from Backend API
  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plans");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPlans(json.data);
      } else {
        setError(json.error?.message || "Failed to load subscription plans");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading subscription plans");
    } finally {
      setLoading(false);
    }
  };

  // Load Available Products for Linking
  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products?status=ACTIVE");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAvailableProducts(json.data);
      }
    } catch {}
  };

  useEffect(() => {
    loadPlans();
    loadProducts();
  }, []);

  // Sync selected plan data if plans list refreshed
  useEffect(() => {
    if (selectedPlan) {
      const refreshed = plans.find((p) => p.id === selectedPlan.id);
      if (refreshed) setSelectedPlan(refreshed);
    }
  }, [plans]);

  // Close card menus on outside click
  useEffect(() => {
    const handleWindowClick = () => setActiveMenuPlanId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  // Filter & Search Logic
  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      // Frequency filter
      if (frequencyFilter !== "ALL" && plan.billingFrequency !== frequencyFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && plan.status !== statusFilter) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = plan.name.toLowerCase().includes(query);
        const matchesCode = plan.planCode.toLowerCase().includes(query);
        const matchesDesc = plan.description?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesCode && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [plans, frequencyFilter, statusFilter, searchQuery]);

  // Sorting Logic
  const sortedPlans = useMemo(() => {
    const list = [...filteredPlans];
    switch (sortBy) {
      case "name-asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "price-asc":
        return list.sort((a, b) => a.basePrice - b.basePrice);
      case "price-desc":
        return list.sort((a, b) => b.basePrice - a.basePrice);
      case "contracts-desc":
        return list.sort(
          (a, b) => (b._count?.subscriptions ?? 0) - (a._count?.subscriptions ?? 0)
        );
      case "newest":
        return list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      default:
        return list;
    }
  }, [filteredPlans, sortBy]);

  // Pagination Logic
  const totalRecords = sortedPlans.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedPlans = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedPlans.slice(start, start + pageSize);
  }, [sortedPlans, currentPage, pageSize]);

  // Reset page when search or filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, frequencyFilter, statusFilter, sortBy, viewMode]);

  // Reset all search and filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setFrequencyFilter("ALL");
    setStatusFilter("ALL");
    setSortBy("name-asc");
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" || frequencyFilter !== "ALL" || statusFilter !== "ALL";

  // Pre-fill form for Create
  const handleOpenCreate = () => {
    setFormName("");
    setFormDescription("");
    setFormBasePrice("1000");
    setFormBillingFrequency("MONTHLY");
    setFormMinQuantity("1");
    setFormDefaultTermMonths("12");
    setFormAutoCloseDays("");
    setFormAllowPause(true);
    setFormAllowEarlyCancel(true);
    setFormAllowRenewal(true);
    setFormImageUrl("");
    setFormProductIds([]);
    setCreateOpen(true);
  };

  // Pre-fill form for Edit
  const handleOpenEdit = (plan: PlanRow) => {
    setEditPlan(plan);
    setFormName(plan.name);
    setFormDescription(plan.description || "");
    setFormBasePrice(plan.basePrice.toString());
    setFormBillingFrequency(plan.billingFrequency);
    setFormMinQuantity(plan.minQuantity.toString());
    setFormDefaultTermMonths((plan.defaultTermMonths || 12).toString());
    setFormAutoCloseDays(plan.autoCloseDays ? plan.autoCloseDays.toString() : "");
    setFormAllowPause(plan.allowPause);
    setFormAllowEarlyCancel(plan.allowEarlyCancel);
    setFormAllowRenewal(plan.allowRenewal);
    setFormImageUrl(plan.imageUrl || "");
    setFormProductIds(plan.planProducts?.map((pp) => pp.productId) || []);
  };

  // Handle Image File Upload to /api/plans/upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/plans/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        setFormImageUrl(json.data.url);
        toast({
          title: "Image Uploaded",
          description: "Plan illustration image updated successfully.",
          variant: "success",
        });
      } else {
        toast({
          title: "Upload Failed",
          description: json.error?.message || "Failed to upload image file.",
          variant: "error",
        });
      }
    } catch (err: any) {
      toast({
        title: "Upload Error",
        description: err?.message || "An error occurred while uploading image.",
        variant: "error",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Create Plan Submission
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        basePrice: Number(formBasePrice),
        billingFrequency: formBillingFrequency,
        minQuantity: Number(formMinQuantity),
        defaultTermMonths: Number(formDefaultTermMonths),
        autoCloseDays: formAutoCloseDays ? Number(formAutoCloseDays) : undefined,
        allowPause: formAllowPause,
        allowEarlyCancel: formAllowEarlyCancel,
        allowRenewal: formAllowRenewal,
        imageUrl: formImageUrl.trim() || undefined,
        productIds: formProductIds.length ? formProductIds : undefined,
      };

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        toast({
          title: "Plan Creation Failed",
          description: json.error?.message || "Could not create subscription plan.",
          variant: "error",
        });
        return;
      }

      toast({
        title: "Subscription Plan Created",
        description: `${json.data.planCode} (${json.data.name}) is now available in your catalog.`,
        variant: "success",
      });

      setCreateOpen(false);
      loadPlans();
    } catch (err: any) {
      toast({
        title: "Submission Error",
        description: err?.message || "Network error submitting plan.",
        variant: "error",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Edit Plan Submission
  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPlan) return;
    setFormSubmitting(true);

    try {
      const payload = {
        id: editPlan.id,
        name: formName.trim(),
        description: formDescription.trim() || null,
        basePrice: Number(formBasePrice),
        billingFrequency: formBillingFrequency,
        minQuantity: Number(formMinQuantity),
        defaultTermMonths: Number(formDefaultTermMonths),
        autoCloseDays: formAutoCloseDays ? Number(formAutoCloseDays) : null,
        allowPause: formAllowPause,
        allowEarlyCancel: formAllowEarlyCancel,
        allowRenewal: formAllowRenewal,
        imageUrl: formImageUrl.trim() || null,
      };

      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        toast({
          title: "Plan Update Failed",
          description: json.error?.message || "Could not update subscription plan.",
          variant: "error",
        });
        return;
      }

      toast({
        title: "Subscription Plan Updated",
        description: `${editPlan.planCode} has been successfully updated.`,
        variant: "success",
      });

      setEditPlan(null);
      loadPlans();
    } catch (err: any) {
      toast({
        title: "Update Error",
        description: err?.message || "Network error updating plan.",
        variant: "error",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Status Toggle (Activate / Deactivate)
  const handleToggleStatus = async (plan: PlanRow) => {
    const nextStatus = plan.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, status: nextStatus }),
      });
      const json = await res.json();

      if (!json.success) {
        toast({
          title: "Status Update Failed",
          description: json.error?.message || "Could not change plan status.",
          variant: "error",
        });
        return;
      }

      toast({
        title: nextStatus === "ACTIVE" ? "Plan Activated" : "Plan Deactivated",
        description: `${plan.planCode} status is now ${nextStatus}.`,
        variant: "success",
      });

      setStatusTogglePlan(null);
      loadPlans();
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err?.message || "Network error updating plan status.",
        variant: "error",
      });
    }
  };

  // Handle Plan Deletion (Enforcing Backend Dependency Integrity)
  const handleDeletePlan = async () => {
    if (!deleteConfirmPlan) return;
    try {
      const res = await fetch(`/api/plans?id=${encodeURIComponent(deleteConfirmPlan.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.success) {
        toast({
          title: "Cannot Delete Plan",
          description:
            json.error?.message ||
            "This plan has active contracts or history and cannot be deleted. Deactivate it instead.",
          variant: "error",
        });
        setDeleteConfirmPlan(null);
        return;
      }

      toast({
        title: "Plan Deleted",
        description: `${deleteConfirmPlan.planCode} has been permanently deleted.`,
        variant: "success",
      });

      if (selectedPlan?.id === deleteConfirmPlan.id) {
        setSelectedPlan(null);
      }
      setDeleteConfirmPlan(null);
      loadPlans();
    } catch (err: any) {
      toast({
        title: "Deletion Error",
        description: err?.message || "Network error deleting plan.",
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. Header (Preserving Exact Heading & Description)                     */}
      {/* ---------------------------------------------------------------------- */}
      <PageHeader
        category="SUBSCRIPTION ARCHITECTURE"
        title="Subscription Plans & Lifecycle Rules"
        description="Configure Daily, Weekly, Monthly, and Yearly billing frequencies with month-end clamping, leap-year safety, and lifecycle permissions."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadPlans}
              disabled={loading}
              title="Refresh plans list"
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-brand-text shadow-xs hover:bg-brand-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Plan
            </button>
          </div>
        }
      />

      {/* ---------------------------------------------------------------------- */}
      {/* 2. Professional Control Toolbar (Search, Filters, Sort, View Toggle)   */}
      {/* ---------------------------------------------------------------------- */}
      <div className="rounded-lg border border-border bg-bg-base p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by plan name, code (e.g. PLN-MON-101), or description..."
              className="h-9 w-full rounded-md border border-border bg-bg-base pl-9 pr-8 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right: View Toggles & Summary Count */}
          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
            <span className="text-xs font-mono text-text-muted">
              {totalRecords} {totalRecords === 1 ? "plan" : "plans"} found
            </span>

            {/* View Mode Toggle Pill (Grid vs Table) */}
            <div className="inline-flex items-center rounded-lg border border-border bg-bg-subtle/60 p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  viewMode === "grid"
                    ? "bg-brand text-brand-text shadow-xs"
                    : "text-text-secondary hover:bg-bg-base hover:text-text-primary"
                )}
                aria-pressed={viewMode === "grid"}
                title="Switch to Grid View (Default)"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  viewMode === "table"
                    ? "bg-brand text-brand-text shadow-xs"
                    : "text-text-secondary hover:bg-bg-base hover:text-text-primary"
                )}
                aria-pressed={viewMode === "table"}
                title="Switch to Table View"
              >
                <List className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter & Sort Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
          {/* Frequency Filter Chips */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono uppercase text-text-muted mr-1">
              Cadence:
            </span>
            {(["ALL", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as FrequencyFilter[]).map(
              (freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequencyFilter(freq)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors border",
                    frequencyFilter === freq
                      ? "bg-brand/10 border-brand/40 text-brand font-semibold"
                      : "bg-bg-base border-border text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                  )}
                >
                  {freq}
                </button>
              )
            )}
          </div>

          <div className="hidden sm:block h-4 w-px bg-border mx-1" />

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono uppercase text-text-muted mr-1">
              Status:
            </span>
            {(["ALL", "ACTIVE", "INACTIVE"] as StatusFilter[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors border",
                  statusFilter === st
                    ? "bg-brand/10 border-brand/40 text-brand font-semibold"
                    : "bg-bg-base border-border text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                )}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="h-3 w-3 text-text-muted" />
            <span className="text-[11px] font-mono uppercase text-text-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-7 rounded border border-border bg-bg-base px-2 text-xs font-medium text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
            >
              <option value="name-asc">Plan Name (A → Z)</option>
              <option value="name-desc">Plan Name (Z → A)</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="contracts-desc">Active Contracts (High → Low)</option>
              <option value="newest">Newest First</option>
            </select>
          </div>

          {/* Clear Filters Button if any active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline font-medium px-2 py-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. Main Content: Grid View (Default) or Table View                     */}
      {/* ---------------------------------------------------------------------- */}
      {loading ? (
        // Loading Skeleton
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-bg-base overflow-hidden shadow-xs p-0 flex flex-col h-[380px]"
              >
                <Skeleton className="w-full h-40" />
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="pt-3 border-t border-border space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-bg-base p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )
      ) : error ? (
        // Error State
        <div className="rounded-lg border border-semantic-danger/30 bg-semantic-danger-subtle p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-semantic-danger mx-auto" />
          <h3 className="text-sm font-semibold text-text-primary">
            Failed to Load Subscription Plans
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={loadPlans}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-brand-text hover:bg-brand-hover"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      ) : paginatedPlans.length === 0 ? (
        // Empty State
        <div className="rounded-lg border border-dashed border-border-strong bg-bg-base/70 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">
            {hasActiveFilters ? "No matching subscription plans" : "No subscription plans yet"}
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? "No plans match your current search and filter criteria. Try clearing your filters to see all available plans."
              : "Define Daily, Weekly, Monthly, and Yearly subscription plans with flexible billing frequencies and lifecycle permissions."}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-3 text-xs font-medium text-text-secondary hover:bg-bg-subtle"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-brand-text hover:bg-brand-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                Create First Plan
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        // --------------------------------------------------------------------
        // GRID VIEW (Default Display Mode)
        // Responsive: 4 on xl, 3 on lg, 2 on sm, 1 on mobile
        // --------------------------------------------------------------------
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {paginatedPlans.map((plan) => {
            const isMenuOpen = activeMenuPlanId === plan.id;
            const cadenceLabel = {
              DAILY: "day",
              WEEKLY: "week",
              MONTHLY: "month",
              YEARLY: "year",
            }[plan.billingFrequency] || "cycle";

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className="group relative flex flex-col justify-between rounded-lg border border-border bg-bg-base shadow-xs hover:shadow-md hover:border-brand/40 transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* 1. Card Top Illustration / Image */}
                <PlanCardImage
                  imageUrl={plan.imageUrl}
                  billingFrequency={plan.billingFrequency}
                  planName={plan.name}
                  badge={
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={plan.billingFrequency} />
                    </div>
                  }
                />

                {/* 2. Card Content Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {/* Header Row: Plan Code & Status Badge & Actions */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                        {plan.planCode}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={plan.status} />

                        {/* Card Context Menu Trigger */}
                        <div
                          className="relative"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuPlanId(isMenuOpen ? null : plan.id)
                            }
                            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-subtle focus-visible:outline-none"
                            title="Plan actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-6 z-30 w-44 rounded-lg border border-border bg-bg-base p-1.5 shadow-lg text-xs animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuPlanId(null);
                                  setSelectedPlan(plan);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View Details
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuPlanId(null);
                                  handleOpenEdit(plan);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit Plan
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuPlanId(null);
                                  setStatusTogglePlan(plan);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                              >
                                <Power className="h-3.5 w-3.5" />
                                {plan.status === "ACTIVE" ? "Deactivate" : "Activate"}
                              </button>
                              <div className="my-1 border-t border-border" />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuPlanId(null);
                                  setDeleteConfirmPlan(plan);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-semantic-danger hover:bg-semantic-danger-subtle"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Plan
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Plan Name */}
                    <h3 className="text-sm font-semibold text-text-primary line-clamp-1 group-hover:text-brand transition-colors">
                      {plan.name}
                    </h3>

                    {/* Plan Description */}
                    <p className="mt-1 text-xs text-text-muted line-clamp-2 min-h-[32px] leading-relaxed">
                      {plan.description || "No description provided for this plan."}
                    </p>
                  </div>

                  {/* Pricing & Minimum Quantity */}
                  <div className="pt-2 border-t border-border/70 flex items-baseline justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                        Base Price
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <MoneyDisplay amount={plan.basePrice} size="lg" />
                        <span className="text-xs text-text-muted">/ {cadenceLabel}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                        Min Qty
                      </div>
                      <div className="font-mono text-xs font-semibold text-text-primary mt-0.5">
                        {plan.minQuantity} {plan.minQuantity === 1 ? "unit" : "units"}
                      </div>
                    </div>
                  </div>

                  {/* Active Contracts & Term */}
                  <div className="flex items-center justify-between text-xs font-mono py-1.5 px-2.5 rounded bg-bg-subtle/50 border border-border/50">
                    <span className="inline-flex items-center gap-1.5 text-text-secondary">
                      <Users className="h-3.5 w-3.5 text-brand" />
                      <span>{(plan._count?.subscriptions ?? 0).toLocaleString("en-IN")}</span>
                      <span className="text-[11px] text-text-muted font-sans">
                        active contracts
                      </span>
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {plan.defaultTermMonths}m term
                    </span>
                  </div>

                  {/* Lifecycle Permissions Badges */}
                  <div className="pt-2 border-t border-border/70 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                      Lifecycle Rules
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                          plan.allowPause
                            ? "bg-semantic-success-subtle text-semantic-success border border-semantic-success/20"
                            : "bg-bg-subtle text-text-muted line-through"
                        )}
                        title={plan.allowPause ? "Self-service Pause Allowed" : "Pause Disallowed"}
                      >
                        {plan.allowPause ? <Check className="h-2.5 w-2.5" /> : null}
                        Pause
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                          plan.allowEarlyCancel
                            ? "bg-semantic-success-subtle text-semantic-success border border-semantic-success/20"
                            : "bg-bg-subtle text-text-muted line-through"
                        )}
                        title={
                          plan.allowEarlyCancel
                            ? "Early Cancellation Permitted"
                            : "Early Cancellation Blocked"
                        }
                      >
                        {plan.allowEarlyCancel ? <Check className="h-2.5 w-2.5" /> : null}
                        EarlyCancel
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                          plan.allowRenewal
                            ? "bg-semantic-success-subtle text-semantic-success border border-semantic-success/20"
                            : "bg-bg-subtle text-text-muted line-through"
                        )}
                        title={plan.allowRenewal ? "Auto/Manual Renewals Enabled" : "Renewals Disabled"}
                      >
                        {plan.allowRenewal ? <Check className="h-2.5 w-2.5" /> : null}
                        Renew
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Card Footer Action Bar */}
                <div
                  className="px-4 py-2.5 border-t border-border bg-bg-subtle/30 flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                  >
                    <Eye className="h-3 w-3" />
                    View Details
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(plan)}
                      className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-subtle"
                      title="Edit plan configuration"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusTogglePlan(plan)}
                      className={cn(
                        "p-1 rounded hover:bg-bg-subtle",
                        plan.status === "ACTIVE"
                          ? "text-semantic-success hover:text-semantic-danger"
                          : "text-text-muted hover:text-semantic-success"
                      )}
                      title={plan.status === "ACTIVE" ? "Deactivate plan" : "Activate plan"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // --------------------------------------------------------------------
        // TABLE VIEW (Alternative List Mode with exact preserved structure)
        // --------------------------------------------------------------------
        <div className="space-y-4">
          <DataTable
            columns={[
              {
                key: "code",
                header: "Plan Code",
                mono: true,
                render: (r: PlanRow) => (
                  <span className="font-semibold text-brand font-mono">
                    {r.planCode}
                  </span>
                ),
              },
              {
                key: "name",
                header: "Plan Name",
                render: (r: PlanRow) => (
                  <div className="flex items-center gap-3">
                    {/* Small thumbnail in table */}
                    <div className="h-8 w-12 rounded border border-border overflow-hidden bg-bg-subtle shrink-0 hidden sm:block">
                      {r.imageUrl ? (
                        <img
                          src={r.imageUrl}
                          alt={r.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PlanFrequencyIllustration
                          frequency={r.billingFrequency}
                          className="h-full w-full"
                        />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary hover:text-brand transition-colors">
                        {r.name}
                      </div>
                      {r.description && (
                        <div className="text-[11px] text-text-muted line-clamp-1 max-w-xs">
                          {r.description}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "freq",
                header: "Frequency",
                render: (r: PlanRow) => <StatusBadge status={r.billingFrequency} />,
              },
              {
                key: "price",
                header: "Base Price",
                align: "right",
                render: (r: PlanRow) => <MoneyDisplay amount={r.basePrice} />,
              },
              {
                key: "minQty",
                header: "Min Qty",
                align: "center",
                mono: true,
                render: (r: PlanRow) => r.minQuantity,
              },
              {
                key: "rules",
                header: "Lifecycle Permissions",
                render: (r: PlanRow) => (
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span
                      className={
                        r.allowPause
                          ? "text-semantic-success"
                          : "text-text-muted line-through"
                      }
                    >
                      Pause
                    </span>
                    <span>•</span>
                    <span
                      className={
                        r.allowEarlyCancel
                          ? "text-semantic-success"
                          : "text-text-muted line-through"
                      }
                    >
                      EarlyCancel
                    </span>
                    <span>•</span>
                    <span
                      className={
                        r.allowRenewal
                          ? "text-semantic-success"
                          : "text-text-muted line-through"
                      }
                    >
                      Renew
                    </span>
                  </div>
                ),
              },
              {
                key: "subs",
                header: "Active Contracts",
                align: "right",
                mono: true,
                render: (r: PlanRow) => (
                  <span className="font-semibold">
                    {(r._count?.subscriptions ?? 0).toLocaleString("en-IN")}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r: PlanRow) => <StatusBadge status={r.status} />,
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r: PlanRow) => (
                  <div
                    className="flex items-center justify-end gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPlan(r)}
                      className="p-1 rounded text-text-secondary hover:text-brand hover:bg-bg-subtle"
                      title="View full plan details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(r)}
                      className="p-1 rounded text-text-secondary hover:text-brand hover:bg-bg-subtle"
                      title="Edit plan"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusTogglePlan(r)}
                      className="p-1 rounded text-text-secondary hover:text-brand hover:bg-bg-subtle"
                      title={r.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmPlan(r)}
                      className="p-1 rounded text-semantic-danger hover:bg-semantic-danger-subtle"
                      title="Delete plan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ),
              },
            ]}
            data={paginatedPlans}
            rowKey={(r) => r.id}
            loading={loading}
            onRowClick={(r) => setSelectedPlan(r)}
          />
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4. Unified Pagination Controls                                         */}
      {/* ---------------------------------------------------------------------- */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4 text-xs">
          <span className="font-mono text-text-muted">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} plans
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle disabled:opacity-40 disabled:pointer-events-none"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "h-8 w-8 rounded-md border text-xs font-mono font-medium transition-colors",
                      currentPage === pageNum
                        ? "bg-brand text-brand-text border-brand"
                        : "border-border bg-bg-base text-text-secondary hover:bg-bg-subtle"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle disabled:opacity-40 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 5. Complete Plan Details Slide-Over Drawer                             */}
      {/* ---------------------------------------------------------------------- */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop click to close */}
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setSelectedPlan(null)}
          />

          {/* Drawer Container */}
          <div className="w-full max-w-xl bg-bg-base border-l border-border shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header Banner */}
            <div className="relative border-b border-border bg-bg-subtle">
              <div className="h-44 w-full overflow-hidden flex items-center justify-center">
                {selectedPlan.imageUrl ? (
                  <img
                    src={selectedPlan.imageUrl}
                    alt={selectedPlan.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PlanFrequencyIllustration
                    frequency={selectedPlan.billingFrequency}
                    className="w-full h-full"
                  />
                )}
              </div>

              {/* Close Button Top Right */}
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                aria-label="Close details"
                className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand z-10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Plan Title & Identity Overlay */}
              <div className="p-5 bg-bg-base border-b border-border">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-2.5 py-0.5 rounded border border-brand/20">
                      {selectedPlan.planCode}
                    </span>
                    <StatusBadge status={selectedPlan.billingFrequency} />
                  </div>
                  <StatusBadge status={selectedPlan.status} />
                </div>
                <h2 className="text-xl font-bold text-text-primary tracking-tight">
                  {selectedPlan.name}
                </h2>
                {selectedPlan.description && (
                  <p className="mt-1 text-xs text-text-muted leading-relaxed">
                    {selectedPlan.description}
                  </p>
                )}
              </div>
            </div>

            {/* Drawer Body — Structured Details */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Financial & Contract Overview */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">
                  Financial Terms
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-bg-subtle/50 p-3">
                    <div className="text-[11px] text-text-muted">Base Price</div>
                    <div className="mt-1">
                      <MoneyDisplay amount={selectedPlan.basePrice} size="lg" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-subtle/50 p-3">
                    <div className="text-[11px] text-text-muted">Cadence</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-text-primary">
                      {selectedPlan.billingFrequency}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-subtle/50 p-3">
                    <div className="text-[11px] text-text-muted">Min Quantity</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-text-primary">
                      {selectedPlan.minQuantity} unit(s)
                    </div>
                  </div>
                </div>
              </div>

              {/* Contract & Term Parameters */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">
                  Term & Commitment
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-bg-subtle/50 p-3">
                    <div className="text-[11px] text-text-muted">Default Term</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-text-primary">
                      {selectedPlan.defaultTermMonths} Months
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-subtle/50 p-3">
                    <div className="text-[11px] text-text-muted">Active Contracts</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-semantic-success">
                      {(selectedPlan._count?.subscriptions ?? 0).toLocaleString("en-IN")}{" "}
                      active
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription Lifecycle Permissions & Rules */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">
                  Subscription Lifecycle Rules
                </h4>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-base p-3">
                    <div
                      className={cn(
                        "mt-0.5 rounded-full p-1 shrink-0",
                        selectedPlan.allowPause
                          ? "bg-semantic-success-subtle text-semantic-success"
                          : "bg-semantic-danger-subtle text-semantic-danger"
                      )}
                    >
                      {selectedPlan.allowPause ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-text-primary">
                        Self-Service Pause & Resume
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-muted leading-relaxed">
                        {selectedPlan.allowPause
                          ? "Customers and administrators may pause subscriptions. Billing clock halts during pause periods."
                          : "Subscriptions under this plan cannot be paused; ongoing billing runs continuously."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-base p-3">
                    <div
                      className={cn(
                        "mt-0.5 rounded-full p-1 shrink-0",
                        selectedPlan.allowEarlyCancel
                          ? "bg-semantic-success-subtle text-semantic-success"
                          : "bg-semantic-danger-subtle text-semantic-danger"
                      )}
                    >
                      {selectedPlan.allowEarlyCancel ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-text-primary">
                        Customer Early Cancellation
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-muted leading-relaxed">
                        {selectedPlan.allowEarlyCancel
                          ? "Customers may terminate subscription before full contract term completes."
                          : "Early cancellation restricted. Term must complete unless overridden by an Administrator."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-base p-3">
                    <div
                      className={cn(
                        "mt-0.5 rounded-full p-1 shrink-0",
                        selectedPlan.allowRenewal
                          ? "bg-semantic-success-subtle text-semantic-success"
                          : "bg-semantic-danger-subtle text-semantic-danger"
                      )}
                    >
                      {selectedPlan.allowRenewal ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-text-primary">
                        Automated & Manual Renewal
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-muted leading-relaxed">
                        {selectedPlan.allowRenewal
                          ? "Supports automated rollover renewals at term expiration with preserved contract pricing."
                          : "Automatic renewal disabled. Contract will expire automatically at the end of the term."}
                      </p>
                    </div>
                  </div>

                  {/* Cadence Clamping Rule Banner */}
                  <div className="rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-text-primary">
                        {selectedPlan.billingFrequency} Cadence Architecture
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                        {selectedPlan.billingFrequency === "DAILY" &&
                          "Daily intervals execute recurring cron cycles every 24 hours with midnight rollover clamping."}
                        {selectedPlan.billingFrequency === "WEEKLY" &&
                          "Weekly sprint cycles execute on fixed 7-day intervals with automated contract rollover."}
                        {selectedPlan.billingFrequency === "MONTHLY" &&
                          "Protected with month-end date clamping (Jan 31 → Feb 28/29 → Mar 31) and leap-year safety."}
                        {selectedPlan.billingFrequency === "YEARLY" &&
                          "Annual contracts clamp across 365 calendar days with leap-year continuity guarantees."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked Products */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">
                  Linked Products & Catalog Inclusions
                </h4>
                {selectedPlan.planProducts && selectedPlan.planProducts.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPlan.planProducts.map((pp) => (
                      <div
                        key={pp.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-bg-subtle/50 px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Package className="h-4 w-4 text-brand" />
                          <div>
                            <span className="font-semibold text-text-primary">
                              {pp.product.name}
                            </span>
                            <span className="ml-2 font-mono text-[11px] text-text-muted">
                              ({pp.product.productCode})
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-semantic-success bg-semantic-success-subtle px-2 py-0.5 rounded border border-semantic-success/20">
                          Included in Base
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
                    No dedicated catalog products attached to this base plan.
                  </div>
                )}
              </div>

              {/* Audit & Metadata History */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">
                  System History & Audit
                </h4>
                <div className="rounded-lg border border-border bg-bg-subtle/40 p-3 space-y-2 text-xs font-mono text-text-muted">
                  <div className="flex justify-between">
                    <span>Plan ID:</span>
                    <span className="text-text-primary">{selectedPlan.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created At:</span>
                    <span className="text-text-primary">
                      {new Date(selectedPlan.createdAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Updated:</span>
                    <span className="text-text-primary">
                      {new Date(selectedPlan.updatedAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-border bg-bg-base flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPlan(selectedPlan)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-semantic-danger/30 text-semantic-danger text-xs hover:bg-semantic-danger-subtle transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatusTogglePlan(selectedPlan)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs text-text-secondary hover:bg-bg-subtle transition-colors"
                >
                  <Power className="h-3.5 w-3.5" />
                  {selectedPlan.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedPlan)}
                  className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-brand text-xs font-semibold text-brand-text hover:bg-brand-hover transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 6. Create Plan Modal Dialog                                            */}
      {/* ---------------------------------------------------------------------- */}
      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Subscription Plan"
        description="Define billing frequency, minimum quantity, term length, and self-service lifecycle permissions."
        maxWidth="xl"
      >
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <FormField label="Plan Name" required>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Enterprise Annual Commitment"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Frequency" required>
              <select
                value={formBillingFrequency}
                onChange={(e) => setFormBillingFrequency(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
              </select>
            </FormField>

            <FormField label="Base Price (INR)" required>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formBasePrice}
                onChange={(e) => setFormBasePrice(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </FormField>

            <FormField label="Min Quantity" required>
              <input
                type="number"
                min="1"
                required
                value={formMinQuantity}
                onChange={(e) => setFormMinQuantity(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </FormField>

            <FormField label="Term (Months)" required>
              <input
                type="number"
                min="1"
                required
                value={formDefaultTermMonths}
                onChange={(e) => setFormDefaultTermMonths(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </FormField>
          </div>

          <FormField label="Description">
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="e.g., Flexible recurring billing with month-end clamping and self-service pause"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          {/* Plan Illustration or Image Upload Section */}
          <div className="rounded-lg border border-border bg-bg-subtle/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-text-primary">
                  Plan Illustration / Custom Image
                </span>
                <p className="text-[11px] text-text-muted">
                  Upload an image or let Billora generate a responsive cadence illustration.
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border bg-bg-base text-xs font-medium text-text-secondary hover:bg-bg-subtle disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {uploadingImage ? "Uploading..." : "Upload Image"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative h-16 w-28 rounded border border-border overflow-hidden bg-bg-base shrink-0">
                {formImageUrl ? (
                  <img
                    src={formImageUrl}
                    alt="Plan Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PlanFrequencyIllustration
                    frequency={formBillingFrequency}
                    className="h-full w-full"
                  />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="Or enter direct image URL (https://...)"
                  className="h-8 w-full rounded border border-border bg-bg-base px-2.5 text-xs text-text-primary placeholder:text-text-muted"
                />
                {formImageUrl && (
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("")}
                    className="text-[11px] text-semantic-danger hover:underline"
                  >
                    Remove custom image (revert to cadence SVG)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lifecycle Permissions Checkboxes */}
          <div className="rounded-lg border border-border bg-bg-subtle/60 p-3.5 space-y-2.5 text-xs">
            <div className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
              Plan Lifecycle Permissions
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formAllowPause}
                onChange={(e) => setFormAllowPause(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand"
              />
              <span className="font-medium text-text-primary">
                Allow subscription pause & resume
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formAllowEarlyCancel}
                onChange={(e) => setFormAllowEarlyCancel(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand"
              />
              <span className="font-medium text-text-primary">
                Allow customer early cancellation
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formAllowRenewal}
                onChange={(e) => setFormAllowRenewal(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand"
              />
              <span className="font-medium text-text-primary">
                Allow automated & manual renewals
              </span>
            </label>
          </div>

          {/* Linked Products Multiselect */}
          {availableProducts.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary">
                Attach Catalog Products (Optional)
              </label>
              <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-bg-base p-2 space-y-1">
                {availableProducts.map((prod) => {
                  const checked = formProductIds.includes(prod.id);
                  return (
                    <label
                      key={prod.id}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-bg-subtle text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormProductIds((prev) => [...prev, prod.id]);
                            } else {
                              setFormProductIds((prev) =>
                                prev.filter((id) => id !== prod.id)
                              );
                            }
                          }}
                        />
                        <span className="text-text-primary">{prod.name}</span>
                        <span className="font-mono text-[10px] text-text-muted">
                          ({prod.productCode})
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary hover:bg-bg-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-4 text-xs font-semibold text-brand-text hover:bg-brand-hover disabled:opacity-50"
            >
              {formSubmitting ? "Creating..." : "Create Plan"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ---------------------------------------------------------------------- */}
      {/* 7. Edit Plan Modal Dialog                                              */}
      {/* ---------------------------------------------------------------------- */}
      <ModalDialog
        open={Boolean(editPlan)}
        onClose={() => setEditPlan(null)}
        title={`Edit Plan — ${editPlan?.planCode}`}
        description="Update pricing, cadence, rules, or custom visual illustration."
        maxWidth="xl"
      >
        <form onSubmit={handleUpdatePlan} className="space-y-4">
          <FormField label="Plan Name" required>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Frequency" required>
              <select
                value={formBillingFrequency}
                onChange={(e) => setFormBillingFrequency(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
              </select>
            </FormField>

            <FormField label="Base Price (INR)" required>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formBasePrice}
                onChange={(e) => setFormBasePrice(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </FormField>

            <FormField label="Min Quantity" required>
              <input
                type="number"
                min="1"
                required
                value={formMinQuantity}
                onChange={(e) => setFormMinQuantity(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </FormField>

            <FormField label="Term (Months)" required>
              <input
                type="number"
                min="1"
                required
                value={formDefaultTermMonths}
                onChange={(e) => setFormDefaultTermMonths(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </FormField>
          </div>

          <FormField label="Description">
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          {/* Plan Illustration Image Section */}
          <div className="rounded-lg border border-border bg-bg-subtle/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-text-primary">
                  Plan Illustration / Custom Image
                </span>
                <p className="text-[11px] text-text-muted">
                  Custom image or frequency cadence SVG.
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border bg-bg-base text-xs font-medium text-text-secondary hover:bg-bg-subtle disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {uploadingImage ? "Uploading..." : "Upload New Image"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative h-16 w-28 rounded border border-border overflow-hidden bg-bg-base shrink-0">
                {formImageUrl ? (
                  <img
                    src={formImageUrl}
                    alt="Plan Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PlanFrequencyIllustration
                    frequency={formBillingFrequency}
                    className="h-full w-full"
                  />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="Direct image URL (https://...)"
                  className="h-8 w-full rounded border border-border bg-bg-base px-2.5 text-xs text-text-primary placeholder:text-text-muted"
                />
                {formImageUrl && (
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("")}
                    className="text-[11px] text-semantic-danger hover:underline"
                  >
                    Revert to cadence SVG illustration
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lifecycle Permissions Checkboxes */}
          <div className="rounded-lg border border-border bg-bg-subtle/60 p-3.5 space-y-2.5 text-xs">
            <div className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
              Plan Lifecycle Permissions
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formAllowPause}
                onChange={(e) => setFormAllowPause(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand"
              />
              <span className="font-medium text-text-primary">
                Allow subscription pause & resume
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formAllowEarlyCancel}
                onChange={(e) => setFormAllowEarlyCancel(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand"
              />
              <span className="font-medium text-text-primary">
                Allow customer early cancellation
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formAllowRenewal}
                onChange={(e) => setFormAllowRenewal(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand"
              />
              <span className="font-medium text-text-primary">
                Allow automated & manual renewals
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setEditPlan(null)}
              className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary hover:bg-bg-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-4 text-xs font-semibold text-brand-text hover:bg-brand-hover disabled:opacity-50"
            >
              {formSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ---------------------------------------------------------------------- */}
      {/* 8. Activate / Deactivate Confirmation Dialog                           */}
      {/* ---------------------------------------------------------------------- */}
      {statusTogglePlan && (
        <ModalDialog
          open={Boolean(statusTogglePlan)}
          onClose={() => setStatusTogglePlan(null)}
          title={
            statusTogglePlan.status === "ACTIVE"
              ? `Deactivate Plan ${statusTogglePlan.planCode}?`
              : `Activate Plan ${statusTogglePlan.planCode}?`
          }
          description={
            statusTogglePlan.status === "ACTIVE"
              ? "Deactivating this plan will prevent new customers from selecting it. Existing active subscriptions will continue operating normally until their contract end date."
              : "Activating this plan makes it available for new quotations and customer self-service subscriptions."
          }
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-bg-subtle/50 p-3 text-xs space-y-1">
              <div className="font-semibold text-text-primary">
                {statusTogglePlan.name}
              </div>
              <div className="text-text-muted">
                Current Active Contracts:{" "}
                <span className="font-mono font-semibold text-text-primary">
                  {(statusTogglePlan._count?.subscriptions ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStatusTogglePlan(null)}
                className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary hover:bg-bg-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggleStatus(statusTogglePlan)}
                className={cn(
                  "h-8 rounded-md px-4 text-xs font-semibold text-white transition-colors",
                  statusTogglePlan.status === "ACTIVE"
                    ? "bg-semantic-warning hover:bg-semantic-warning/90 text-black"
                    : "bg-brand hover:bg-brand-hover"
                )}
              >
                {statusTogglePlan.status === "ACTIVE"
                  ? "Confirm Deactivation"
                  : "Confirm Activation"}
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 9. Delete Plan Confirmation Dialog                                     */}
      {/* ---------------------------------------------------------------------- */}
      {deleteConfirmPlan && (
        <ModalDialog
          open={Boolean(deleteConfirmPlan)}
          onClose={() => setDeleteConfirmPlan(null)}
          title={`Delete Subscription Plan ${deleteConfirmPlan.planCode}?`}
          description="Are you sure you want to delete this plan? In compliance with Billora financial safety rules, plans with active contracts or contract history cannot be deleted and must be deactivated instead."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-semantic-danger/30 bg-semantic-danger-subtle p-3.5 text-xs text-semantic-danger space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Financial Integrity Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Plan: <strong>{deleteConfirmPlan.name}</strong> ({deleteConfirmPlan.planCode})
                <br />
                Linked Active Contracts:{" "}
                <strong>{deleteConfirmPlan._count?.subscriptions ?? 0}</strong>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteConfirmPlan(null)}
                className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary hover:bg-bg-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
                className="inline-flex items-center gap-1.5 h-8 rounded-md bg-semantic-danger px-4 text-xs font-semibold text-white hover:bg-semantic-danger/90 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Plan
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
