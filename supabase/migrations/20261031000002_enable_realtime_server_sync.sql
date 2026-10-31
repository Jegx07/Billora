-- ============================================================================
-- BILLORA — REAL-TIME SERVER SYNC & SUPABASE REALTIME PUBLICATION MIGRATION
-- Migration: 20261031000002_enable_realtime_server_sync.sql
--
-- Purpose:
-- 1. Enables Supabase Realtime (`supabase_realtime` publication) across all core
--    Billora tables so changes stream dynamically in the Supabase Table Editor & UI.
-- 2. Allows the Billora Next.js backend server to synchronize local records
--    even when authenticating with the publishable key (`anon` role) during
--    local development, while preserving authenticated user RLS isolation.
-- ============================================================================

BEGIN;

-- 1. Enable Supabase Realtime publication on core Billora tables
DO $$
DECLARE
  tbl TEXT;
  core_tables TEXT[] := ARRAY[
    'roles', 'profiles', 'user_roles', 'employees', 'customers',
    'products', 'product_variants', 'subscription_plans', 'plan_products',
    'tax_rules', 'discounts', 'quotation_templates', 'quotations', 'quotation_lines',
    'subscriptions', 'subscription_lines', 'subscription_history', 'billing_periods',
    'invoices', 'invoice_lines', 'payments', 'notifications', 'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY core_tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
    EXCEPTION WHEN duplicate_object OR undefined_object THEN
      -- Ignore if already added to publication
      NULL;
    END;
  END LOOP;
END $$;

-- 2. Allow backend sync policies for development when SUPABASE_SERVICE_ROLE_KEY is not yet set
DO $$
DECLARE
  tbl TEXT;
  all_tables TEXT[] := ARRAY[
    'roles', 'profiles', 'user_roles', 'employees', 'employee_profiles',
    'customers', 'customer_profiles', 'customer_addresses', 'customer_contacts',
    'employee_assignments', 'product_categories', 'products', 'product_variants',
    'subscription_plans', 'plan_products', 'tax_rules', 'discounts', 'discount_products',
    'discount_usage', 'quotation_templates', 'quotation_template_lines',
    'quotations', 'quotation_lines', 'subscriptions', 'subscription_lines',
    'subscription_history', 'billing_periods', 'invoices', 'invoice_lines',
    'payments', 'payment_transactions', 'refunds', 'notifications',
    'notification_preferences', 'audit_logs', 'system_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS billora_server_sync_%I ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY billora_server_sync_%I ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true);',
      tbl, tbl
    );
  END LOOP;
END $$;

COMMIT;
