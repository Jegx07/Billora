import crypto from "crypto";
import {
  getSupabasePublicKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/**
 * Deterministic UUID v5-style generator from existing CUID/string IDs
 * so local Prisma IDs (e.g. "cmvw...") map 1:1 to valid PostgreSQL UUIDs in Supabase.
 */
export function toUuid(namespace: string, id: string | null | undefined): string | null {
  if (!id) return null;
  // If already a valid UUID, return as-is
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id.toLowerCase();
  }
  const hash = crypto.createHash("sha256").update(`${namespace}:${id}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    "8" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val.toString());
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function toIso(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return new Date(val).toISOString();
  return null;
}

/**
 * Maps Prisma model records to normalized Supabase PostgreSQL table rows.
 */
export const SupabaseTransformers = {
  Role: (r: any) => ({
    id: toUuid("role", r.id),
    name: r.name,
    description: r.description ?? null,
    created_at: toIso(r.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
  }),

  User: (u: any) => ({
    id: toUuid("user", u.id),
    email: u.email,
    full_name: u.fullName,
    status: u.status || "ACTIVE",
    email_verified_at: toIso(u.emailVerifiedAt),
    last_login_at: toIso(u.lastLoginAt),
    created_at: toIso(u.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(u.updatedAt) ?? new Date().toISOString(),
  }),

  UserRole: (u: any, roleNameMap?: Map<string, string>) => ({
    id: toUuid("user_role", u.id),
    user_id: toUuid("user", u.id),
    role_id: toUuid("role", u.roleId),
    role_name: u.role?.name || roleNameMap?.get(u.roleId) || "CUSTOMER",
    created_at: toIso(u.createdAt) ?? new Date().toISOString(),
  }),

  Employee: (e: any) => ({
    id: toUuid("employee", e.id),
    employee_code: e.employeeCode,
    user_id: toUuid("user", e.userId),
    department: e.department,
    designation: e.designation,
    phone: e.phone ?? null,
    is_active: true,
    created_at: toIso(e.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(e.updatedAt) ?? new Date().toISOString(),
  }),

  Customer: (c: any) => ({
    id: toUuid("customer", c.id),
    customer_code: c.customerCode,
    user_id: toUuid("user", c.userId),
    company_name: c.companyName ?? null,
    contact_name: c.contactName,
    email: c.email,
    phone: c.phone ?? null,
    gstin: c.gstin ?? null,
    billing_address: c.billingAddress ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    country: c.country || "India",
    postal_code: c.postalCode ?? null,
    assigned_employee_id: toUuid("employee", c.assignedEmployeeId),
    created_at: toIso(c.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(c.updatedAt) ?? new Date().toISOString(),
    deleted_at: toIso(c.deletedAt),
  }),

  Product: (p: any) => ({
    id: toUuid("product", p.id),
    product_code: p.productCode,
    name: p.name,
    product_type: p.productType || "SAAS",
    sales_price: toNum(p.salesPrice),
    cost_price: toNum(p.costPrice),
    description: p.description ?? null,
    notes: p.notes ?? null,
    status: p.status || "ACTIVE",
    created_at: toIso(p.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(p.updatedAt) ?? new Date().toISOString(),
  }),

  ProductVariant: (v: any) => ({
    id: toUuid("variant", v.id),
    product_id: toUuid("product", v.productId),
    name: v.name,
    sku: v.sku,
    additional_price: toNum(v.additionalPrice),
    status: v.status || "ACTIVE",
    created_at: toIso(v.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(v.updatedAt) ?? new Date().toISOString(),
  }),

  SubscriptionPlan: (pl: any) => ({
    id: toUuid("plan", pl.id),
    plan_code: pl.planCode,
    name: pl.name,
    description: pl.description ?? null,
    base_price: toNum(pl.basePrice),
    billing_frequency: pl.billingFrequency,
    min_quantity: pl.minQuantity ?? 1,
    available_from: toIso(pl.availableFrom),
    available_until: toIso(pl.availableUntil),
    auto_close_days: pl.autoCloseDays ?? null,
    allow_early_cancel: Boolean(pl.allowEarlyCancel ?? true),
    allow_pause: Boolean(pl.allowPause ?? true),
    allow_renewal: Boolean(pl.allowRenewal ?? true),
    default_term_months: pl.defaultTermMonths ?? 12,
    status: pl.status || "ACTIVE",
    created_at: toIso(pl.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(pl.updatedAt) ?? new Date().toISOString(),
  }),

  PlanProduct: (pp: any) => ({
    id: toUuid("plan_product", pp.id),
    plan_id: toUuid("plan", pp.planId),
    product_id: toUuid("product", pp.productId),
    default_quantity: pp.defaultQuantity ?? 1,
    included_in_base: Boolean(pp.includedInBase ?? false),
  }),

  TaxRule: (t: any) => ({
    id: toUuid("tax", t.id),
    name: t.name,
    tax_type: t.taxType || "GST",
    percentage: toNum(t.percentage),
    applicability: t.applicability || "ALL",
    effective_from: toIso(t.effectiveFrom) ?? new Date().toISOString(),
    effective_until: toIso(t.effectiveUntil),
    is_active: Boolean(t.isActive ?? true),
    created_at: toIso(t.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(t.updatedAt) ?? new Date().toISOString(),
  }),

  Discount: (d: any) => ({
    id: toUuid("discount", d.id),
    code: d.code,
    name: d.name,
    discount_type: d.discountType,
    value: toNum(d.value),
    min_purchase_amount: toNum(d.minPurchaseAmount),
    min_quantity: d.minQuantity ?? 1,
    applicable_to_all: Boolean(d.applicableToAll ?? true),
    start_date: toIso(d.startDate) ?? new Date().toISOString(),
    end_date: toIso(d.endDate) ?? new Date().toISOString(),
    max_usage_count: d.maxUsageCount ?? null,
    current_usage_count: d.currentUsageCount ?? 0,
    is_active: Boolean(d.isActive ?? true),
    created_at: toIso(d.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(d.updatedAt) ?? new Date().toISOString(),
  }),

  DiscountProduct: (dp: any) => ({
    id: toUuid("discount_product", dp.id),
    discount_id: toUuid("discount", dp.discountId),
    product_id: toUuid("product", dp.productId),
  }),

  DiscountUsage: (du: any) => ({
    id: toUuid("discount_usage", du.id),
    discount_id: toUuid("discount", du.discountId),
    customer_id: toUuid("customer", du.customerId),
    subscription_id: toUuid("subscription", du.subscriptionId),
    invoice_id: toUuid("invoice", du.invoiceId),
    discount_amount: toNum(du.discountAmount),
    used_at: toIso(du.usedAt) ?? new Date().toISOString(),
  }),

  QuotationTemplate: (qt: any) => ({
    id: toUuid("quotation_template", qt.id),
    name: qt.name,
    description: qt.description ?? null,
    plan_id: toUuid("plan", qt.planId),
    validity_days: qt.validityDays ?? 15,
    tax_rule_id: toUuid("tax", qt.taxRuleId),
    is_active: Boolean(qt.isActive ?? true),
    created_at: toIso(qt.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(qt.updatedAt) ?? new Date().toISOString(),
  }),

  QuotationTemplateLine: (qtl: any) => ({
    id: toUuid("quotation_template_line", qtl.id),
    template_id: toUuid("quotation_template", qtl.templateId),
    product_id: toUuid("product", qtl.productId),
    variant_id: toUuid("variant", qtl.variantId),
    default_quantity: qtl.defaultQuantity ?? 1,
  }),

  Quotation: (q: any) => ({
    id: toUuid("quotation", q.id),
    quotation_number: q.quotationNumber,
    customer_id: toUuid("customer", q.customerId),
    plan_id: toUuid("plan", q.planId),
    template_id: toUuid("quotation_template", q.templateId),
    discount_id: toUuid("discount", q.discountId),
    status: q.status || "DRAFT",
    issue_date: toIso(q.issueDate) ?? new Date().toISOString(),
    expiry_date: toIso(q.expiryDate) ?? new Date().toISOString(),
    subtotal: toNum(q.subtotal),
    discount_amount: toNum(q.discountAmount),
    tax_amount: toNum(q.taxAmount),
    total_amount: toNum(q.totalAmount),
    notes: q.notes ?? null,
    created_by_id: toUuid("user", q.createdById),
    created_at: toIso(q.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(q.updatedAt) ?? new Date().toISOString(),
  }),

  QuotationLine: (ql: any) => ({
    id: toUuid("quotation_line", ql.id),
    quotation_id: toUuid("quotation", ql.quotationId),
    product_id: toUuid("product", ql.productId),
    variant_id: toUuid("variant", ql.variantId),
    description: ql.description,
    quantity: ql.quantity ?? 1,
    base_unit_price: toNum(ql.baseUnitPrice),
    variant_price_delta: toNum(ql.variantPriceDelta),
    unit_price: toNum(ql.unitPrice),
    tax_rule_id: toUuid("tax", ql.taxRuleId),
    tax_rate_snapshot: toNum(ql.taxRateSnapshot),
    line_subtotal: toNum(ql.lineSubtotal),
    line_discount_amount: toNum(ql.lineDiscountAmount),
    line_tax_amount: toNum(ql.lineTaxAmount),
    line_total: toNum(ql.lineTotal),
  }),

  Subscription: (s: any) => ({
    id: toUuid("subscription", s.id),
    subscription_number: s.subscriptionNumber,
    customer_id: toUuid("customer", s.customerId),
    plan_id: toUuid("plan", s.planId),
    quotation_id: toUuid("quotation", s.quotationId),
    discount_id: toUuid("discount", s.discountId),
    status: s.status || "DRAFT",
    billing_frequency: s.billingFrequency,
    payment_terms_days: s.paymentTermsDays ?? 7,
    start_date: toIso(s.startDate) ?? new Date().toISOString(),
    expiry_date: toIso(s.expiryDate),
    anchor_billing_day: Math.min(Math.max(Number(s.anchorBillingDay || 1), 1), 31),
    current_period_start: toIso(s.currentPeriodStart) ?? new Date().toISOString(),
    current_period_end: toIso(s.currentPeriodEnd) ?? new Date().toISOString(),
    next_billing_date: toIso(s.nextBillingDate) ?? new Date().toISOString(),
    paused_at: toIso(s.pausedAt),
    cancelled_at: toIso(s.cancelledAt),
    closed_at: toIso(s.closedAt),
    cancellation_reason: s.cancellationReason ?? null,
    subtotal: toNum(s.subtotal),
    discount_amount: toNum(s.discountAmount),
    tax_amount: toNum(s.taxAmount),
    total_amount: toNum(s.totalAmount),
    timezone: s.timezone || "Asia/Kolkata",
    created_at: toIso(s.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(s.updatedAt) ?? new Date().toISOString(),
  }),

  SubscriptionLine: (sl: any) => ({
    id: toUuid("subscription_line", sl.id),
    subscription_id: toUuid("subscription", sl.subscriptionId),
    product_id: toUuid("product", sl.productId),
    variant_id: toUuid("variant", sl.variantId),
    product_name_snapshot: sl.productNameSnapshot,
    variant_name_snapshot: sl.variantNameSnapshot ?? null,
    quantity: sl.quantity ?? 1,
    base_unit_price: toNum(sl.baseUnitPrice),
    variant_price_delta: toNum(sl.variantPriceDelta),
    unit_price: toNum(sl.unitPrice),
    tax_rule_id: toUuid("tax", sl.taxRuleId),
    tax_name_snapshot: sl.taxNameSnapshot ?? null,
    tax_rate_snapshot: toNum(sl.taxRateSnapshot),
    line_subtotal: toNum(sl.lineSubtotal),
    line_discount_amount: toNum(sl.lineDiscountAmount),
    line_tax_amount: toNum(sl.lineTaxAmount),
    line_total: toNum(sl.lineTotal),
  }),

  SubscriptionHistory: (sh: any) => ({
    id: toUuid("subscription_history", sh.id),
    subscription_id: toUuid("subscription", sh.subscriptionId),
    from_status: sh.fromStatus ?? null,
    to_status: sh.toStatus,
    action: sh.action,
    actor_user_id: toUuid("user", sh.actorUserId),
    reason: sh.reason ?? null,
    metadata_json: sh.metadataJson
      ? (() => {
          try {
            return JSON.parse(sh.metadataJson);
          } catch {
            return { raw: sh.metadataJson };
          }
        })()
      : null,
    created_at: toIso(sh.createdAt) ?? new Date().toISOString(),
  }),

  BillingPeriod: (bp: any) => ({
    id: toUuid("billing_period", bp.id),
    subscription_id: toUuid("subscription", bp.subscriptionId),
    billing_period_start: toIso(bp.billingPeriodStart) ?? new Date().toISOString(),
    billing_period_end: toIso(bp.billingPeriodEnd) ?? new Date().toISOString(),
    idempotency_key: bp.idempotencyKey,
    status: bp.status || "COMPLETED",
    attempt_count: bp.attemptCount ?? 1,
    last_error: bp.lastError ?? null,
    created_at: toIso(bp.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(bp.updatedAt) ?? new Date().toISOString(),
  }),

  Invoice: (inv: any) => ({
    id: toUuid("invoice", inv.id),
    invoice_number: inv.invoiceNumber,
    customer_id: toUuid("customer", inv.customerId),
    subscription_id: toUuid("subscription", inv.subscriptionId),
    billing_period_id: toUuid("billing_period", inv.billingPeriodId),
    billing_period_start: toIso(inv.billingPeriodStart),
    billing_period_end: toIso(inv.billingPeriodEnd),
    idempotency_key: inv.idempotencyKey ?? null,
    discount_id: toUuid("discount", inv.discountId),
    invoice_date: toIso(inv.invoiceDate) ?? new Date().toISOString(),
    due_date: toIso(inv.dueDate) ?? new Date().toISOString(),
    status: inv.status || "DRAFT",
    subtotal: toNum(inv.subtotal),
    discount_amount: toNum(inv.discountAmount),
    tax_amount: toNum(inv.taxAmount),
    total_amount: toNum(inv.totalAmount),
    amount_paid: toNum(inv.amountPaid),
    outstanding_amount: toNum(inv.outstandingAmount),
    paid_at: toIso(inv.paidAt),
    cancelled_at: toIso(inv.cancelledAt),
    notes: inv.notes ?? null,
    created_at: toIso(inv.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(inv.updatedAt) ?? new Date().toISOString(),
  }),

  InvoiceLine: (il: any) => ({
    id: toUuid("invoice_line", il.id),
    invoice_id: toUuid("invoice", il.invoiceId),
    product_id: toUuid("product", il.productId),
    variant_id: toUuid("variant", il.variantId),
    product_name_snapshot: il.productNameSnapshot,
    variant_name_snapshot: il.variantNameSnapshot ?? null,
    description: il.description,
    quantity: il.quantity ?? 1,
    base_unit_price: toNum(il.baseUnitPrice),
    variant_price_delta: toNum(il.variantPriceDelta),
    unit_price: toNum(il.unitPrice),
    tax_rule_id: toUuid("tax", il.taxRuleId),
    tax_name_snapshot: il.taxNameSnapshot ?? null,
    tax_rate_snapshot: toNum(il.taxRateSnapshot),
    line_subtotal: toNum(il.lineSubtotal),
    line_discount_amount: toNum(il.lineDiscountAmount),
    line_tax_amount: toNum(il.lineTaxAmount),
    line_total: toNum(il.lineTotal),
  }),

  Payment: (p: any) => ({
    id: toUuid("payment", p.id),
    payment_number: p.paymentNumber,
    invoice_id: toUuid("invoice", p.invoiceId),
    customer_id: toUuid("customer", p.customerId),
    method: p.method,
    amount: toNum(p.amount),
    refunded_amount: toNum(p.refundedAmount),
    payment_date: toIso(p.paymentDate) ?? new Date().toISOString(),
    transaction_reference: p.transactionReference ?? null,
    razorpay_order_id: p.razorpayOrderId ?? null,
    razorpay_payment_id: p.razorpayPaymentId ?? null,
    razorpay_signature: p.razorpaySignature ?? null,
    status: p.status || "VERIFIED",
    failure_reason: p.failureReason ?? null,
    notes: p.notes ?? null,
    recorded_by_id: toUuid("user", p.recordedById),
    created_at: toIso(p.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(p.updatedAt) ?? new Date().toISOString(),
  }),

  Notification: (n: any) => ({
    id: toUuid("notification", n.id),
    user_id: toUuid("user", n.userId),
    event_type: n.eventType,
    title: n.title,
    message: n.message,
    channel: n.channel || "BOTH",
    delivery_status: n.deliveryStatus || "DELIVERED",
    error_message: n.errorMessage ?? null,
    idempotency_key: n.idempotencyKey ?? null,
    is_read: Boolean(n.isRead ?? false),
    read_at: toIso(n.readAt),
    created_at: toIso(n.createdAt) ?? new Date().toISOString(),
  }),

  AuditLog: (al: any) => ({
    id: toUuid("audit_log", al.id),
    actor_id: toUuid("user", al.actorId),
    actor_role: al.actorRole ?? null,
    action: al.action,
    entity_type: al.entityType,
    entity_id: al.entityId,
    before_json: al.beforeJson
      ? (() => {
          try {
            return JSON.parse(al.beforeJson);
          } catch {
            return null;
          }
        })()
      : null,
    after_json: al.afterJson
      ? (() => {
          try {
            return JSON.parse(al.afterJson);
          } catch {
            return null;
          }
        })()
      : null,
    ip_address: al.ipAddress ?? null,
    created_at: toIso(al.createdAt) ?? new Date().toISOString(),
  }),
};

const MODEL_TO_TABLE: Record<
  string,
  {
    table: string;
    namespace: string;
    onConflict: string;
    transform: (row: any) => Record<string, unknown>;
  }
> = {
  Role: { table: "roles", namespace: "role", onConflict: "name", transform: SupabaseTransformers.Role },
  User: { table: "profiles", namespace: "user", onConflict: "id", transform: SupabaseTransformers.User },
  Employee: { table: "employees", namespace: "employee", onConflict: "id", transform: SupabaseTransformers.Employee },
  Customer: { table: "customers", namespace: "customer", onConflict: "id", transform: SupabaseTransformers.Customer },
  Product: { table: "products", namespace: "product", onConflict: "id", transform: SupabaseTransformers.Product },
  ProductVariant: {
    table: "product_variants",
    namespace: "variant",
    onConflict: "id",
    transform: SupabaseTransformers.ProductVariant,
  },
  SubscriptionPlan: {
    table: "subscription_plans",
    namespace: "plan",
    onConflict: "id",
    transform: SupabaseTransformers.SubscriptionPlan,
  },
  PlanProduct: {
    table: "plan_products",
    namespace: "plan_product",
    onConflict: "id",
    transform: SupabaseTransformers.PlanProduct,
  },
  TaxRule: { table: "tax_rules", namespace: "tax", onConflict: "id", transform: SupabaseTransformers.TaxRule },
  Discount: { table: "discounts", namespace: "discount", onConflict: "id", transform: SupabaseTransformers.Discount },
  DiscountProduct: {
    table: "discount_products",
    namespace: "discount_product",
    onConflict: "id",
    transform: SupabaseTransformers.DiscountProduct,
  },
  DiscountUsage: {
    table: "discount_usage",
    namespace: "discount_usage",
    onConflict: "id",
    transform: SupabaseTransformers.DiscountUsage,
  },
  QuotationTemplate: {
    table: "quotation_templates",
    namespace: "quotation_template",
    onConflict: "id",
    transform: SupabaseTransformers.QuotationTemplate,
  },
  QuotationTemplateLine: {
    table: "quotation_template_lines",
    namespace: "quotation_template_line",
    onConflict: "id",
    transform: SupabaseTransformers.QuotationTemplateLine,
  },
  Quotation: { table: "quotations", namespace: "quotation", onConflict: "id", transform: SupabaseTransformers.Quotation },
  QuotationLine: {
    table: "quotation_lines",
    namespace: "quotation_line",
    onConflict: "id",
    transform: SupabaseTransformers.QuotationLine,
  },
  Subscription: {
    table: "subscriptions",
    namespace: "subscription",
    onConflict: "id",
    transform: SupabaseTransformers.Subscription,
  },
  SubscriptionLine: {
    table: "subscription_lines",
    namespace: "subscription_line",
    onConflict: "id",
    transform: SupabaseTransformers.SubscriptionLine,
  },
  SubscriptionHistory: {
    table: "subscription_history",
    namespace: "subscription_history",
    onConflict: "id",
    transform: SupabaseTransformers.SubscriptionHistory,
  },
  BillingPeriod: {
    table: "billing_periods",
    namespace: "billing_period",
    onConflict: "id",
    transform: SupabaseTransformers.BillingPeriod,
  },
  Invoice: { table: "invoices", namespace: "invoice", onConflict: "id", transform: SupabaseTransformers.Invoice },
  InvoiceLine: {
    table: "invoice_lines",
    namespace: "invoice_line",
    onConflict: "id",
    transform: SupabaseTransformers.InvoiceLine,
  },
  Payment: { table: "payments", namespace: "payment", onConflict: "id", transform: SupabaseTransformers.Payment },
  Notification: {
    table: "notifications",
    namespace: "notification",
    onConflict: "id",
    transform: SupabaseTransformers.Notification,
  },
  AuditLog: { table: "audit_logs", namespace: "audit_log", onConflict: "id", transform: SupabaseTransformers.AuditLog },
};

function getSyncCredentials(): { url: string; apiKey: string } | null {
  if (!isSupabaseConfigured()) return null;
  const url = getSupabaseUrl();
  // Prefer SUPABASE_SERVICE_ROLE_KEY for server-side database replication; fallback to public key
  const apiKey = getSupabaseServiceRoleKey() || getSupabasePublicKey();
  if (!url || !apiKey) return null;
  return { url, apiKey };
}

/**
 * Upserts a batch of rows into a Supabase PostgREST table in chunks.
 */
export async function upsertToSupabaseTable(
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id",
  chunkSize = 250
): Promise<{ synced: number; error: string | null }> {
  if (rows.length === 0) return { synced: 0, error: null };
  const creds = getSyncCredentials();
  if (!creds) return { synced: 0, error: "Supabase credentials not configured" };

  let synced = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const endpoint = `${creds.url}/rest/v1/${encodeURIComponent(table)}?on_conflict=${encodeURIComponent(onConflict)}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: creds.apiKey,
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { synced, error: `[${table}] HTTP ${res.status}: ${errText}` };
    }
    synced += chunk.length;
  }

  return { synced, error: null };
}

