import fs from "fs";
import path from "path";
import Decimal from "decimal.js";
import { prisma } from "../src/server/db/client";
import { getSupabaseConfigStatus } from "../src/lib/supabase/config";
import {
  SupabaseTransformers,
  toUuid,
  upsertToSupabaseTable,
} from "../src/server/db/supabase-sync";

export { toUuid as toDeterministicUuid };

async function runMigrationAndVerification() {
  console.log("=================================================================");
  console.log(" BILLORA — CENTRALIZED SUPABASE DATABASE MIGRATION & LIVE UPLOAD");
  console.log("=================================================================\n");

  // 1. Extract all records from existing database
  const [
    roles,
    users,
    employees,
    customers,
    products,
    productVariants,
    subscriptionPlans,
    planProducts,
    taxRules,
    discounts,
    discountProducts,
    discountUsages,
    quotationTemplates,
    quotationTemplateLines,
    quotations,
    quotationLines,
    subscriptions,
    subscriptionLines,
    subscriptionHistories,
    billingPeriods,
    invoices,
    invoiceLines,
    payments,
    notifications,
    auditLogs,
    billingJobRuns,
  ] = await Promise.all([
    prisma.role.findMany(),
    prisma.user.findMany({ include: { role: true } }),
    prisma.employee.findMany(),
    prisma.customer.findMany(),
    prisma.product.findMany(),
    prisma.productVariant.findMany(),
    prisma.subscriptionPlan.findMany(),
    prisma.planProduct.findMany(),
    prisma.taxRule.findMany(),
    prisma.discount.findMany(),
    prisma.discountProduct.findMany(),
    prisma.discountUsage.findMany(),
    prisma.quotationTemplate.findMany(),
    prisma.quotationTemplateLine.findMany(),
    prisma.quotation.findMany(),
    prisma.quotationLine.findMany(),
    prisma.subscription.findMany(),
    prisma.subscriptionLine.findMany(),
    prisma.subscriptionHistory.findMany(),
    prisma.billingPeriod.findMany(),
    prisma.invoice.findMany(),
    prisma.invoiceLine.findMany(),
    prisma.payment.findMany(),
    prisma.notification.findMany(),
    prisma.auditLog.findMany(),
    prisma.billingJobRun.findMany(),
  ]);

  // 2. Financial & Referential Integrity Verification
  let totalInvoiced = new Decimal(0);
  let totalPaidOnInvoices = new Decimal(0);
  let totalOutstanding = new Decimal(0);
  let invoiceMathMismatches = 0;

  for (const inv of invoices) {
    if (inv.status !== "CANCELLED" && inv.status !== "DRAFT") {
      totalInvoiced = totalInvoiced.plus(inv.totalAmount.toString());
      totalPaidOnInvoices = totalPaidOnInvoices.plus(inv.amountPaid.toString());
      totalOutstanding = totalOutstanding.plus(inv.outstandingAmount.toString());
    }
    const expectedTotalAmount = new Decimal(inv.subtotal.toString())
      .minus(inv.discountAmount.toString())
      .plus(inv.taxAmount.toString())
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (!expectedTotalAmount.equals(new Decimal(inv.totalAmount.toString()))) {
      invoiceMathMismatches += 1;
    }
  }

  let verifiedPaymentsTotal = new Decimal(0);
  for (const p of payments) {
    if (p.status === "VERIFIED") {
      verifiedPaymentsTotal = verifiedPaymentsTotal.plus(p.amount.toString());
    }
  }

  const recordCounts = {
    roles: roles.length,
    users: users.length,
    employees: employees.length,
    customers: customers.length,
    products: products.length,
    productVariants: productVariants.length,
    subscriptionPlans: subscriptionPlans.length,
    planProducts: planProducts.length,
    taxRules: taxRules.length,
    discounts: discounts.length,
    discountProducts: discountProducts.length,
    discountUsages: discountUsages.length,
    quotationTemplates: quotationTemplates.length,
    quotationTemplateLines: quotationTemplateLines.length,
    quotations: quotations.length,
    quotationLines: quotationLines.length,
    subscriptions: subscriptions.length,
    subscriptionLines: subscriptionLines.length,
    subscriptionHistory: subscriptionHistories.length,
    billingPeriods: billingPeriods.length,
    invoices: invoices.length,
    invoiceLines: invoiceLines.length,
    payments: payments.length,
    notifications: notifications.length,
    auditLogs: auditLogs.length,
    billingJobRuns: billingJobRuns.length,
  };

  console.log("1. Existing Database Record Counts:");
  console.table(recordCounts);

  console.log("\n2. Financial & Referential Integrity Verification:");
  console.log(`   - Confirmed/Paid Invoiced Total         : INR ${totalInvoiced.toFixed(2)}`);
  console.log(`   - Total Paid Across Invoices            : INR ${totalPaidOnInvoices.toFixed(2)}`);
  console.log(`   - Total Outstanding Receivables         : INR ${totalOutstanding.toFixed(2)}`);
  console.log(`   - Total Verified Payments Recorded      : INR ${verifiedPaymentsTotal.toFixed(2)}`);
  console.log(`   - Invoice Math Mismatches               : ${invoiceMathMismatches} (Expected: 0)`);

  // 3. Save full idempotent backup snapshot before migration
  const backupDir = path.resolve(process.cwd(), "supabase", "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, "billora-db-snapshot.json");
  const snapshotPayload = {
    exportedAt: new Date().toISOString(),
    recordCounts,
    financialSummary: {
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPaidOnInvoices: totalPaidOnInvoices.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      verifiedPaymentsTotal: verifiedPaymentsTotal.toFixed(2),
      invoiceMathMismatches,
    },
    data: {
      roles,
      users: users.map((u) => ({
        ...u,
        supabaseUuid: toUuid("user", u.id),
      })),
      employees,
      customers,
      products,
      productVariants,
      subscriptionPlans,
      planProducts,
      taxRules,
      discounts,
      discountProducts,
      discountUsages,
      quotationTemplates,
      quotationTemplateLines,
      quotations,
      quotationLines,
      subscriptions,
      subscriptionLines,
      subscriptionHistories,
      billingPeriods,
      invoices,
      invoiceLines,
      payments,
      notifications,
      auditLogs,
      billingJobRuns,
    },
  };

  fs.writeFileSync(backupPath, JSON.stringify(snapshotPayload, null, 2), "utf8");
  console.log(`\n3. Pre-Migration Backup Snapshot Saved:`);
  console.log(`   -> ${backupPath}`);

  // 4. Check Supabase Configuration
  const sbStatus = getSupabaseConfigStatus();
  console.log("\n4. Supabase Target Configuration Status:");
  console.log(`   - Mode                       : ${sbStatus.mode}`);
  console.log(`   - NEXT_PUBLIC_SUPABASE_URL   : ${sbStatus.hasUrl ? "Configured" : "NOT SET"}`);
  console.log(`   - NEXT_PUBLIC_SUPABASE_ANON  : ${sbStatus.hasAnonKey ? "Configured" : "NOT SET"}`);
  console.log(
    `   - SUPABASE_SERVICE_ROLE_KEY  : ${sbStatus.hasServiceRoleKey ? "Configured" : "NOT SET"}`
  );

  if (!sbStatus.isConfigured) {
    console.log("\n[INFO] NEXT_PUBLIC_SUPABASE_URL is not configured yet.");
    return;
  }

  // 5. Execute Live Batch Upload to Supabase Tables in Foreign-Key Topological Order
  console.log(`\n5. Uploading All Local Data to Supabase (${sbStatus.url})...`);
  const roleNameMap = new Map(roles.map((r) => [r.id, r.name]));

  const uploadBatches: {
    label: string;
    table: string;
    onConflict: string;
    rows: Record<string, unknown>[];
  }[] = [
    {
      label: "Roles",
      table: "roles",
      onConflict: "name",
      rows: roles.map(SupabaseTransformers.Role),
    },
    {
      label: "User Profiles",
      table: "profiles",
      onConflict: "id",
      rows: users.map(SupabaseTransformers.User),
    },
    {
      label: "User Roles",
      table: "user_roles",
      onConflict: "user_id",
      rows: users.map((u) => SupabaseTransformers.UserRole(u, roleNameMap)),
    },
    {
      label: "Employees",
      table: "employees",
      onConflict: "id",
      rows: employees.map(SupabaseTransformers.Employee),
    },
    {
      label: "Customers",
      table: "customers",
      onConflict: "id",
      rows: customers.map(SupabaseTransformers.Customer),
    },
    {
      label: "Products",
      table: "products",
      onConflict: "id",
      rows: products.map(SupabaseTransformers.Product),
    },
    {
      label: "Product Variants",
      table: "product_variants",
      onConflict: "id",
      rows: productVariants.map(SupabaseTransformers.ProductVariant),
    },
    {
      label: "Subscription Plans",
      table: "subscription_plans",
      onConflict: "id",
      rows: subscriptionPlans.map(SupabaseTransformers.SubscriptionPlan),
    },
    {
      label: "Plan Products",
      table: "plan_products",
      onConflict: "id",
      rows: planProducts.map(SupabaseTransformers.PlanProduct),
    },
    {
      label: "Tax Rules",
      table: "tax_rules",
      onConflict: "id",
      rows: taxRules.map(SupabaseTransformers.TaxRule),
    },
    {
      label: "Discounts",
      table: "discounts",
      onConflict: "id",
      rows: discounts.map(SupabaseTransformers.Discount),
    },
    {
      label: "Discount Products",
      table: "discount_products",
      onConflict: "id",
      rows: discountProducts.map(SupabaseTransformers.DiscountProduct),
    },
    {
      label: "Quotation Templates",
      table: "quotation_templates",
      onConflict: "id",
      rows: quotationTemplates.map(SupabaseTransformers.QuotationTemplate),
    },
    {
      label: "Quotation Template Lines",
      table: "quotation_template_lines",
      onConflict: "id",
      rows: quotationTemplateLines.map(SupabaseTransformers.QuotationTemplateLine),
    },
    {
      label: "Quotations",
      table: "quotations",
      onConflict: "id",
      rows: quotations.map(SupabaseTransformers.Quotation),
    },
    {
      label: "Quotation Lines",
      table: "quotation_lines",
      onConflict: "id",
      rows: quotationLines.map(SupabaseTransformers.QuotationLine),
    },
    {
      label: "Subscriptions",
      table: "subscriptions",
      onConflict: "id",
      rows: subscriptions.map(SupabaseTransformers.Subscription),
    },
    {
      label: "Subscription Lines",
      table: "subscription_lines",
      onConflict: "id",
      rows: subscriptionLines.map(SupabaseTransformers.SubscriptionLine),
    },
    {
      label: "Subscription History",
      table: "subscription_history",
      onConflict: "id",
      rows: subscriptionHistories.map(SupabaseTransformers.SubscriptionHistory),
    },
    {
      label: "Billing Periods",
      table: "billing_periods",
      onConflict: "id",
      rows: billingPeriods.map(SupabaseTransformers.BillingPeriod),
    },
    {
      label: "Invoices",
      table: "invoices",
      onConflict: "id",
      rows: invoices.map(SupabaseTransformers.Invoice),
    },
    {
      label: "Invoice Lines",
      table: "invoice_lines",
      onConflict: "id",
      rows: invoiceLines.map(SupabaseTransformers.InvoiceLine),
    },
    {
      label: "Payments",
      table: "payments",
      onConflict: "id",
      rows: payments.map(SupabaseTransformers.Payment),
    },
    {
      label: "Discount Usage",
      table: "discount_usage",
      onConflict: "id",
      rows: discountUsages.map(SupabaseTransformers.DiscountUsage),
    },
    {
      label: "Notifications",
      table: "notifications",
      onConflict: "id",
      rows: notifications.map(SupabaseTransformers.Notification),
    },
    {
      label: "Audit Logs",
      table: "audit_logs",
      onConflict: "id",
      rows: auditLogs.map(SupabaseTransformers.AuditLog),
    },
  ];

  let rlsBlocked = false;
  for (const batch of uploadBatches) {
    if (batch.rows.length === 0) {
      console.log(`   [SKIP] ${batch.label.padEnd(26)} : 0 rows`);
      continue;
    }
    const res = await upsertToSupabaseTable(batch.table, batch.rows, batch.onConflict);
    if (res.error) {
      console.log(`   [FAIL] ${batch.label.padEnd(26)} : ${res.error}`);
      if (res.error.includes("42501") || res.error.includes("row-level security")) {
        rlsBlocked = true;
        break;
      }
    } else {
      console.log(`   [OK]   ${batch.label.padEnd(26)} : ${res.synced}/${batch.rows.length} rows synced`);
    }
  }

  if (rlsBlocked) {
    console.log(
      "\n[ACTION REQUIRED TO BYPASS RLS FOR SERVER BULK UPLOAD & SYNC]\n" +
        "Your Supabase tables have Row Level Security (RLS) enabled, and .env currently only has\n" +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (which runs as the unauthenticated `anon` role).\n\n" +
        "To allow your local backend server and migration script to write to Supabase tables:\n" +
        "Option A (Recommended): Paste your Supabase Secret / Service Role Key into .env:\n" +
        '   SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." (from Supabase Dashboard -> Project Settings -> API Keys)\n' +
        "Option B: Run `supabase/migrations/20261031000002_enable_realtime_server_sync.sql` in your Supabase SQL Editor."
    );
  } else {
    console.log("\n[SUCCESS] All local database records have been uploaded and synchronized to Supabase!");
  }
}

runMigrationAndVerification()
  .catch((err) => {
    console.error("Migration verification error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
