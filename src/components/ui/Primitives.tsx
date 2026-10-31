"use client";

import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Info,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import React, { createContext, useCallback, useContext, useState } from "react";

/* -------------------------------------------------------------------------- */
/* 1. MoneyDisplay — Tabular JetBrains Mono INR formatting                    */
/* -------------------------------------------------------------------------- */
export interface MoneyDisplayProps {
  amount: number | string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  colored?: boolean;
}

export function MoneyDisplay({
  amount,
  size = "md",
  className,
  colored = false,
}: MoneyDisplayProps) {
  const num = Number(amount ?? 0);
  const formatted = formatINR(num);

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg font-semibold",
    xl: "text-2xl font-bold tracking-tight",
  }[size];

  const colorClasses = colored
    ? num > 0
      ? "text-semantic-success"
      : num < 0
      ? "text-semantic-danger"
      : "text-text-primary"
    : "";

  return (
    <span className={cn("font-mono tabular-nums", sizeClasses, colorClasses, className)}>
      {formatted}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. StatusBadge — Semantic Lifecycle Badge                                  */
/* -------------------------------------------------------------------------- */
export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || "DRAFT").toUpperCase();

  let badgeStyle = "bg-bg-subtle text-text-secondary border-border";
  let dotStyle = "bg-text-muted";

  if (["ACTIVE", "PAID", "VERIFIED", "CONFIRMED", "COMPLETED", "DELIVERED"].includes(normalized)) {
    badgeStyle = "bg-semantic-success-subtle text-semantic-success border-semantic-success/25";
    dotStyle = "bg-semantic-success";
  } else if (["PAUSED", "QUOTATION", "PENDING", "RUNNING", "PARTIAL_FAILURE"].includes(normalized)) {
    badgeStyle = "bg-semantic-warning-subtle text-semantic-warning border-semantic-warning/25";
    dotStyle = "bg-semantic-warning";
  } else if (
    ["CANCELLED", "EXPIRED", "FAILED", "OVERDUE", "SUSPENDED", "HIGH"].includes(normalized)
  ) {
    badgeStyle = "bg-semantic-danger-subtle text-semantic-danger border-semantic-danger/25";
    dotStyle = "bg-semantic-danger";
  } else if (["REFUNDED", "CLOSED", "INACTIVE", "ARCHIVED"].includes(normalized)) {
    badgeStyle = "bg-semantic-info-subtle text-semantic-info border-semantic-info/25";
    dotStyle = "bg-semantic-info";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border font-mono tracking-tight",
        badgeStyle,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotStyle)} />
      {normalized}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Skeleton — Geometry-matching loading placeholder                        */
