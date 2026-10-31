-- ============================================================================
-- BILLORA — CENTRALIZED SUPABASE POSTGRESQL SCHEMA, AUTH, RLS, RPC & STORAGE
-- Migration: 20261031000001_billora_centralized_schema_and_rls.sql
--
-- Unified Subscription Management, Recurring Billing & Revenue Intelligence
-- Roles: ADMIN | EMPLOYEE | CUSTOMER
-- Currency: INR (NUMERIC(14,2) — strict zero floating-point drift)
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. AUTHENTICATION & USER IDENTITY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (name IN ('ADMIN', 'EMPLOYEE', 'CUSTOMER')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.roles (name, description)
VALUES
  ('ADMIN', 'Administrator with full platform governance access'),
  ('EMPLOYEE', 'Employee managing assigned customers, quotations, subscriptions, and billing'),
  ('CUSTOMER', 'Customer self-service portal access')
ON CONFLICT (name) DO NOTHING;

-- Connected 1:1 with Supabase Auth (auth.users.id)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY, -- References auth.users(id) ON DELETE CASCADE in Supabase
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED')),
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  role_name TEXT NOT NULL CHECK (role_name IN ('ADMIN', 'EMPLOYEE', 'CUSTOMER')),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ============================================================================
-- 2. EMPLOYEE & CUSTOMER MANAGEMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  region TEXT DEFAULT 'India',
  can_approve_discounts BOOLEAN NOT NULL DEFAULT false,
  max_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (max_discount_pct >= 0 AND max_discount_pct <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL UNIQUE,
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  gstin TEXT,
  billing_address TEXT,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  postal_code TEXT,
  assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  tax_exempt BOOLEAN NOT NULL DEFAULT false,
  preferred_payment_method TEXT DEFAULT 'UPI',
  auto_pay_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_type TEXT NOT NULL DEFAULT 'BILLING' CHECK (address_type IN ('BILLING', 'SHIPPING', 'REGISTERED')),
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  postal_code TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  designation TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (assignment_role IN ('PRIMARY', 'SECONDARY', 'RENEWAL_OWNER')),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, customer_id)
);

-- ============================================================================
-- 3. PRODUCT CATALOG, VARIANTS & SUBSCRIPTION PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'SAAS' CHECK (product_type IN ('SAAS', 'SERVICE', 'LICENSE', 'ADDON', 'HARDWARE')),
  sales_price NUMERIC(14,2) NOT NULL CHECK (sales_price >= 0),
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
  description TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  additional_price NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (additional_price >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, name)
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(14,2) NOT NULL CHECK (base_price >= 0),
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  auto_close_days INTEGER CHECK (auto_close_days IS NULL OR auto_close_days >= 1),
  allow_early_cancel BOOLEAN NOT NULL DEFAULT true,
  allow_pause BOOLEAN NOT NULL DEFAULT true,
  allow_renewal BOOLEAN NOT NULL DEFAULT true,
  default_term_months INTEGER NOT NULL DEFAULT 12 CHECK (default_term_months >= 1),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  default_quantity INTEGER NOT NULL DEFAULT 1 CHECK (default_quantity >= 1),
  included_in_base BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (plan_id, product_id)
);

-- ============================================================================
-- 4. TAX RULES & DISCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_type TEXT NOT NULL DEFAULT 'GST',
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  applicability TEXT NOT NULL DEFAULT 'ALL',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('FIXED', 'PERCENTAGE')),
  value NUMERIC(14,2) NOT NULL CHECK (value > 0),
  min_purchase_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (min_purchase_amount >= 0),
  min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  applicable_to_all BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  max_usage_count INTEGER CHECK (max_usage_count IS NULL OR max_usage_count >= 1),
  current_usage_count INTEGER NOT NULL DEFAULT 0 CHECK (current_usage_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discount_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  UNIQUE (discount_id, product_id)
);

