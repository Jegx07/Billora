# Architecture Decision Records (ADRs) — Billora

## ADR-001: Next.js App Router Route Handlers with Strict 3-Layer Backend Architecture
- **Context:** The specification allows choosing between NestJS or Next.js server-side API architecture (`Routes/Controllers -> Services -> Repositories`).
- **Decision:** Use Next.js App Router Route Handlers (`src/app/api/**/route.ts`) with strict enforcement of the 3-layer backend pattern (`Controller -> Service -> Repository`).
- **Justification:**
  1. Shared TypeScript and Zod validation contracts across API controllers, domain services, BullMQ workers, and React UI components without DTO drift.
  2. Zero business logic is permitted in Route Handlers or React components; all state transitions, pricing snapshots, and financial calculations live in `src/server/services/*` so they can be directly invoked by both HTTP controllers, BullMQ background workers, and Vitest integration tests.

## ADR-002: Exact Decimal Arithmetic via `decimal.js` & Database `Decimal`
- **Context:** Floating-point arithmetic (`0.1 + 0.2 !== 0.3`) causes rounding errors in multi-line invoices, percentage discounts, and GST calculations.
- **Decision:** Every monetary calculation uses `decimal.js` configured with `ROUND_HALF_UP` to 2 decimal places (`src/lib/money.ts`). All database monetary columns use Prisma `Decimal`.

## ADR-003: Timezone-Aware Billing Dates with Anchor-Day Month-End Clamping
- **Context:** Naive `date + 30 days` arithmetic causes billing date drift across 28/29/30/31-day months and leap years.
- **Decision:** Subscriptions store `anchorBillingDay` (`1..31`) and `timezone` (default `Asia/Kolkata`). Monthly/yearly renewals preserve `anchorBillingDay` and clamp to the last valid calendar day of the target month (`Jan 31 -> Feb 28/29 -> Mar 31`; `Feb 29, 2024 -> Feb 28, 2025`).

## ADR-004: Multi-Layer Duplicate Billing Prevention
- **Context:** Concurrent or retried recurring billing jobs must never generate duplicate invoices for the same subscription and billing period.
- **Decision:** Enforce three independent layers of idempotency:
  1. Deterministic `idempotencyKey = bill_${subscriptionId}_${periodStartISO}_${periodEndISO}`.
  2. Database composite unique constraint `@@unique([subscriptionId, billingPeriodStart, billingPeriodEnd])` on both `BillingPeriod` and `Invoice`.
  3. Transactional row-level check/lock inside `prisma.$transaction` that verifies `nextBillingDate` and existing `BillingPeriod` before inserting the invoice and advancing `nextBillingDate`.