/* -------------------------------------------------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-bg-raised/70", className)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 4. StatCard — Executive Financial Metric Card                              */
/* -------------------------------------------------------------------------- */
export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  formulaTag?: string;
  icon?: React.ReactNode;
  trend?: { label: string; tone: "positive" | "negative" | "neutral" };
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  formulaTag,
  icon,
  trend,
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-bg-base p-5 shadow-xs", className)}>
        <Skeleton className="h-3.5 w-28 mb-3" />
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-3 w-44" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-bg-base p-5 shadow-xs transition-colors duration-150 hover:border-border-strong",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {formulaTag && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-bg-subtle text-text-secondary border border-border">
              {formulaTag}
            </span>
          )}
          {icon && <span className="text-text-muted">{icon}</span>}
        </div>
      </div>

      <div className="text-2xl font-bold tracking-tight text-text-primary font-mono tabular-nums">
        {value}
      </div>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          {subtitle && <span className="text-text-muted truncate">{subtitle}</span>}
          {trend && (
            <span
              className={cn(
                "font-mono font-medium",
                trend.tone === "positive"
                  ? "text-semantic-success"
                  : trend.tone === "negative"
                  ? "text-semantic-danger"
                  : "text-text-secondary"
              )}
            >
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. EmptyState                                                              */
/* -------------------------------------------------------------------------- */
export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-bg-base/60 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-bg-subtle text-text-secondary border border-border">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-text-muted leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. PageHeader                                                              */
/* -------------------------------------------------------------------------- */
export interface PageHeaderProps {
  category?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  category,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-5 mb-6 border-b border-border",
        className
      )}
    >
      <div>
        {category && (
          <div className="text-[11px] font-mono uppercase tracking-widest text-brand font-semibold mb-1">
            {category}
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs sm:text-sm text-text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. FormField                                                               */
/* -------------------------------------------------------------------------- */
export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-text-secondary tracking-tight"
      >
        {label}
        {required && <span className="ml-0.5 text-semantic-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-semantic-danger font-medium" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. ConfirmDialog / ModalDialog                                             */
/* -------------------------------------------------------------------------- */
export interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function ModalDialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
}: ModalDialogProps) {
  if (!open) return null;

  const widthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "w-full rounded-lg border border-border bg-bg-base shadow-xl overflow-hidden",
          widthClass
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1 text-text-muted hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 9. DateRangePicker (7 Presets + Custom Range)                              */
/* -------------------------------------------------------------------------- */
export interface DateRangePickerProps {
  preset: string;
  onPresetChange: (preset: string) => void;
  startDate?: string;
  endDate?: string;
  onCustomChange?: (start: string, end: string) => void;
}

const DATE_PRESETS = [
  { value: "TODAY", label: "Today" },
  { value: "LAST_7_DAYS", label: "Last 7d" },
  { value: "LAST_30_DAYS", label: "Last 30d" },
  { value: "CURRENT_MONTH", label: "This Month" },
  { value: "PREVIOUS_MONTH", label: "Last Month" },
  { value: "CURRENT_YEAR", label: "Current Year" },
  { value: "CUSTOM", label: "Custom" },
];

export function DateRangePicker({
  preset,
  onPresetChange,
  startDate,
  endDate,
  onCustomChange,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-lg border border-border bg-bg-base p-1 shadow-xs">
        <Calendar className="h-3.5 w-3.5 text-text-muted ml-2 mr-1.5" />
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPresetChange(p.value)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              preset === p.value
                ? "bg-brand text-brand-text shadow-xs"
                : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "CUSTOM" && onCustomChange && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={startDate || ""}
            onChange={(e) => onCustomChange(e.target.value, endDate || "")}
            className="h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <span className="text-xs text-text-muted">to</span>
          <input
            type="date"
            value={endDate || ""}
            onChange={(e) => onCustomChange(startDate || "", e.target.value)}
            className="h-8 rounded-md border border-border bg-bg-base px-2.5 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 10. Toast Notification System                                              */
/* -------------------------------------------------------------------------- */
interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => undefined,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((prev) => [...prev, { ...item, id }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-lg bg-bg-base",
              t.variant === "success"
                ? "border-semantic-success/40"
                : t.variant === "error"
                ? "border-semantic-danger/40"
                : "border-border"
            )}
          >
            {t.variant === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-semantic-success shrink-0 mt-0.5" />
            ) : t.variant === "error" ? (
              <AlertTriangle className="h-4 w-4 text-semantic-danger shrink-0 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 text-brand shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-text-primary">{t.title}</div>
              {t.description && (
                <div className="mt-0.5 text-xs text-text-muted break-words">{t.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* -------------------------------------------------------------------------- */
/* 11. DataTable — Server-Paginated, Searchable, Sortable Financial Table     */
/* -------------------------------------------------------------------------- */
export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filterSlot?: React.ReactNode;
  page?: number;
  totalPages?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  searchPlaceholder = "Filter records...",
  searchValue,
  onSearchChange,
  filterSlot,
  page = 1,
  totalPages = 1,
  totalRecords,
  onPageChange,
  emptyTitle = "No records found",
  emptyDescription = "Adjust your search or filters, or create a new record to get started.",
  emptyAction,
  onRowClick,
}: DataTableProps<T>) {
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colMenuOpen, setColMenuOpen] = useState(false);

  const visibleColumns = columns.filter((c) => !hiddenCols.has(c.key));

  return (
    <div className="rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden">
      {(onSearchChange || filterSlot) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border px-4 py-3 bg-bg-subtle/40">
          <div className="flex flex-1 items-center gap-2">
            {onSearchChange && (
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <input
                  type="search"
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-border bg-bg-base pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
            )}
            {filterSlot}
          </div>

          <div className="relative flex items-center gap-2">
            {totalRecords !== undefined && (
              <span className="text-xs font-mono text-text-muted">
                {totalRecords.toLocaleString("en-IN")} total
              </span>
            )}
            <button
              type="button"
              onClick={() => setColMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-bg-base text-xs font-medium text-text-secondary hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Columns
            </button>
            {colMenuOpen && (
              <div className="absolute right-0 top-9 z-30 w-44 rounded-lg border border-border bg-bg-base p-2 shadow-lg">
                {columns.map((col) => {
                  const checked = !hiddenCols.has(col.key);
                  return (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-2 py-1 text-xs text-text-secondary hover:bg-bg-subtle rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setHiddenCols((prev) => {
                            const next = new Set(prev);
                            if (next.has(col.key)) next.delete(col.key);
                            else if (visibleColumns.length > 1) next.add(col.key);
                            return next;
                          });
                        }}
                      />
                      {col.header}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bg-subtle/60">
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted select-none",
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx}>
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="p-6">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "transition-colors duration-150 hover:bg-bg-subtle/60",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-text-primary align-middle",
                        col.mono && "font-mono tabular-nums",
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-bg-subtle/30 text-xs">
          <span className="font-mono text-text-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle disabled:opacity-40 disabled:pointer-events-none"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* 12. Card, Button, Modal & Select Primitives                                */
/* -------------------------------------------------------------------------- */
export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-bg-base shadow-xs overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-border",
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary: "bg-brand text-brand-text hover:bg-brand-hover border-transparent",
    secondary: "bg-bg-subtle text-text-primary hover:bg-bg-raised border-border",
    danger:
      "bg-semantic-danger-subtle text-semantic-danger hover:bg-semantic-danger/20 border-semantic-danger/30",
    ghost: "bg-transparent text-text-secondary hover:bg-bg-subtle border-transparent",
  }[variant];

  const sizeStyles = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-xs",
    lg: "h-10 px-5 text-sm",
  }[size];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:pointer-events-none",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const Modal = ModalDialog;

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-text-secondary tracking-tight">
          {label}
        </label>
      )}
      <select
        className={cn(
          "h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