-- ============================================================================
-- 5. QUOTATIONS & TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quotation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  validity_days INTEGER NOT NULL DEFAULT 15 CHECK (validity_days >= 1),
  tax_rule_id UUID REFERENCES public.tax_rules(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_template_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.quotation_templates(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1 CHECK (default_quantity >= 1)
);

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  template_id UUID REFERENCES public.quotation_templates(id) ON DELETE SET NULL,
  discount_id UUID REFERENCES public.discounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'QUOTATION', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
  issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date TIMESTAMPTZ NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  base_unit_price NUMERIC(14,2) NOT NULL,
  variant_price_delta NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  unit_price NUMERIC(14,2) NOT NULL,
  tax_rule_id UUID REFERENCES public.tax_rules(id) ON DELETE SET NULL,
  tax_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  line_subtotal NUMERIC(14,2) NOT NULL,
  line_discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  line_tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(14,2) NOT NULL
);

-- ============================================================================
-- 6. SUBSCRIPTIONS, HISTORY & BILLING PERIODS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  quotation_id UUID UNIQUE REFERENCES public.quotations(id) ON DELETE SET NULL,
  discount_id UUID REFERENCES public.discounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'CLOSED')),
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  payment_terms_days INTEGER NOT NULL DEFAULT 7 CHECK (payment_terms_days >= 0),
  start_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ,
  anchor_billing_day INTEGER NOT NULL DEFAULT 1 CHECK (anchor_billing_day BETWEEN 1 AND 31),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  next_billing_date TIMESTAMPTZ NOT NULL,
  paused_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  base_unit_price NUMERIC(14,2) NOT NULL,
  variant_price_delta NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  unit_price NUMERIC(14,2) NOT NULL,
  tax_rule_id UUID REFERENCES public.tax_rules(id) ON DELETE SET NULL,
  tax_name_snapshot TEXT,
  tax_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  line_subtotal NUMERIC(14,2) NOT NULL,
  line_discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  line_tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, billing_period_start, billing_period_end)
);

