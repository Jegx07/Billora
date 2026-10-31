import { calculateNextBillingDate } from "@/lib/dates";
import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AuthSessionContext, hashPassword } from "@/server/middlewares/auth";
import { AiAssistantService } from "@/server/services/ai-assistant.service";
import { AnalyticsService } from "@/server/services/analytics.service";
import { AuthService } from "@/server/services/auth.service";
import { BillingEngineService } from "@/server/services/billing-engine.service";
import { CatalogService } from "@/server/services/catalog.service";
import { DiscountService } from "@/server/services/discount.service";
import { InvoiceService } from "@/server/services/invoice.service";
import { PaymentService } from "@/server/services/payment.service";
import { QuotationService } from "@/server/services/quotation.service";
import { SubscriptionService } from "@/server/services/subscription.service";
import { beforeAll, describe, expect, it } from "vitest";

describe("Billora — 20 Mandatory Specification Test Scenarios", () => {
  let adminSession: AuthSessionContext;
  let employeeSession: AuthSessionContext;
  let customerASession: AuthSessionContext;
  let customerBSession: AuthSessionContext;

  let gst18TaxId: string;
  let businessSoftwareProductId: string;
  let standardVariantId: string;
  let odooVariantId: string;
  let premiumVariantId: string;
  let monthlyPlanId: string;
  let yearlyPlanId: string;
  let strictNoPauseCancelPlanId: string;

  beforeAll(async () => {
    // Clean test state
    await prisma.payment.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.billingPeriod.deleteMany();
    await prisma.billingJobRun.deleteMany();
    await prisma.subscriptionHistory.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.quotationLine.deleteMany();
    await prisma.quotation.deleteMany();
    await prisma.quotationTemplateLine.deleteMany();
    await prisma.quotationTemplate.deleteMany();
    await prisma.discountUsage.deleteMany();
    await prisma.discountProduct.deleteMany();
    await prisma.discount.deleteMany();
    await prisma.planProduct.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.taxRule.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();

    await AuthService.ensureRoles();
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });

    const adminUser = await prisma.user.create({
      data: {
        email: "admin.test@billora.io",
        fullName: "Test Administrator",
        passwordHash: hashPassword("Admin@Billora2026!"),
        roleId: adminRole.id,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    adminSession = {
      userId: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: "ADMIN",
      customerId: null,
      employeeId: null,
      csrfToken: "csrf_admin",
      sessionId: "sess_admin",
    };

    const emp = await AuthService.createEmployee(adminSession, {
      fullName: "Test Employee",
      email: "emp.test@billora.io",
      password: "Emp@Billora2026!",
      department: "Revenue Operations",
      designation: "Billing Specialist",
    });

    employeeSession = {
      userId: emp.userId,
      email: emp.user.email,
      fullName: emp.user.fullName,
      role: "EMPLOYEE",
      customerId: null,
      employeeId: emp.id,
      csrfToken: "csrf_emp",
      sessionId: "sess_emp",
    };

    const regA = await AuthService.registerCustomer({
      fullName: "Customer Alpha",
      email: "alpha@customer.in",
      password: "Cust@Billora2026!",
      confirmPassword: "Cust@Billora2026!",
      companyName: "Alpha Tech Pvt Ltd",
    });

    customerASession = {
      userId: regA.user.id,
      email: regA.user.email,
      fullName: regA.user.fullName,
      role: "CUSTOMER",
      customerId: regA.user.customerId,
      employeeId: null,
      csrfToken: regA.csrfToken,
      sessionId: "sess_cust_a",
    };

    const regB = await AuthService.registerCustomer({
      fullName: "Customer Beta",
      email: "beta@customer.in",
      password: "Cust@Billora2026!",
      confirmPassword: "Cust@Billora2026!",
      companyName: "Beta Corp Pvt Ltd",
    });

    customerBSession = {
      userId: regB.user.id,
      email: regB.user.email,
      fullName: regB.user.fullName,
      role: "CUSTOMER",
      customerId: regB.user.customerId,
      employeeId: null,
      csrfToken: regB.csrfToken,
      sessionId: "sess_cust_b",
    };
  });

  // Scenario 1: Duplicate email registration
  it("1. Rejects duplicate email registration with 409 Conflict", async () => {
    await expect(
      AuthService.registerCustomer({
        fullName: "Duplicate Alpha",
        email: "alpha@customer.in",
        password: "Cust@Billora2026!",
        confirmPassword: "Cust@Billora2026!",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
    });
  });

  // Scenario 2: Invalid password registration
  it("2. Rejects invalid password registration lacking complexity requirements", async () => {
    // Too short (8 chars instead of > 8)
    await expect(
      AuthService.registerCustomer({
        fullName: "Weak User",
        email: "weak1@customer.in",
        password: "Ab1!abcd",
        confirmPassword: "Ab1!abcd",
      })
    ).rejects.toThrow();

    // Missing uppercase
    await expect(
      AuthService.registerCustomer({
        fullName: "Weak User 2",
        email: "weak2@customer.in",
        password: "lowercase123!",
        confirmPassword: "lowercase123!",
      })
    ).rejects.toThrow();

    // Missing special char
    await expect(
      AuthService.registerCustomer({
        fullName: "Weak User 3",
        email: "weak3@customer.in",
        password: "NoSpecialChar123",
        confirmPassword: "NoSpecialChar123",
      })
    ).rejects.toThrow();
  });

  // Scenario 3: Unauthorized employee creation
  it("3. Prevents EMPLOYEE and CUSTOMER roles from creating employee accounts (403 Forbidden)", async () => {
    await expect(
      AuthService.createEmployee(employeeSession, {
        fullName: "Rogue Employee",
        email: "rogue1@billora.io",
        password: "Emp@Billora2026!",
        department: "Sales",
        designation: "Associate",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });

    await expect(
      AuthService.createEmployee(customerASession, {
        fullName: "Rogue Customer Emp",
        email: "rogue2@billora.io",
        password: "Emp@Billora2026!",
        department: "Sales",
        designation: "Associate",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  // Scenario 4: Unauthorized customer data access
  it("4. Blocks cross-customer data access with 403 Forbidden", async () => {
    await expect(
      AuthService.getCustomerById(customerASession, customerBSession.customerId!)
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  // Scenario 5: Product variant pricing & historical snapshot preservation
  it("5. Calculates Product Variant pricing accurately (Base + Variant Delta) and preserves snapshots", async () => {
    const product = await CatalogService.createProduct(adminSession, {
      name: "Business Software",
      productType: "SAAS",
      salesPrice: 1000,
      costPrice: 300,
      description: "Core ERP & Subscription Suite",
      status: "ACTIVE",
    });
    businessSoftwareProductId = product.id;

    const vStandard = await CatalogService.createProductVariant(adminSession, product.id, {
      name: "Standard",
      sku: "BSW-STD",
      additionalPrice: 0,
      status: "ACTIVE",
    });
    standardVariantId = vStandard.id;

    const vOdoo = await CatalogService.createProductVariant(adminSession, product.id, {
      name: "Odoo",
      sku: "BSW-ODOO",
      additionalPrice: 560,
      status: "ACTIVE",
    });
    odooVariantId = vOdoo.id;

    const vPremium = await CatalogService.createProductVariant(adminSession, product.id, {
      name: "Premium",
      sku: "BSW-PRM",
      additionalPrice: 1000,
      status: "ACTIVE",
    });
    premiumVariantId = vPremium.id;

    expect(toNumber2(vStandard.finalUnitPrice)).toBe(1000.0);
    expect(toNumber2(vOdoo.finalUnitPrice)).toBe(1560.0);
    expect(toNumber2(vPremium.finalUnitPrice)).toBe(2000.0);
  });

  // Scenario 10: Tax calculation (tested alongside catalog & quotation preview)
  it("10. Calculates configurable taxes accurately (₹1,000 + 18% GST = ₹180 tax, ₹1,180 total)", async () => {
    const gst18 = await CatalogService.createTaxRule(adminSession, {
      name: "GST 18%",
      taxType: "GST",
      percentage: 18,
      applicability: "ALL",
      effectiveFrom: new Date("2025-01-01T00:00:00Z"),
      isActive: true,
    });
    gst18TaxId = gst18.id;

    const preview = await QuotationService.computePricingPreview({
      lines: [
        {
          productId: businessSoftwareProductId,
          variantId: standardVariantId,
          quantity: 1,
          taxRuleId: gst18TaxId,
        },
      ],
    });

    expect(toNumber2(preview.subtotal)).toBe(1000.0);
    expect(toNumber2(preview.taxAmount)).toBe(180.0);
    expect(toNumber2(preview.totalAmount)).toBe(1180.0);
  });

  // Scenario 6: Monthly subscription billing
  it("6. Creates a Monthly Subscription from a Confirmed Quotation and bills accurately", async () => {
    const monthlyPlan = await CatalogService.createSubscriptionPlan(adminSession, {
      name: "Growth Monthly Plan",
      basePrice: 1000,
      billingFrequency: "MONTHLY",
      minQuantity: 1,
      allowEarlyCancel: true,
      allowPause: true,
      allowRenewal: true,
      defaultTermMonths: 12,
      status: "ACTIVE",
      productIds: [businessSoftwareProductId],
    });
    monthlyPlanId = monthlyPlan.id;

    // Employee creates quotation with Odoo variant (₹1,560) + 18% GST (₹280.80) = ₹1,840.80
    const quote = await QuotationService.createQuotation(employeeSession, {
      customerId: customerASession.customerId!,
      planId: monthlyPlanId,
      validityDays: 15,
      lines: [
        {
          productId: businessSoftwareProductId,
          variantId: odooVariantId,
          quantity: 1,
          taxRuleId: gst18TaxId,
        },
      ],
    });

    expect(toNumber2(quote.subtotal)).toBe(1560.0);
    expect(toNumber2(quote.taxAmount)).toBe(280.8);
    expect(toNumber2(quote.totalAmount)).toBe(1840.8);

    await QuotationService.updateQuotationStatus(employeeSession, quote.id, "CONFIRMED");

    const startDate = new Date("2026-01-15T00:00:00.000Z");
    const sub = await QuotationService.convertToSubscription(employeeSession, quote.id, {
      activateImmediately: true,
      startDate,
    });

    expect(sub.status).toBe("ACTIVE");
    expect(toNumber2(sub.totalAmount)).toBe(1840.8);

    // Now change product base price from ₹1,000 to ₹1,250 and verify existing subscription line snapshot is unchanged!
    await CatalogService.updateProduct(adminSession, businessSoftwareProductId, {
      salesPrice: 1250,
    });

    const billResult = await BillingEngineService.billSubscriptionPeriod(
      sub.id,
      new Date("2026-01-15T12:00:00.000Z")
    );
    expect(billResult.status).toBe("GENERATED");

    const generatedInv = await InvoiceService.getInvoiceById(adminSession, billResult.invoiceId!);
    expect(toNumber2(generatedInv.totalAmount)).toBe(1840.8);
    expect(toNumber2(generatedInv.lines[0].unitPrice)).toBe(1560.0);

    // Restore product base price back to ₹1,000 for subsequent tests
    await CatalogService.updateProduct(adminSession, businessSoftwareProductId, {
      salesPrice: 1000,
    });
  });

  // Scenario 7: Yearly subscription billing & leap year handling
  it("7. Calculates Yearly subscription billing dates accurately across leap years", async () => {
    const yearlyPlan = await CatalogService.createSubscriptionPlan(adminSession, {
      name: "Enterprise Yearly Plan",
      basePrice: 10000,
      billingFrequency: "YEARLY",
      minQuantity: 1,
      allowEarlyCancel: true,
      allowPause: true,
      allowRenewal: true,
      defaultTermMonths: 12,
      status: "ACTIVE",
    });
    yearlyPlanId = yearlyPlan.id;

    // Leap day start: Feb 29, 2024 -> 1 year later must clamp to Feb 28, 2025; 4 years later -> Feb 29, 2028
    const leapStart = new Date("2024-02-29T00:00:00.000Z");
    const year1 = calculateNextBillingDate(leapStart, "YEARLY", 29, 1);
    const year4 = calculateNextBillingDate(leapStart, "YEARLY", 29, 4);

    expect(year1.toISOString().slice(0, 10)).toBe("2025-02-28");
    expect(year4.toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  // Scenario 8: Month-end renewal clamping
  it("8. Clamps month-end renewals accurately without adding 30 days (Jan 31 -> Feb 28/29 -> Mar 31)", async () => {
    const jan31NonLeap = new Date("2026-01-31T00:00:00.000Z");
    const febEnd = calculateNextBillingDate(jan31NonLeap, "MONTHLY", 31, 1);
    const marEnd = calculateNextBillingDate(febEnd, "MONTHLY", 31, 1);
    const aprEnd = calculateNextBillingDate(marEnd, "MONTHLY", 31, 1);

    expect(febEnd.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(marEnd.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(aprEnd.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  // Scenario 9: Duplicate invoice prevention
  it("9. Prevents duplicate invoices when re-running billing for the same subscription and billing period", async () => {
    const sub = await SubscriptionService.createSubscription(employeeSession, {
      customerId: customerASession.customerId!,
      planId: monthlyPlanId,
      startDate: new Date("2026-02-01T00:00:00.000Z"),
      paymentTermsDays: 7,
      activateImmediately: true,
      lines: [
        {
          productId: businessSoftwareProductId,
          variantId: standardVariantId,
          quantity: 1,
          taxRuleId: gst18TaxId,
        },
      ],
    });

    const periodStart = new Date("2026-02-01T00:00:00.000Z");
    const firstRun = await BillingEngineService.billSubscriptionPeriod(
      sub.id,
      new Date("2026-02-02T00:00:00.000Z"),
      periodStart
    );
    expect(firstRun.status).toBe("GENERATED");

    // Re-running with the exact same periodStart must return SKIPPED_DUPLICATE and the existing invoiceId
    const secondRun = await BillingEngineService.billSubscriptionPeriod(
      sub.id,
      new Date("2026-02-02T00:00:00.000Z"),
      periodStart
    );
    expect(secondRun.status).toBe("SKIPPED_DUPLICATE");
    expect(secondRun.invoiceId).toBe(firstRun.invoiceId);

    const invoiceCountForSub = await prisma.invoice.count({
      where: { subscriptionId: sub.id },
    });
    expect(invoiceCountForSub).toBe(1);
  });

  // Scenario 20: Concurrent billing jobs
  it("20. Ensures concurrent billing jobs for the same subscription produce exactly 1 invoice", async () => {
    const sub = await SubscriptionService.createSubscription(employeeSession, {
      customerId: customerBSession.customerId!,
      planId: monthlyPlanId,
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      paymentTermsDays: 7,
      activateImmediately: true,
      lines: [
        {
          productId: businessSoftwareProductId,
          variantId: premiumVariantId,
          quantity: 2,
          taxRuleId: gst18TaxId,
        },
      ],
    });

    const periodStart = new Date("2026-03-01T00:00:00.000Z");
    const billTime = new Date("2026-03-02T00:00:00.000Z");

    const parallelResults = await Promise.all([
      BillingEngineService.billSubscriptionPeriod(sub.id, billTime, periodStart),
      BillingEngineService.billSubscriptionPeriod(sub.id, billTime, periodStart),
      BillingEngineService.billSubscriptionPeriod(sub.id, billTime, periodStart),
      BillingEngineService.billSubscriptionPeriod(sub.id, billTime, periodStart),
      BillingEngineService.billSubscriptionPeriod(sub.id, billTime, periodStart),
    ]);

    const generated = parallelResults.filter((r) => r.status === "GENERATED");
    const skipped = parallelResults.filter((r) => r.status === "SKIPPED_DUPLICATE");

    expect(generated.length).toBe(1);
    expect(skipped.length).toBe(4);

    const countInDb = await prisma.invoice.count({ where: { subscriptionId: sub.id } });
    expect(countInDb).toBe(1);
  });

  // Scenario 11: Discount validity (20% on ₹10,000 = ₹8,000 before tax, plus date/minimum checks)
  it("11. Validates discount rules and calculates ₹10,000 - 20% = ₹8,000 before tax", async () => {
    await DiscountService.createDiscount(adminSession, {
      code: "SAVE20",
      name: "20% Enterprise Discount",
      discountType: "PERCENTAGE",
      value: 20,
      minPurchaseAmount: 5000,
      minQuantity: 5,
      applicableToAll: true,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-12-31T23:59:59Z"),
      maxUsageCount: 10,
      isActive: true,
    });

    // 10 units of Standard (₹1,000 each) = ₹10,000 subtotal; 20% discount = ₹2,000; taxable = ₹8,000; 18% GST = ₹1,440; total = ₹9,440
    const preview = await QuotationService.computePricingPreview({
      discountCode: "SAVE20",
      evaluationDate: new Date("2026-06-01T00:00:00Z"),
      lines: [
        {
          productId: businessSoftwareProductId,
          variantId: standardVariantId,
          quantity: 10,
          taxRuleId: gst18TaxId,
        },
      ],
    });

    expect(toNumber2(preview.subtotal)).toBe(10000.0);
    expect(toNumber2(preview.discountAmount)).toBe(2000.0);
    expect(toNumber2(toNumber2(preview.subtotal) - toNumber2(preview.discountAmount))).toBe(8000.0);
    expect(toNumber2(preview.taxAmount)).toBe(1440.0);
    expect(toNumber2(preview.totalAmount)).toBe(9440.0);

    // Rejects when below minimum quantity/purchase amount
    await expect(
      QuotationService.computePricingPreview({
        discountCode: "SAVE20",
        evaluationDate: new Date("2026-06-01T00:00:00Z"),
        lines: [
          {
            productId: businessSoftwareProductId,
            variantId: standardVariantId,
            quantity: 2, // ₹2,000 < ₹5,000 minPurchaseAmount
          },
        ],
      })
    ).rejects.toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
    });

    // Rejects outside validity date window
    await expect(
      QuotationService.computePricingPreview({
        discountCode: "SAVE20",
        evaluationDate: new Date("2027-02-01T00:00:00Z"),
        lines: [
          {
            productId: businessSoftwareProductId,
            variantId: standardVariantId,
            quantity: 10,
          },
        ],
      })
    ).rejects.toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
    });
  });

  // Scenario 12: Discount usage limits under concurrency
  it("12. Enforces discount maxUsageCount atomically under concurrent requests", async () => {
    await DiscountService.createDiscount(adminSession, {
      code: "FLASH2",
      name: "Limited 2-Use Discount",
      discountType: "FIXED",
      value: 250,
      minPurchaseAmount: 500,
      minQuantity: 1,
      applicableToAll: true,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-12-31T23:59:59Z"),
      maxUsageCount: 2,
      isActive: true,
    });

    const attemptSubWithDiscount = () =>
      SubscriptionService.createSubscription(employeeSession, {
        customerId: customerASession.customerId!,
        planId: monthlyPlanId,
        startDate: new Date("2026-04-01T00:00:00Z"),
        discountCode: "FLASH2",
        lines: [
          {
            productId: businessSoftwareProductId,
            variantId: standardVariantId,
            quantity: 1,
          },
        ],
      });

    // Run 4 attempts; only 2 may succeed, and the remaining 2 must fail
    const settled = await Promise.allSettled([
      attemptSubWithDiscount(),
      attemptSubWithDiscount(),
      attemptSubWithDiscount(),
      attemptSubWithDiscount(),
    ]);

    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    const rejected = settled.filter((s) => s.status === "rejected");

    expect(fulfilled.length).toBe(2);
    expect(rejected.length).toBe(2);

    const flashDiscount = await prisma.discount.findUniqueOrThrow({ where: { code: "FLASH2" } });
    expect(flashDiscount.currentUsageCount).toBe(2);
  });

  // Scenarios 13 & 14: Partial payment and Full payment
  it("13 & 14. Handles partial payment (remains CONFIRMED) and full payment (transitions to PAID)", async () => {
    const sub = await SubscriptionService.createSubscription(employeeSession, {
      customerId: customerASession.customerId!,
      planId: monthlyPlanId,
      startDate: new Date("2026-05-01T00:00:00Z"),
      activateImmediately: true,
      lines: [
        {
          productId: businessSoftwareProductId,
          variantId: standardVariantId,
          quantity: 1,
          taxRuleId: gst18TaxId,
        },
      ],
    });

    const bill = await BillingEngineService.billSubscriptionPeriod(
      sub.id,
      new Date("2026-05-01T01:00:00Z")
    );
    const invoiceId = bill.invoiceId!;

    // Scenario 13: Partial payment of ₹500 on ₹1,180 invoice
    const partialRes = await PaymentService.recordPayment(employeeSession, {
      invoiceId,
      amount: 500,
      method: "UPI",
      transactionReference: "UPI-PARTIAL-001",
    });

    expect(partialRes.updatedInvoice.status).toBe("CONFIRMED");
    expect(toNumber2(partialRes.updatedInvoice.amountPaid)).toBe(500.0);
    expect(toNumber2(partialRes.updatedInvoice.outstandingAmount)).toBe(680.0);

    // Scenario 14: Remaining payment of ₹680 completes full settlement
    const fullRes = await PaymentService.recordPayment(employeeSession, {
      invoiceId,
      amount: 680,
      method: "BANK_TRANSFER",
      transactionReference: "NEFT-FULL-002",
    });

    expect(fullRes.updatedInvoice.status).toBe("PAID");
    expect(toNumber2(fullRes.updatedInvoice.amountPaid)).toBe(1180.0);
    expect(toNumber2(fullRes.updatedInvoice.outstandingAmount)).toBe(0.0);
    expect(fullRes.updatedInvoice.paidAt).not.toBeNull();
  });

  // Scenario 15: Overdue invoice identification
  it("15. Accurately identifies overdue invoices where dueDate < now and outstandingAmount > 0", async () => {
    const sub = await SubscriptionService.createSubscription(employeeSession, {
      customerId: customerBSession.customerId!,
      planId: monthlyPlanId,
      startDate: new Date("2026-01-01T00:00:00Z"),
      paymentTermsDays: 5,
      activateImmediately: true,
      lines: [
        {
          productId: businessSoftwareProductId,
          variantId: standardVariantId,
          quantity: 1,
        },
      ],
    });

    // Bill as of Jan 1, 2026 -> due date is Jan 6, 2026
    const billed = await BillingEngineService.billSubscriptionPeriod(
      sub.id,
      new Date("2026-01-01T00:00:00Z")
    );

    const overdueList = await InvoiceService.findOverdueInvoices(
      new Date("2026-02-01T00:00:00Z"),
      customerBSession.customerId!
    );

    expect(overdueList.some((inv) => inv.id === billed.invoiceId)).toBe(true);
  });

  // Scenarios 16 & 17: Subscription pause, resume, and cancellation rules
  it("16 & 17. Enforces pause/resume and cancellation lifecycle rules with SubscriptionHistory audit trail", async () => {
    const sub = await SubscriptionService.createSubscription(employeeSession, {
      customerId: customerASession.customerId!,
      planId: monthlyPlanId,
      startDate: new Date("2026-06-01T00:00:00Z"),
      activateImmediately: true,
      lines: [
        {
          productId: businessSoftwareProductId,
          variantId: standardVariantId,
          quantity: 1,
        },
      ],
    });

    // Scenario 17: Pause and Resume
    const paused = await SubscriptionService.transitionStatus(customerASession, sub.id, {
      action: "PAUSE",
      reason: "Seasonal pause",
    });
    expect(paused.status).toBe("PAUSED");

    const resumed = await SubscriptionService.transitionStatus(customerASession, sub.id, {
      action: "RESUME",
      reason: "Resuming operations",
    });
    expect(resumed.status).toBe("ACTIVE");

    // Scenario 16: Cancel
    const cancelled = await SubscriptionService.transitionStatus(customerASession, sub.id, {
      action: "CANCEL",
      reason: "Project completed",
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.history.length).toBeGreaterThanOrEqual(4);

    // Also verify plan that forbids customer pause/early cancel
    const lockedPlan = await CatalogService.createSubscriptionPlan(adminSession, {
      name: "Locked Annual Contract",
      basePrice: 5000,
      billingFrequency: "YEARLY",
      minQuantity: 1,
      allowEarlyCancel: false,
      allowPause: false,
      allowRenewal: true,
      defaultTermMonths: 12,
      status: "ACTIVE",
    });
    strictNoPauseCancelPlanId = lockedPlan.id;

    const lockedSub = await SubscriptionService.createSubscription(employeeSession, {
      customerId: customerASession.customerId!,
      planId: strictNoPauseCancelPlanId,
      activateImmediately: true,
      lines: [{ productId: businessSoftwareProductId, quantity: 1 }],
    });

    await expect(
      SubscriptionService.transitionStatus(customerASession, lockedSub.id, {
        action: "PAUSE",
      })
    ).rejects.toMatchObject({ code: "BUSINESS_RULE_VIOLATION" });

    await expect(
      SubscriptionService.transitionStatus(customerASession, lockedSub.id, {
        action: "CANCEL",
      })
    ).rejects.toMatchObject({ code: "BUSINESS_RULE_VIOLATION" });
  });

  // Scenario 18: Payment webhook verification & replay protection
  it("18. Verifies Razorpay payment & webhook HMAC signatures and prevents duplicate webhook processing", async () => {
    const sub = await SubscriptionService.createSubscription(employeeSession, {
      customerId: customerASession.customerId!,
      planId: monthlyPlanId,
      startDate: new Date("2026-07-01T00:00:00Z"),
      activateImmediately: true,
      lines: [{ productId: businessSoftwareProductId, quantity: 1 }],
    });
    const bill = await BillingEngineService.billSubscriptionPeriod(
      sub.id,
      new Date("2026-07-01T01:00:00Z")
    );

    const order = await PaymentService.createRazorpayOrder(customerASession, bill.invoiceId!);

    // Reject tampered signature
    await expect(
      PaymentService.verifyRazorpayPayment(customerASession, {
        razorpayOrderId: order.orderId,
        razorpayPaymentId: "pay_tampered123",
        razorpaySignature: "invalid_signature_hex",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    // Process valid webhook event
    const webhookPayload = JSON.stringify({
      id: "evt_razorpay_unique_001",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_webhook_verified_001",
            order_id: order.orderId,
            amount: order.amountInPaise,
            status: "captured",
          },
        },
      },
    });
    const validWebhookSig = PaymentService.computeRazorpayWebhookSignature(webhookPayload);

    const firstWebhook = await PaymentService.processRazorpayWebhook(
      webhookPayload,
      validWebhookSig
    );
    expect(firstWebhook.duplicate).toBe(false);

    // Replay the exact same webhook event -> must be marked duplicate and not double-credit
    const replayWebhook = await PaymentService.processRazorpayWebhook(
      webhookPayload,
      validWebhookSig
    );
    expect(replayWebhook.duplicate).toBe(true);

    const paidInv = await InvoiceService.getInvoiceById(customerASession, bill.invoiceId!);
    expect(paidInv.status).toBe("PAID");
    expect(toNumber2(paidInv.outstandingAmount)).toBe(0.0);
  });

  // Scenario 19: Dashboard aggregation accuracy & AI Assistant read-only parity
  it("19. Computes accurate SQL aggregations on the Executive Financial Dashboard and AI Assistant", async () => {
    const metrics = await AnalyticsService.getDashboardMetrics(adminSession, {
      preset: "CURRENT_YEAR",
    });

    expect(metrics.kpis.totalCustomers).toBeGreaterThanOrEqual(2);
    expect(metrics.kpis.activeSubscriptions).toBeGreaterThanOrEqual(1);
    expect(metrics.kpis.mrr).toBeGreaterThan(0);
    expect(metrics.kpis.arr).toBe(toNumber2(metrics.kpis.mrr * 12));
    expect(metrics.kpis.revenueCollected).toBeGreaterThan(0);
    expect(metrics.kpis.invoicedRevenue).toBeGreaterThanOrEqual(metrics.kpis.revenueCollected);

    const aiResponse = await AiAssistantService.answerQuery(
      adminSession,
      "What is our MRR and how many subscriptions are active?"
    );
    expect(aiResponse.metrics.activeSubscriptions).toBe(metrics.kpis.activeSubscriptions);
  });
});
