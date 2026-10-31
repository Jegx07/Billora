# Billora — Centralized Supabase Database, Auth, RLS & Storage Integration Guide

## 1. Existing Project Analysis (Phase 1)
- **Frontend Framework**: Next.js 15.1.7 (App Router), React 19, TypeScript, Tailwind CSS, Recharts, Lucide Icons.
- **Backend Framework**: Next.js Route Handlers (`src/app/api/**/route.ts`) backed by modular domain services (`src/server/services/*.ts`), BullMQ/Redis recurring billing jobs (`src/server/jobs/recurringBilling.job.ts`), and Zod schema validators (`src/server/validators/schemas.ts`).
- **Existing Database**: Prisma 6 ORM (`prisma/schema.prisma`) with centralized persistence in `prisma/dev.db` (54 users, 50 customers, 3 employees, 2,000 subscriptions, 800 invoices, 720 verified payments).
- **Existing Authentication**: HTTP-only cookie + Bearer session tokens (`billora_session`) using RFC 7914 `scrypt` password hashing and database-backed role lookups (`ADMIN`, `EMPLOYEE`, `CUSTOMER`), now unified with Supabase Auth (`sb-access-token` / Bearer JWT verification and `auth.users` identity synchronization).
- **Data Storage Audit**: Zero modules rely on browser `localStorage`, `sessionStorage`, or hardcoded mock arrays for persistence; every module reads and writes through the centralized database.

---

## 2. Supabase Project Configuration & Environment Variables (Phase 2)
Update `.env` (refer to [`.env.example`](../.env.example)) with your Supabase project credentials:

```env
# Centralized PostgreSQL Connection (Supabase Transaction/Session Pooler)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# Public Client Keys
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
# Or newer publishable key format:
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="sb_publishable_..."

# Server-Only Privileged Key (NEVER exposed to browser)
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

- [`src/lib/supabase/config.ts`](../src/lib/supabase/config.ts) validates credentials at runtime, supports both `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, and throws a `SECURITY_VIOLATION` error if `getSupabaseServiceRoleKey()` is ever called in browser code.

---

## 3. Centralized PostgreSQL Schema & Row Level Security (Phases 3 & 5)
The complete normalized PostgreSQL schema and Row Level Security policies are defined in:
- [`supabase/migrations/20261031000001_billora_centralized_schema_and_rls.sql`](../supabase/migrations/20261031000001_billora_centralized_schema_and_rls.sql)

### Normalized Tables (36 Tables Protected by RLS)
1. **Authentication & Users**: `roles`, `profiles` (linked 1:1 to `auth.users`), `user_roles`, `employees`, `employee_profiles`, `employee_assignments`, `customers`, `customer_profiles`, `customer_addresses`, `customer_contacts`
2. **Product & Plan Catalog**: `product_categories`, `products`, `product_variants`, `subscription_plans`, `plan_products`
3. **Tax & Discounts**: `tax_rules`, `discounts`, `discount_products`, `discount_usage`
4. **Quotations**: `quotation_templates`, `quotation_template_lines`, `quotations`, `quotation_lines`
5. **Subscriptions & Billing Periods**: `subscriptions`, `subscription_lines`, `subscription_history`, `billing_periods`
6. **Invoices & Payments**: `invoices`, `invoice_lines`, `payments`, `payment_transactions`, `refunds`
7. **Notifications & System**: `notifications`, `notification_preferences`, `audit_logs`, `system_settings`

### Non-Recursive `SECURITY DEFINER` RBAC Functions
All role-lookup functions use `SECURITY DEFINER SET search_path = public` to prevent infinite policy recursion and search-path injection:
- `public.get_current_user_role()`
- `public.is_admin()`
- `public.is_employee()`
- `public.get_current_customer_id()`
- `public.get_current_employee_id()`
- `public.can_employee_access_customer(target_customer_id UUID)`
- `public.prevent_role_self_escalation()` trigger on `profiles` and `user_roles`

---

## 4. Private Supabase Storage Buckets (Phase 10)
Configured in both SQL migration and [`src/server/services/storage.service.ts`](../src/server/services/storage.service.ts):
- `invoice-documents` (PDF invoices, max 10 MB, private)
- `customer-documents` (GST certificates, contracts, KYC docs, max 10 MB, private)
- `profile-images` (avatars, max 5 MB, private)
- Signed URLs are generated server-side via `POST /api/storage/signed-url` ([`src/app/api/storage/signed-url/route.ts`](../src/app/api/storage/signed-url/route.ts)) after RBAC & tenant ownership verification.

---

## 5. Repeatable Migration & Security Verification Commands (Phases 9 & 11)
```bash
# 1. Apply the PostgreSQL schema & RLS migration to your Supabase project
supabase db push

# 2. Export backup snapshot, verify financial totals, and sync existing data
npm run db:migrate:supabase

# 3. Run the 8-part RBAC, RLS, Storage, and Service-Key security verification suite
npm run verify:supabase
```