-- ============================================================================
-- 7. INVOICES, PAYMENTS, TRANSACTIONS & REFUNDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  billing_period_id UUID UNIQUE REFERENCES public.billing_periods(id) ON DELETE SET NULL,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  discount_id UUID REFERENCES public.discounts(id) ON DELETE SET NULL,
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED')),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
  outstanding_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (outstanding_amount >= 0),
  document_storage_path TEXT,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, billing_period_start, billing_period_end)
);

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  base_unit_price NUMERIC(14,2) NOT NULL,
  variant_price_delta NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  unit_price NUMERIC(14,2) NOT NULL,
  tax_rule_id UUID REFERENCES public.tax_rules(id) ON DELETE SET NULL,
  tax_name_snapshot TEXT,
  tax_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  line_subtotal NUMERIC(14,2) NOT NULL,
  line_discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  line_tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('UPI', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'RAZORPAY', 'OTHER')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  refunded_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (refunded_amount >= 0 AND refunded_amount <= amount),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  transaction_reference TEXT UNIQUE,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('PENDING', 'VERIFIED', 'FAILED', 'REFUNDED')),
  failure_reason TEXT,
  notes TEXT,
  recorded_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'RAZORPAY',
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  gateway_signature TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'AUTHORIZED', 'CAPTURED', 'VERIFIED', 'FAILED')),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number TEXT NOT NULL UNIQUE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
  processed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discount_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES public.discounts(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  discount_amount NUMERIC(14,2) NOT NULL CHECK (discount_amount >= 0),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. NOTIFICATIONS, AUDIT LOGS & SYSTEM SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'BOTH',
  delivery_status TEXT NOT NULL DEFAULT 'DELIVERED',
  error_message TEXT,
  idempotency_key TEXT UNIQUE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_invoices BOOLEAN NOT NULL DEFAULT true,
  email_payments BOOLEAN NOT NULL DEFAULT true,
  email_renewals BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES
  ('business_timezone', '"Asia/Kolkata"'::jsonb, 'Primary billing timezone (IST)'),
  ('currency', '"INR"'::jsonb, 'Ledger currency code'),
  ('invoice_prefix', '"INV-2026"'::jsonb, 'Sequential GST tax invoice prefix')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- 9. PERFORMANCE INDEXES (PHASE 10)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_emp ON public.customers(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_status ON public.subscriptions(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_next_billing ON public.subscriptions(status, next_billing_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status ON public.invoices(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due_date ON public.invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_payments_customer_date ON public.payments(customer_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_status ON public.payments(invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ============================================================================
-- 10. NON-RECURSIVE SECURITY DEFINER RBAC HELPER FUNCTIONS (PHASE 5)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ur.role_name
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.get_current_user_role() = 'ADMIN', false);
$$;

CREATE OR REPLACE FUNCTION public.is_employee()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.get_current_user_role() = 'EMPLOYEE', false);
$$;

CREATE OR REPLACE FUNCTION public.get_current_customer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id
  FROM public.customers c
  WHERE c.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_employee_access_customer(target_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin()
  OR (
    public.is_employee()
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      LEFT JOIN public.employee_assignments ea ON ea.customer_id = c.id
      WHERE c.id = target_customer_id
        AND (
          c.assigned_employee_id IS NULL
          OR c.assigned_employee_id = public.get_current_employee_id()
          OR ea.employee_id = public.get_current_employee_id()
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_employee() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_employee() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_current_customer_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_customer_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_current_employee_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_employee_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_employee_access_customer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_employee_access_customer(UUID) TO authenticated, service_role;

-- ============================================================================
-- 11. PRIVILEGE ESCALATION PREVENTION & SUPABASE AUTH SIGNUP TRIGGER (PHASE 4)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Allow service_role or ADMIN only to assign/modify ADMIN or EMPLOYEE roles
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'FORBIDDEN: Only administrators can modify role assignments';
  END IF;

  IF NEW.role_name <> 'CUSTOMER' THEN
    RAISE EXCEPTION 'FORBIDDEN: Public registration can only assign the CUSTOMER role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.user_roles;
CREATE TRIGGER trg_prevent_role_self_escalation
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) ON EVERY SENSITIVE TABLE (PHASE 5)
-- ============================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_template_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Roles: readable by authenticated users, writable only by ADMIN
CREATE POLICY roles_select_authenticated ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_admin_all ON public.roles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Profiles: users can view/update own profile; employees can view customer profiles; admins full access
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin() OR public.is_employee());
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_admin_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- User Roles: users can read own role; only ADMIN can insert/update/delete non-customer roles
CREATE POLICY user_roles_select_policy ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin() OR public.is_employee());
CREATE POLICY user_roles_admin_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Employees & Employee Profiles: ADMIN full access; EMPLOYEE can read own record; CUSTOMER denied
CREATE POLICY employees_select_policy ON public.employees
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY employees_admin_manage ON public.employees
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY employee_profiles_select_policy ON public.employee_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY employee_profiles_admin_manage ON public.employee_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY employee_assignments_select_policy ON public.employee_assignments
  FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.get_current_employee_id());
CREATE POLICY employee_assignments_admin_manage ON public.employee_assignments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Customers: ADMIN full; EMPLOYEE permitted customers; CUSTOMER strictly own customer row
CREATE POLICY customers_select_policy ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.can_employee_access_customer(id)
  );
CREATE POLICY customers_insert_staff ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_employee() OR user_id = auth.uid());
CREATE POLICY customers_update_policy ON public.customers
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.can_employee_access_customer(id)
  )
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.can_employee_access_customer(id)
  );

CREATE POLICY customer_profiles_isolation ON public.customer_profiles
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  )
  WITH CHECK (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
  );

CREATE POLICY customer_addresses_isolation ON public.customer_addresses
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  )
  WITH CHECK (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );

CREATE POLICY customer_contacts_isolation ON public.customer_contacts
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  )
  WITH CHECK (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );

-- Catalog (Products, Variants, Plans, Tax Rules, Discounts):
-- Readable by all authenticated users; writable ONLY by ADMIN
CREATE POLICY product_categories_read ON public.product_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY product_categories_admin_write ON public.product_categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY products_read ON public.products
  FOR SELECT TO authenticated USING (status = 'ACTIVE' OR public.is_admin() OR public.is_employee());
CREATE POLICY products_admin_write ON public.products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY product_variants_read ON public.product_variants
  FOR SELECT TO authenticated USING (status = 'ACTIVE' OR public.is_admin() OR public.is_employee());
CREATE POLICY product_variants_admin_write ON public.product_variants
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY subscription_plans_read ON public.subscription_plans
  FOR SELECT TO authenticated USING (status = 'ACTIVE' OR public.is_admin() OR public.is_employee());
CREATE POLICY subscription_plans_admin_write ON public.subscription_plans
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY plan_products_read ON public.plan_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_products_admin_write ON public.plan_products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY tax_rules_read ON public.tax_rules
  FOR SELECT TO authenticated USING (is_active = true OR public.is_admin() OR public.is_employee());
CREATE POLICY tax_rules_admin_write ON public.tax_rules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY discounts_read ON public.discounts
  FOR SELECT TO authenticated USING (is_active = true OR public.is_admin() OR public.is_employee());
CREATE POLICY discounts_admin_write ON public.discounts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY discount_products_read ON public.discount_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY discount_products_admin_write ON public.discount_products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY discount_usage_isolation ON public.discount_usage
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );

-- Quotations: ADMIN & permitted EMPLOYEE can manage; CUSTOMER can view own quotations
CREATE POLICY quotation_templates_read ON public.quotation_templates
  FOR SELECT TO authenticated USING (public.is_admin() OR public.is_employee());
CREATE POLICY quotation_templates_admin_write ON public.quotation_templates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY quotation_template_lines_read ON public.quotation_template_lines
  FOR SELECT TO authenticated USING (public.is_admin() OR public.is_employee());

CREATE POLICY quotations_select_isolation ON public.quotations
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );
CREATE POLICY quotations_staff_write ON public.quotations
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.can_employee_access_customer(customer_id))
  WITH CHECK (public.is_admin() OR public.can_employee_access_customer(customer_id));

CREATE POLICY quotation_lines_isolation ON public.quotation_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id
        AND (
          public.is_admin()
          OR q.customer_id = public.get_current_customer_id()
          OR public.can_employee_access_customer(q.customer_id)
        )
    )
  );

-- Subscriptions: strict tenant isolation for CUSTOMER; assigned access for EMPLOYEE; full for ADMIN
CREATE POLICY subscriptions_select_isolation ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );
CREATE POLICY subscriptions_insert_policy ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );
CREATE POLICY subscriptions_update_policy ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  )
  WITH CHECK (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );

CREATE POLICY subscription_lines_isolation ON public.subscription_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_id
        AND (
          public.is_admin()
          OR s.customer_id = public.get_current_customer_id()
          OR public.can_employee_access_customer(s.customer_id)
        )
    )
  );

CREATE POLICY subscription_history_isolation ON public.subscription_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_id
        AND (
          public.is_admin()
          OR s.customer_id = public.get_current_customer_id()
          OR public.can_employee_access_customer(s.customer_id)
        )
    )
  );

CREATE POLICY billing_periods_isolation ON public.billing_periods
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_employee());

-- Invoices & Invoice Lines: CUSTOMER strictly sees own invoices; EMPLOYEE sees permitted; ADMIN all
CREATE POLICY invoices_select_isolation ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );
CREATE POLICY invoices_staff_write ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.can_employee_access_customer(customer_id))
  WITH CHECK (public.is_admin() OR public.can_employee_access_customer(customer_id));

CREATE POLICY invoice_lines_isolation ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.is_admin()
          OR i.customer_id = public.get_current_customer_id()
          OR public.can_employee_access_customer(i.customer_id)
        )
    )
  );