/**
 * Deletes a record from a Supabase PostgREST table by deterministic UUID.
 */
export async function deleteFromSupabaseTable(
  table: string,
  uuid: string
): Promise<{ deleted: boolean; error: string | null }> {
  const creds = getSyncCredentials();
  if (!creds) return { deleted: false, error: "Supabase credentials not configured" };

  const endpoint = `${creds.url}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(uuid)}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      apikey: creds.apiKey,
      Authorization: `Bearer ${creds.apiKey}`,
      Prefer: "return=minimal",
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return { deleted: false, error: `[${table}] HTTP ${res.status}: ${errText}` };
  }
  return { deleted: true, error: null };
}

/**
 * Real-Time Dynamic Sync Hook called automatically by Prisma Middleware (`src/server/db/client.ts`)
 * after any local create/update/upsert/delete operation.
 */
export async function syncPrismaMutationToSupabase(
  prismaClient: any,
  model: string | undefined,
  action: string,
  args: any,
  result: any
): Promise<void> {
  if (!model || !MODEL_TO_TABLE[model] || !isSupabaseConfigured()) return;

  const spec = MODEL_TO_TABLE[model];

  try {
    if (action === "create" || action === "update" || action === "upsert") {
      if (!result || typeof result !== "object" || !result.id) return;
      const mapped = spec.transform(result);
      await upsertToSupabaseTable(spec.table, [mapped], spec.onConflict);

      // If a User was created/updated, also sync their `user_roles` entry
      if (model === "User" && result.roleId) {
        const userRoleRow = SupabaseTransformers.UserRole(result);
        await upsertToSupabaseTable("user_roles", [userRoleRow], "user_id");
      }

      // If a Quotation, Subscription, or Invoice was created with nested `lines`, also sync the child lines!
      if (model === "Quotation" && prismaClient?.quotationLine) {
        const lines = await prismaClient.quotationLine.findMany({
          where: { quotationId: result.id },
        });
        if (lines.length > 0) {
          await upsertToSupabaseTable(
            "quotation_lines",
            lines.map(SupabaseTransformers.QuotationLine),
            "id"
          );
        }
      } else if (model === "Subscription" && prismaClient?.subscriptionLine) {
        const [lines, history] = await Promise.all([
          prismaClient.subscriptionLine.findMany({ where: { subscriptionId: result.id } }),
          prismaClient.subscriptionHistory.findMany({ where: { subscriptionId: result.id } }),
        ]);
        if (lines.length > 0) {
          await upsertToSupabaseTable(
            "subscription_lines",
            lines.map(SupabaseTransformers.SubscriptionLine),
            "id"
          );
        }
        if (history.length > 0) {
          await upsertToSupabaseTable(
            "subscription_history",
            history.map(SupabaseTransformers.SubscriptionHistory),
            "id"
          );
        }
      } else if (model === "Invoice" && prismaClient?.invoiceLine) {
        const lines = await prismaClient.invoiceLine.findMany({
          where: { invoiceId: result.id },
        });
        if (lines.length > 0) {
          await upsertToSupabaseTable(
            "invoice_lines",
            lines.map(SupabaseTransformers.InvoiceLine),
            "id"
          );
        }
      }
    } else if (action === "delete") {
      const targetId = result?.id || args?.where?.id;
      if (targetId) {
        const uuid = toUuid(spec.namespace, targetId);
        if (uuid) await deleteFromSupabaseTable(spec.table, uuid);
      }
    }
  } catch {
    // Non-blocking background sync so local web operations never fail if offline
  }
}
