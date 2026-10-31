# MASTER PROJECT SPECIFICATION — BILLORA

## Unified Subscription, Billing & Revenue Intelligence Platform
**Project Name:** Billora
**Tagline:** Every Subscription. One Intelligent Platform.
**Category:** SaaS / FinTech / Business Automation

---

## 1. Project Vision
Billora is a production-oriented, modern, and scalable subscription management platform designed to help subscription-based businesses manage their entire business lifecycle through one centralized application:
- Subscription tracking
- Product and plan management
- Customer management
- Subscription renewals
- Recurring invoice generation
- Tax calculations
- Discount management
- Payment tracking
- Revenue reporting

Three distinct role-scoped experiences:
1. **Administrator Dashboard** (`ADMIN`)
2. **Employee Operations Dashboard** (`EMPLOYEE`)
3. **Customer Self-Service Portal** (`CUSTOMER`)

Every button, form, filter, action, chart, and workflow must be connected to actual application logic and persistent database operations.

---

## 2. Technology Stack
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Lucide React icons, Recharts
- **Backend:** Node.js, Next.js Route Handlers (layered: Route Handler/Controller -> Service -> Repository), REST API, TypeScript, Zod validation
- **Database:** PostgreSQL + Prisma ORM (all currency fields `Decimal(14, 2)`, never floating-point)
- **Authentication:** Secure session-based authentication (`httpOnly`, `sameSite` cookies), RBAC (`ADMIN`, `EMPLOYEE`, `CUSTOMER`), Argon2/Bcrypt password hashing, email verification, password reset with expiring single-use tokens, rate limiting, CSRF protection
- **Background Processing:** Redis + BullMQ repeatable & per-subscription jobs
- **Additional Services:** Resend (email), Razorpay (orders + HMAC signature + idempotent webhooks), PDF generation for invoices

---

## 3. Core Modules & Business Rules
1. **Roles & Permissions:** Strict server-side RBAC guards; Customer queries always scoped by authenticated `customerId`; only `ADMIN` can create employees; public registration only creates `CUSTOMER` accounts.
2. **Authentication:** Unique email, password > 8 chars with uppercase, lowercase, and special char, account status verification, forgot/reset password flow.
3. **Product & Variant Management:** Configurable product types; `Final Unit Price = Base Sales Price + Variant Additional Price`; historical pricing snapshots stored on quotation, subscription, and invoice lines.
4. **Subscription Plan Management:** Daily, Weekly, Monthly, Yearly frequencies; month-end clamping (`Jan 31 -> Feb 28/29`), leap year handling, timezone-aware (`UTC` storage, business timezone billing); configurable `allowPause`, `allowEarlyCancel`, `allowRenewal`, `autoCloseDays`.
5. **Quotation Management:** Reusable templates + customer quotations (`DRAFT`, `QUOTATION`, `CONFIRMED`, `EXPIRED`, `CANCELLED`); 1-click conversion from `CONFIRMED` quotation to subscription.
6. **Subscription Management Engine:** Explicit state machine (`DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> PAUSED / CANCELLED / EXPIRED -> CLOSED`); operations (`Activate`, `Pause`, `Resume`, `Renew`, `Cancel`, `Close`, `Expire`) enforce plan flags and write immutable `SubscriptionHistory` & `AuditLog` entries.
7. **Automated Recurring Billing Engine:** BullMQ repeatable scheduler enqueues per-subscription billing jobs; single DB transaction with `SELECT ... FOR UPDATE SKIP LOCKED`, `@@unique([subscriptionId, billingPeriodStart, billingPeriodEnd])`, and deterministic `idempotencyKey`.
8. **Tax & Discount Management:** Configurable tax rules snapshotted onto lines; fixed & percentage discounts with atomic usage-count increments inside transactions to prevent race conditions.
9. **Invoice & Payment Management:** `DRAFT`, `CONFIRMED`, `PAID`, `CANCELLED` invoices; server-computed totals; partial and full payments; Razorpay order creation, signature verification, and idempotent webhook event processing (`WebhookEvent` table).
10. **Customer Self-Service Portal:** Top-nav layout with Overview, My Subscriptions, Available Plans, My Invoices, Payment History, Notifications, Account Settings.
11. **Notifications:** Email (Resend) + in-app notifications with delivery logs and retry deduplication.
12. **Financial Analytics, Forecasting & AI Assistant:** SQL-aggregated KPIs (clearly distinguishing **Invoiced**, **Recognized**, and **Cash Collected** revenue), 6 Recharts visualizations, CSV/Excel/PDF export, revenue forecasting with explicit assumptions, and read-only RBAC-scoped AI Business Assistant.
13. **20 Mandatory Automated Test Scenarios:** Comprehensive integration & E2E verification across Phases 1–9.
