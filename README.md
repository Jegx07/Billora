# Billora

**Unified Subscription, Billing & Revenue Intelligence Platform**  
*Every Subscription. One Intelligent Platform.*

---

## Overview

**Billora** is a production-grade SaaS & FinTech platform that unifies recurring subscription management, product & variant catalogs, multi-frequency billing plans, quotation workflows, idempotent recurring invoicing, GST tax calculations, atomic discount redemptions, Razorpay payment verification, and deterministic revenue intelligence across three role-based experiences:

1. **Administrator Console (`/dashboard`)** — Full catalog, employee, plan, tax, discount, subscription, billing run, payment, forecasting, Google Gemini AI assistant, and audit log control.
2. **Employee Operations Workspace (`/dashboard`)** — Quotation authoring & conversion, customer onboarding, subscription lifecycle management, and invoice follow-up.
3. **Customer Self-Service Portal (`/portal`)** — 7-tab customer portal for viewing active subscriptions, subscribing to available plans, downloading compliant GST PDF tax invoices, and paying online via Razorpay.

---

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Next.js Route Handlers (`Controller -> Service -> Repository` layered architecture), Zod validation, HTTP-Only Session RBAC
- **AI Intelligence**: Google Gemini API (`gemini-3.5-flash`), live database grounding, zero-hallucination read-only financial query engine
- **Financial Precision**: `decimal.js` (`ROUND_HALF_UP`, 2 decimal places in INR) + calendar-accurate date clamping (`date-fns`)
- **Database & Queue**: Prisma ORM (SQLite local zero-config / PostgreSQL 16 + Redis 7 via `docker-compose.yml`), BullMQ repeatable billing workers

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Push database schema & seed 2,000-subscription scale dataset
npx prisma db push
npm run seed:dev

# 3. Configure Google Gemini API key in .env
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-3.5-flash"

# 4. Run the 20 mandatory specification integration tests
npm test

# 5. Start the development server
npm run dev
```

---

## Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin@billora.in` | `Admin@12345` |
| **Employee** | `arjun.mehta@billora.in` | `Employee@12345` |
| **Customer** | `ananya@kinetixcloud.in` | `Customer@12345` |

---

## Documentation

- [Product Specification (`docs/SPEC.md`)](./docs/SPEC.md)
- [System Architecture (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
- [API Reference (`docs/API.md`)](./docs/API.md)
- [Architecture Decisions (`docs/DECISIONS.md`)](./docs/DECISIONS.md)
- [UI Design System (`DESIGN.md`)](./DESIGN.md)
