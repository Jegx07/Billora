# Design System — Billora

## Stack
- framework: Next.js 15 (App Router) + React 19 + TypeScript
- styling: Tailwind CSS 3.4 with semantic CSS custom property tokens (`next-shadcn` preset)
- components: Custom production B2B fintech primitives (`src/components/ui/*`, `src/components/layout/*`)
- animation: Purposeful 150ms micro-transitions with `prefers-reduced-motion` guard
- icons: Lucide React (`lucide-react`)
- charts: Recharts (`recharts`)

## Tokens
- brand: `#4F46E5` (Indigo 600 — Financial Authority & Precision)
- bg-sidebar: `#0B1220` (Deep Navy Charcoal)
- bg-canvas: `#F7F8FA` (Light Neutral Workspace) / `#090D16` (Dark Mode Canvas)
- bg-base: `#FFFFFF` (Light Card Surface) / `#111827` (Dark Card Surface)
- text-primary: `#111827` / `#F9FAFB`
- text-secondary: `#374151` / `#D1D5DB`
- text-muted: `#6B7280` / `#9CA3AF`
- border: `rgba(15, 23, 42, 0.08)` / `rgba(255, 255, 255, 0.08)`
- radius: `8px` (`--radius-md`)
- shadow: layered (`0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)`)
- fonts: `Inter` (`--font-sans`) + `JetBrains Mono` (`--font-mono`, `tabular-nums`)
(full token map in `src/app/globals.css`)

## Anti-Slop Design Principles
- Zero decorative gradients, zero fake sparklines, zero placeholder metrics, zero emoji clutter.
- High-density financial typography: all currency amounts (`₹`), percentages, dates, and entity IDs (`SUB-2026-*`, `INV-2026-*`, `QT-2026-*`) use `font-mono tabular-nums`.
- Crisp `1px` structural hairlines (`border-border`), explicit interactive states (`hover`, `active`, `focus-visible`, `disabled`), skeleton loaders matching exact component geometry, and actionable empty states.

## Decisions
- 2026-10-31 — init: `next-shadcn` preset initialized for **Billora** ("Every Subscription. One Intelligent Platform.").
- 2026-10-31 — theme: Applied Stripe/Linear/Vercel B2B fintech token system (`#0B1220` sidebar, `#F7F8FA` canvas, `#4F46E5` brand accent, full `.dark` mode support).

## Components
- `src/components/ui/MoneyDisplay.tsx` — Formatted INR currency (`₹`) in tabular JetBrains Mono
- `src/components/ui/StatusBadge.tsx` — Semantic status pill for Quotations, Subscriptions, Invoices, Payments, Plans
- `src/components/ui/StatCard.tsx` — Executive KPI metric card with formula label, subtitle, and skeleton state
- `src/components/ui/EmptyState.tsx` — Structured empty state with icon, heading, description, and primary CTA
- `src/components/ui/Skeleton.tsx` — Geometry-accurate pulse skeleton loader
- `src/components/ui/ConfirmDialog.tsx` — Accessible confirmation dialog for state transitions and destructive actions
- `src/components/ui/FormField.tsx` — Accessible form control wrapper with label, hint, and inline Zod error display
- `src/components/ui/PageHeader.tsx` — Consistent workspace page header with breadcrumb, title, subtitle, and actions
- `src/components/ui/DateRangePicker.tsx` — 7-preset financial period selector + custom date range inputs
- `src/components/ui/Toast.tsx` — Non-intrusive notification toast provider and hook
- `src/components/ui/DataTable.tsx` — Server-paginated, sortable, searchable, column-configurable financial table
- `src/components/layout/Sidebar.tsx` — Role-aware collapsible `#0B1220` sidebar (`ADMIN` vs `EMPLOYEE`)
- `src/components/layout/Topbar.tsx` — Workspace topbar with `Cmd+K` global command palette, theme toggle, notification drawer, and quick role switcher
- `src/components/layout/AppShell.tsx` — Responsive workspace shell (desktop sidebar, tablet rail, mobile drawer)
- `src/components/layout/PortalShell.tsx` — Clean top-navigation shell for the Customer Self-Service Portal

## Non-Goals
- No decorative or un-wired UI elements
- No client-side financial arithmetic