-- Payments, Transactions & Refunds: CUSTOMER read-only on own payments (cannot self-verify payments!)
CREATE POLICY payments_select_isolation ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );
CREATE POLICY payments_staff_write ON public.payments
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.can_employee_access_customer(customer_id))
  WITH CHECK (public.is_admin() OR public.can_employee_access_customer(customer_id));

CREATE POLICY payment_transactions_select_isolation ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND (
          public.is_admin()
          OR p.customer_id = public.get_current_customer_id()
          OR public.can_employee_access_customer(p.customer_id)
        )
    )
  );

CREATE POLICY refunds_select_isolation ON public.refunds
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.get_current_customer_id()
    OR public.can_employee_access_customer(customer_id)
  );
CREATE POLICY refunds_staff_write ON public.refunds
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.can_employee_access_customer(customer_id))
  WITH CHECK (public.is_admin() OR public.can_employee_access_customer(customer_id));

-- Notifications & Preferences: strictly scoped to recipient user_id (or ADMIN)
CREATE POLICY notifications_isolation ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY notification_preferences_isolation ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Audit Logs & System Settings: ADMIN only
CREATE POLICY audit_logs_admin_only ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY audit_logs_insert_authenticated ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_admin() OR public.is_employee());

CREATE POLICY system_settings_admin_only ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 13. FINANCIAL DATA INTEGRITY ATOMIC DATABASE FUNCTIONS (PHASE 7)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_record_verified_payment(
  p_invoice_id UUID,
  p_amount NUMERIC(14,2),
  p_method TEXT,
  p_transaction_reference TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_new_paid NUMERIC(14,2);
  v_new_outstanding NUMERIC(14,2);
  v_new_status TEXT;
  v_payment_number TEXT;
  v_payment_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Payment amount must be greater than zero';
  END IF;

  -- Lock invoice row for atomic settlement calculation
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Invoice % not found', p_invoice_id;
  END IF;

  IF v_invoice.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'BUSINESS_RULE_VIOLATION: Cannot record payment on a cancelled invoice';
  END IF;

  IF p_amount > v_invoice.outstanding_amount THEN
    RAISE EXCEPTION 'BUSINESS_RULE_VIOLATION: Payment amount (%) exceeds outstanding balance (%)',
      p_amount, v_invoice.outstanding_amount;
  END IF;

  v_new_paid := ROUND(v_invoice.amount_paid + p_amount, 2);
  v_new_outstanding := ROUND(v_invoice.total_amount - v_new_paid, 2);
  v_new_status := CASE WHEN v_new_outstanding = 0 THEN 'PAID' ELSE 'CONFIRMED' END;
  v_payment_number := 'PAY-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.payments (
    payment_number,
    invoice_id,
    customer_id,
    method,
    amount,
    transaction_reference,
    status,
    recorded_by_id
  )
  VALUES (
    upper(v_payment_number),
    v_invoice.id,
    v_invoice.customer_id,
    p_method,
    ROUND(p_amount, 2),
    p_transaction_reference,
    'VERIFIED',
    p_actor_id
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.invoices
  SET amount_paid = v_new_paid,
      outstanding_amount = v_new_outstanding,
      status = v_new_status,
      paid_at = CASE WHEN v_new_outstanding = 0 THEN now() ELSE paid_at END,
      updated_at = now()
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object(
    'paymentId', v_payment_id,
    'paymentNumber', upper(v_payment_number),
    'invoiceId', v_invoice.id,
    'newStatus', v_new_status,
    'amountPaid', v_new_paid,
    'outstandingAmount', v_new_outstanding
  );
END;
$$;

-- ============================================================================
-- 14. SUPABASE STORAGE BUCKETS & ACCESS POLICIES (PHASE 8)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES
      ('invoice-documents', 'invoice-documents', false),
      ('customer-documents', 'customer-documents', false),
      ('profile-images', 'profile-images', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

COMMIT;
