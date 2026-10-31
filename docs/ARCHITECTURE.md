# System Architecture — Billora

## 1. Layered Backend Architecture
Every server operation flows through three decoupled layers:
1. **Controller Layer (`src/app/api/**/route.ts`)**: Handles HTTP parsing, session authentication (`withAuth`), role authorization (`requireRole`), CSRF protection, rate limiting, and Zod schema validation.
2. **Service Layer (`src/server/services/*.ts`)**: Pure domain logic:
   - `auth.service.ts` — Registration (`CUSTOMER` only), login, session management, email verification, password reset tokens.
   - `catalog.service.ts` — Products, product variants (`Base + Variant Delta`), tax rules, subscription plans.
   - `quotation.service.ts` — Reusable templates, server-side quotation pricing preview, lifecycle transitions, 1-click conversion to subscription.
   - `subscription.service.ts` — Explicit state machine (`DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> PAUSED / CANCELLED / EXPIRED -> CLOSED`) with plan rule enforcement and mandatory `SubscriptionHistory` + `AuditLog` entries.
   - `billing-engine.service.ts` — Idempotent recurring billing processor with BullMQ integration and transactional locking.
   - `discount.service.ts` — Fixed/percentage discount validation and atomic usage counter increments.
   - `payment.service.ts` — Manual payments, partial/full settlement, refunds, Razorpay order creation, HMAC SHA-256 verification, and idempotent webhook processing.
   - `analytics.service.ts` & `forecasting.service.ts` — SQL-aggregated KPIs separating **Invoiced**, **Recognized**, and **Cash Collected** revenue.
   - `ai-assistant.service.ts` — Read-only RBAC-scoped financial query assistant with explicit period and data-source provenance.
3. **Repository Layer (`src/server/repositories/*.ts`)**: Encapsulates Prisma ORM queries, pagination, sorting, and customer tenant scoping.

## 2. Subscription Lifecycle State Machine
Allowed transitions enforced in `SubscriptionService`:
- `DRAFT` $\rightarrow$ `QUOTATION`, `CONFIRMED`, `CANCELLED`
- `QUOTATION` $\rightarrow$ `CONFIRMED`, `CANCELLED`
- `CONFIRMED` $\rightarrow$ `ACTIVE`, `CANCELLED`
- `ACTIVE` $\rightarrow$ `PAUSED` (if `plan.allowPause`), `CANCELLED` (if `plan.allowEarlyCancel` or Admin), `EXPIRED`, `CLOSED`
- `PAUSED` $\rightarrow$ `ACTIVE` (`RESUME`), `CANCELLED`, `CLOSED`
- `EXPIRED` $\rightarrow$ `ACTIVE` (`RENEW` if `plan.allowRenewal`), `CLOSED`
- `CANCELLED` $\rightarrow$ `CLOSED`
