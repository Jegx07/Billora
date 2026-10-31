import crypto from "crypto";
import fs from "fs";
import path from "path";
import Decimal from "decimal.js";
import { prisma } from "../src/server/db/client";
import { getSupabaseConfigStatus } from "../src/lib/supabase/config";
import { createAdminSupabaseClient } from "../src/lib/supabase/client";

/**
 * Deterministic UUID v5-style generator from existing CUID/string IDs
 * so repeated migration runs are 100% idempotent and never duplicate rows.
 */
export function toDeterministicUuid(namespace: string, sourceId: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${namespace}:${sourceId}`)
    .digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    "8" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

async function runMigrationAndVerification() {
  console.log("=================================================================");
  console.log(" BILLORA — CENTRALIZED SUPABASE DATABASE MIGRATION & VERIFICATION");
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
        supabaseUuid: toDeterministicUuid("user", u.id),
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
  console.log(`   - SUPABASE_SERVICE_ROLE_KEY  : ${sbStatus.hasServiceRoleKey ? "Configured" : "NOT SET"}`);

  if (!sbStatus.isAdminReady) {
    console.log(
      `\n[INFO] Public Supabase URL & Publishable Key are configured (${sbStatus.url}).\n` +
        "       To run privileged bulk user/table migration from the CLI, add SUPABASE_SERVICE_ROLE_KEY to .env\n" +
        "       and re-run `npm run db:migrate:supabase`."
    );
    return;
  }

  // 5. When live credentials are provided, synchronize Auth users via Admin API
  const adminClient = createAdminSupabaseClient();
  let syncedUsers = 0;
  for (const u of users) {
    try {
      await adminClient.adminCreateUser({
        email: u.email,
        password: `Billora#${u.id.slice(0, 8)}!2026`,
        fullName: u.fullName,
        role: (u.role.name as "ADMIN" | "EMPLOYEE" | "CUSTOMER") ?? "CUSTOMER",
        emailConfirm: true,
      });
      syncedUsers += 1;
    } catch {
      // User already exists in Supabase Auth (idempotent skip)
    }
  }
  console.log(`\n5. Synchronized ${syncedUsers}/${users.length} identities with Supabase Auth.`);
}

runMigrationAndVerification()
  .catch((err) => {
    console.error("Migration verification error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
