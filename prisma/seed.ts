import { calculateNextBillingDate } from "../src/lib/dates";
import { round2 } from "../src/lib/money";
import { prisma } from "../src/server/db/client";
import { hashPassword } from "../src/server/middlewares/auth";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("ABORT: Development seed script (seed:dev) must never run in production!");
  }

  console.log("🚀 Starting Billora Development Seed (1 Admin, 3 Employees, 50 Customers, 2,000 Subscriptions)...");
  const startTime = Date.now();

  // Clear existing data in dependency order
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
  await prisma.role.deleteMany();

  // 1. Roles
  const adminRole = await prisma.role.create({
    data: { name: "ADMIN", description: "System Administrator" },
  });
  const empRole = await prisma.role.create({
    data: { name: "EMPLOYEE", description: "Operations Employee" },
  });
  const custRole = await prisma.role.create({
    data: { name: "CUSTOMER", description: "Self-Service Portal Customer" },
  });

  // 2. Password hashes (computed once per role for fast seeding)
  const adminHash = hashPassword("Admin@Billora2026!");
  const empHash = hashPassword("Emp@Billora2026!");
  const custHash = hashPassword("Cust@Billora2026!");

  // 3. Create 1 Administrator
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@billora.io",
      fullName: "Vikramaditya Rao (Admin)",
      passwordHash: adminHash,
      roleId: adminRole.id,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  // 4. Create 3 Employees
  const employeeSpecs = [
    {
      code: "EMP-101",
      email: "arjun.mehta@billora.io",
      name: "Arjun Mehta",
      dept: "Revenue Operations",
      title: "Senior Billing Specialist",
      phone: "+91 98201 11200",
    },
    {
      code: "EMP-102",
      email: "neha.kapoor@billora.io",
      name: "Neha Kapoor",
      dept: "Enterprise Sales",
      title: "Account Executive",
      phone: "+91 98201 11201",
    },
    {
      code: "EMP-103",
      email: "rohan.desai@billora.io",
      name: "Rohan Desai",
      dept: "Customer Success",
      title: "Renewal Manager",
      phone: "+91 98201 11202",
    },
  ];

  const employees = [];
  for (const spec of employeeSpecs) {
    const u = await prisma.user.create({
      data: {
        email: spec.email,
        fullName: spec.name,
        passwordHash: empHash,
        roleId: empRole.id,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const emp = await prisma.employee.create({
      data: {
        employeeCode: spec.code,
        userId: u.id,
        department: spec.dept,
        designation: spec.title,
        phone: spec.phone,
      },
    });
    employees.push(emp);
  }

  // 5. Create 50 Customers
  const indianCities = [
    { city: "Bengaluru", state: "Karnataka", pin: "560001", gstPrefix: "29" },
    { city: "Mumbai", state: "Maharashtra", pin: "400001", gstPrefix: "27" },
    { city: "Hyderabad", state: "Telangana", pin: "500081", gstPrefix: "36" },
    { city: "Pune", state: "Maharashtra", pin: "411001", gstPrefix: "27" },
    { city: "Chennai", state: "Tamil Nadu", pin: "600002", gstPrefix: "33" },
    { city: "Gurugram", state: "Haryana", pin: "122002", gstPrefix: "06" },
  ];

  const customers = [];
  for (let i = 1; i <= 50; i++) {
    const isPrimaryDemo = i === 1;
    const email = isPrimaryDemo
      ? "priya.sharma@acmeindia.in"
      : `finance.team.${i}@enterprise-client-${i}.in`;
    const contactName = isPrimaryDemo ? "Priya Sharma" : `Ananya Nair (${i})`;
    const companyName = isPrimaryDemo
      ? "Acme Cloud Technologies Pvt Ltd"
      : `Nakshatra Systems ${i} Pvt Ltd`;
    const loc = indianCities[i % indianCities.length];

    const u = await prisma.user.create({
      data: {
        email,
        fullName: contactName,
        passwordHash: custHash,
        roleId: custRole.id,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    const c = await prisma.customer.create({
      data: {
        customerCode: `CUST-${String(1000 + i).padStart(4, "0")}`,
        userId: u.id,
        contactName,
        companyName,
        email,
        phone: `+91 98110 ${String(10000 + i)}`,
        gstin: `${loc.gstPrefix}AAACB${String(1000 + i)}F1Z5`,
        billingAddress: `Level ${(i % 9) + 1}, Prestige Tech Park, Outer Ring Road`,
        city: loc.city,
        state: loc.state,
        country: "India",
        postalCode: loc.pin,
        assignedEmployeeId: employees[i % employees.length].id,
      },
    });
    customers.push({ customer: c, userId: u.id });
  }

  // 6. Tax Rules
  const gst18 = await prisma.taxRule.create({
    data: {
      name: "GST 18%",
      taxType: "GST",
      percentage: round2(18),
      applicability: "ALL",
      effectiveFrom: new Date("2025-01-01T00:00:00Z"),
      isActive: true,
    },
  });
  const gst12 = await prisma.taxRule.create({
    data: {
      name: "GST 12% (Concessional)",
      taxType: "GST",
      percentage: round2(12),
      applicability: "SERVICE",
      effectiveFrom: new Date("2025-01-01T00:00:00Z"),
      isActive: true,
    },
  });
  await prisma.taxRule.create({
    data: {
      name: "Export Zero-Rated (0%)",
      taxType: "IGST",
      percentage: round2(0),
      applicability: "EXPORT",
      effectiveFrom: new Date("2025-01-01T00:00:00Z"),
      isActive: true,
    },
  });

  // 7. Products & Variants (including Section 6 spec example: Business Software ₹1,000 + Standard ₹0 / Odoo ₹560 / Premium ₹1,000)
  const prodBusinessSoftware = await prisma.product.create({
    data: {
      productCode: "PRD-101",
      name: "Business Software",
      productType: "SAAS",
      salesPrice: round2(1000),
      costPrice: round2(280),
      description: "Core Unified ERP, Billing & Subscription Management Suite",
      notes: "Flagship multi-tenant SaaS license",
      status: "ACTIVE",
    },
  });

  const varStandard = await prisma.productVariant.create({
    data: {
      productId: prodBusinessSoftware.id,
      name: "Standard",
      sku: "BSW-STD-001",
      additionalPrice: round2(0),
      status: "ACTIVE",
    },
  });
  const varOdoo = await prisma.productVariant.create({
    data: {
      productId: prodBusinessSoftware.id,
      name: "Odoo",
      sku: "BSW-ODOO-002",
      additionalPrice: round2(560),
      status: "ACTIVE",
    },
  });
  const varPremium = await prisma.productVariant.create({
    data: {
      productId: prodBusinessSoftware.id,
      name: "Premium",
      sku: "BSW-PRM-003",
      additionalPrice: round2(1000),
      status: "ACTIVE",
    },
  });

  const prodRevenueIntel = await prisma.product.create({
    data: {
      productCode: "PRD-102",
      name: "Revenue Intelligence & Cohort Analytics",
      productType: "ADDON",
      salesPrice: round2(2500),
      costPrice: round2(600),
      description: "Automated MRR/ARR forecasting, dunning recovery, and executive reporting",
      status: "ACTIVE",
    },
  });
  const varRevPro = await prisma.productVariant.create({
    data: {
      productId: prodRevenueIntel.id,
      name: "Enterprise Node",
      sku: "REV-ENT-001",
      additionalPrice: round2(1500),
      status: "ACTIVE",
    },
  });

  const prodApiGateway = await prisma.product.create({
    data: {
      productCode: "PRD-103",
      name: "Dedicated Webhook & API Gateway",
      productType: "SERVICE",
      salesPrice: round2(1800),
      costPrice: round2(450),
      description: "High-throughput dedicated webhook cluster with 99.99% SLA",
      status: "ACTIVE",
    },
  });

  // 8. Subscription Plans (all 4 frequencies: DAILY, WEEKLY, MONTHLY, YEARLY)
  const planMonthly = await prisma.subscriptionPlan.create({
    data: {
      planCode: "PLN-MON-101",
      name: "Growth Monthly Subscription",
      description: "Flexible monthly billing with month-end clamping and self-service pause",
      basePrice: round2(1000),
      billingFrequency: "MONTHLY",
      minQuantity: 1,
      allowEarlyCancel: true,
      allowPause: true,
      allowRenewal: true,
      defaultTermMonths: 12,
      status: "ACTIVE",
      planProducts: {
        create: [{ productId: prodBusinessSoftware.id, defaultQuantity: 1, includedInBase: true }],
      },
    },
  });

  const planYearly = await prisma.subscriptionPlan.create({
    data: {
      planCode: "PLN-YEA-102",
      name: "Enterprise Annual Commitment",
      description: "Annual contract with priority support and volume licensing",
      basePrice: round2(12000),
      billingFrequency: "YEARLY",
      minQuantity: 2,
      allowEarlyCancel: false,
      allowPause: true,
      allowRenewal: true,
      defaultTermMonths: 12,
      status: "ACTIVE",
      planProducts: {
        create: [
          { productId: prodBusinessSoftware.id, defaultQuantity: 2, includedInBase: true },
          { productId: prodRevenueIntel.id, defaultQuantity: 1, includedInBase: false },
        ],
      },
    },
  });

  const planWeekly = await prisma.subscriptionPlan.create({
    data: {
      planCode: "PLN-WEE-103",
      name: "Agile Weekly Sprint Plan",
      description: "Weekly recurring billing for short-term consulting & cloud bursts",
      basePrice: round2(650),
      billingFrequency: "WEEKLY",
      minQuantity: 1,
      allowEarlyCancel: true,
      allowPause: true,
      allowRenewal: true,
      defaultTermMonths: 6,
      status: "ACTIVE",
    },
  });

  const planDaily = await prisma.subscriptionPlan.create({
    data: {
      planCode: "PLN-DAI-104",
      name: "Metered Daily Sandbox Plan",
      description: "Daily recurring billing for staging environments",
      basePrice: round2(150),
      billingFrequency: "DAILY",
      minQuantity: 1,
      allowEarlyCancel: true,
      allowPause: false,
      allowRenewal: true,
      defaultTermMonths: 1,
      status: "ACTIVE",
    },
  });

  // 9. Discounts
  const discountEnt20 = await prisma.discount.create({
    data: {
      code: "ENTERPRISE20",
      name: "20% Enterprise Launch Discount",
      discountType: "PERCENTAGE",
      value: round2(20),
      minPurchaseAmount: round2(1000),
      minQuantity: 1,
      applicableToAll: true,
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2027-12-31T23:59:59Z"),
      maxUsageCount: 500,
      currentUsageCount: 14,
      isActive: true,
    },
  });

  await prisma.discount.create({
    data: {
      code: "FLAT500",
      name: "₹500 Instant Rebate",
      discountType: "FIXED",
      value: round2(500),
      minPurchaseAmount: round2(2000),
      minQuantity: 1,
      applicableToAll: true,
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2027-12-31T23:59:59Z"),
      maxUsageCount: 250,
      currentUsageCount: 8,
      isActive: true,
    },
  });

  // 10. Quotation Templates & Sample Quotations
  const template1 = await prisma.quotationTemplate.create({
    data: {
      name: "Standard Odoo Suite Proposal",
      description: "Pre-configured monthly proposal with Business Software (Odoo variant) + GST 18%",
      planId: planMonthly.id,
      validityDays: 15,
      taxRuleId: gst18.id,
      isActive: true,
      lines: {
        create: [
          {
            productId: prodBusinessSoftware.id,
            variantId: varOdoo.id,
            defaultQuantity: 2,
          },
        ],
      },
    },
  });

  for (let qIdx = 1; qIdx <= 12; qIdx++) {
    const cust = customers[(qIdx - 1) % customers.length].customer;
    const statuses = ["DRAFT", "QUOTATION", "CONFIRMED", "EXPIRED", "CANCELLED"];
    const qStatus = statuses[qIdx % statuses.length];
    const qty = (qIdx % 4) + 1;
    const unitPrice = 1560; // Base 1000 + Odoo 560
    const sub = unitPrice * qty;
    const tax = round2(sub * 0.18);
    const tot = round2(sub + tax.toNumber());

    await prisma.quotation.create({
      data: {
        quotationNumber: `QT-2026-${String(1000 + qIdx).padStart(4, "0")}`,
        customerId: cust.id,
        planId: planMonthly.id,
        templateId: template1.id,
        status: qStatus,
        issueDate: new Date(Date.now() - qIdx * 2 * 86400000),
        expiryDate: new Date(Date.now() + (15 - qIdx) * 86400000),
        subtotal: round2(sub),
        discountAmount: round2(0),
        taxAmount: tax,
        totalAmount: tot,
        createdById: employees[0].userId,
        lines: {
          create: [
            {
              productId: prodBusinessSoftware.id,
              variantId: varOdoo.id,
              description: "Business Software (Odoo)",
              quantity: qty,
              baseUnitPrice: round2(1000),
              variantPriceDelta: round2(560),
              unitPrice: round2(1560),
              taxRuleId: gst18.id,
              taxRateSnapshot: round2(18),
              lineSubtotal: round2(sub),
              lineDiscountAmount: round2(0),
              lineTaxAmount: tax,
              lineTotal: tot,
            },
          ],
        },
      },
    });
  }

  // 11. Batch-create 2,000 Subscriptions with Lines, Invoices, and Payments for scale & performance testing
  const TOTAL_SUBSCRIPTIONS = 2000;
  const plansPool = [planMonthly, planMonthly, planMonthly, planYearly, planWeekly, planDaily];
  const variantsPool = [
    { prod: prodBusinessSoftware, var: varStandard, base: 1000, delta: 0 },
    { prod: prodBusinessSoftware, var: varOdoo, base: 1000, delta: 560 },
    { prod: prodBusinessSoftware, var: varPremium, base: 1000, delta: 1000 },
    { prod: prodRevenueIntel, var: varRevPro, base: 2500, delta: 1500 },
    { prod: prodApiGateway, var: null, base: 1800, delta: 0 },
  ];

  const now = new Date();
  const subRows = [];
  const subLineRows = [];
  const subHistoryRows = [];
  const invoiceRows = [];
  const invoiceLineRows = [];
  const paymentRows = [];

  for (let i = 1; i <= TOTAL_SUBSCRIPTIONS; i++) {
    const subId = `sub_seed_${i}`;
    const custEntry = customers[(i - 1) % customers.length];
    const plan = plansPool[i % plansPool.length];
    const vPick = variantsPool[i % variantsPool.length];
    const qty = (i % 3) + 1;
    const unitPrice = vPick.base + vPick.delta;
    const lineSub = unitPrice * qty;
    const taxAmt = Math.round(lineSub * 18) / 100;
    const totalAmt = Math.round((lineSub + taxAmt) * 100) / 100;

    // Distribute dates across the last 10 months so monthly trends & cohorts are rich
    const monthsAgo = i % 10;
    const dayOfMonth = (i % 28) + 1;
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, dayOfMonth, 9, 0, 0)
    );

    // Status distribution: ~78% ACTIVE, ~8% CONFIRMED, ~6% PAUSED, ~6% CANCELLED, ~2% EXPIRED
    let status = "ACTIVE";
    if (i % 15 === 0) status = "CANCELLED";
    else if (i % 17 === 0) status = "PAUSED";
    else if (i % 13 === 0) status = "CONFIRMED";
    else if (i % 45 === 0) status = "EXPIRED";

    // Make ~25 active subscriptions due right now (or within next 7 days) so billing runs & upcoming renewals work immediately
    let nextBillingDate: Date;
    if (status === "ACTIVE" && i <= 25) {
      nextBillingDate = new Date(now.getTime() - (26 - i) * 3600 * 1000); // Due now!
    } else if (status === "ACTIVE" && i <= 65) {
      nextBillingDate = new Date(now.getTime() + ((i % 7) + 1) * 86400000); // Renewing this week!
    } else {
      nextBillingDate = calculateNextBillingDate(
        now,
        plan.billingFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
        dayOfMonth
      );
    }

    const periodEnd = calculateNextBillingDate(
      startDate,
      plan.billingFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
      dayOfMonth
    );

    subRows.push({
      id: subId,
      subscriptionNumber: `SUB-2026-${String(i).padStart(5, "0")}`,
      customerId: custEntry.customer.id,
      planId: plan.id,
      discountId: i % 20 === 0 ? discountEnt20.id : null,
      status,
      billingFrequency: plan.billingFrequency,
      paymentTermsDays: 7,
      startDate,
      expiryDate: new Date(startDate.getTime() + 365 * 86400000),
      anchorBillingDay: dayOfMonth,
      currentPeriodStart: startDate,
      currentPeriodEnd: periodEnd,
      nextBillingDate,
      pausedAt: status === "PAUSED" ? new Date(now.getTime() - 5 * 86400000) : null,
      cancelledAt: status === "CANCELLED" ? new Date(now.getTime() - 3 * 86400000) : null,
      cancellationReason: status === "CANCELLED" ? "Consolidated vendor contract" : null,
      subtotal: round2(lineSub),
      discountAmount: round2(0),
      taxAmount: round2(taxAmt),
      totalAmount: round2(totalAmt),
      timezone: "Asia/Kolkata",
      createdAt: startDate,
      updatedAt: startDate,
    });

    subLineRows.push({
      id: `subline_seed_${i}`,
      subscriptionId: subId,
      productId: vPick.prod.id,
      variantId: vPick.var?.id ?? null,
      productNameSnapshot: vPick.prod.name,
      variantNameSnapshot: vPick.var?.name ?? null,
      quantity: qty,
      baseUnitPrice: round2(vPick.base),
      variantPriceDelta: round2(vPick.delta),
      unitPrice: round2(unitPrice),
      taxRuleId: gst18.id,
      taxNameSnapshot: gst18.name,
      taxRateSnapshot: round2(18),
      lineSubtotal: round2(lineSub),
      lineDiscountAmount: round2(0),
      lineTaxAmount: round2(taxAmt),
      lineTotal: round2(totalAmt),
    });

    subHistoryRows.push({
      id: `subhist_seed_${i}`,
      subscriptionId: subId,
      fromStatus: "CONFIRMED",
      toStatus: status,
      action: status === "ACTIVE" ? "ACTIVATE" : status,
      actorUserId: adminUser.id,
      reason: "Initial subscription lifecycle transition",
      createdAt: startDate,
    });

    // Generate historical invoices & payments for the first 800 subscriptions
    if (i > 25 && i <= 825) {
      const invId = `inv_seed_${i}`;
      const isPaid = i % 5 !== 0; // 80% PAID, 20% CONFIRMED (some overdue, some partial)
      const isPartial = !isPaid && i % 10 === 0;
      const isOverdue = !isPaid && i % 2 === 0;

      const invDate = startDate;
      const dueDate = isOverdue
        ? new Date(now.getTime() - ((i % 20) + 2) * 86400000)
        : new Date(now.getTime() + 10 * 86400000);

      const paidAmt = isPaid ? totalAmt : isPartial ? Math.round(totalAmt * 50) / 100 : 0;
      const outAmt = Math.round((totalAmt - paidAmt) * 100) / 100;
      const idemKey = `bill_${subId}_${startDate.toISOString().slice(0, 10)}_${periodEnd
        .toISOString()
        .slice(0, 10)}`;

      invoiceRows.push({
        id: invId,
        invoiceNumber: `INV-2026-${String(i).padStart(5, "0")}`,
        customerId: custEntry.customer.id,
        subscriptionId: subId,
        billingPeriodStart: startDate,
        billingPeriodEnd: periodEnd,
        idempotencyKey: idemKey,
        invoiceDate: invDate,
        dueDate,
        status: isPaid ? "PAID" : "CONFIRMED",
        subtotal: round2(lineSub),
        discountAmount: round2(0),
        taxAmount: round2(taxAmt),
        totalAmount: round2(totalAmt),
        amountPaid: round2(paidAmt),
        outstandingAmount: round2(outAmt),
        paidAt: isPaid ? new Date(invDate.getTime() + 2 * 86400000) : null,
        notes: `Recurring billing invoice for SUB-2026-${String(i).padStart(5, "0")}`,
        createdAt: invDate,
        updatedAt: invDate,
      });

      invoiceLineRows.push({
        id: `invline_seed_${i}`,
        invoiceId: invId,
        productId: vPick.prod.id,
        variantId: vPick.var?.id ?? null,
        productNameSnapshot: vPick.prod.name,
        variantNameSnapshot: vPick.var?.name ?? null,
        description: vPick.var ? `${vPick.prod.name} (${vPick.var.name})` : vPick.prod.name,
        quantity: qty,
        baseUnitPrice: round2(vPick.base),
        variantPriceDelta: round2(vPick.delta),
        unitPrice: round2(unitPrice),
        taxRuleId: gst18.id,
        taxNameSnapshot: gst18.name,
        taxRateSnapshot: round2(18),
        lineSubtotal: round2(lineSub),
        lineDiscountAmount: round2(0),
        lineTaxAmount: round2(taxAmt),
        lineTotal: round2(totalAmt),
      });

      if (paidAmt > 0) {
        const methods = ["UPI", "BANK_TRANSFER", "RAZORPAY", "CREDIT_CARD", "DEBIT_CARD"];
        paymentRows.push({
          id: `pay_seed_${i}`,
          paymentNumber: `PAY-2026-${String(i).padStart(5, "0")}`,
          invoiceId: invId,
          customerId: custEntry.customer.id,
          method: methods[i % methods.length],
          amount: round2(paidAmt),
          refundedAmount: round2(0),
          paymentDate: new Date(invDate.getTime() + 86400000),
          transactionReference: `TXN-SEED-${String(i).padStart(6, "0")}`,
          status: "VERIFIED",
          recordedById: adminUser.id,
          createdAt: new Date(invDate.getTime() + 86400000),
          updatedAt: new Date(invDate.getTime() + 86400000),
        });
      }
    }
  }

  // Insert in chunks of 400 to respect SQLite variable limits
  const chunkInsert = async <T>(items: T[], fn: (chunk: T[]) => Promise<unknown>) => {
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      await fn(items.slice(i, i + chunkSize));
    }
  };

  await chunkInsert(subRows, (chunk) => prisma.subscription.createMany({ data: chunk }));
  await chunkInsert(subLineRows, (chunk) => prisma.subscriptionLine.createMany({ data: chunk }));
  await chunkInsert(subHistoryRows, (chunk) =>
    prisma.subscriptionHistory.createMany({ data: chunk })
  );
  await chunkInsert(invoiceRows, (chunk) => prisma.invoice.createMany({ data: chunk }));
  await chunkInsert(invoiceLineRows, (chunk) => prisma.invoiceLine.createMany({ data: chunk }));
  await chunkInsert(paymentRows, (chunk) => prisma.payment.createMany({ data: chunk }));

  // Create sample notifications for Admin and Primary Demo Customer
  await prisma.notification.createMany({
    data: [
      {
        userId: adminUser.id,
        eventType: "INVOICE_GENERATED",
        title: "Automated Billing Engine Ready",
        message: "25 active subscriptions are currently due for recurring invoice generation.",
        channel: "IN_APP",
        deliveryStatus: "DELIVERED",
      },
      {
        userId: customers[0].userId,
        eventType: "WELCOME",
        title: "Welcome to Billora Customer Portal",
        message: "Manage your Acme Cloud subscriptions, download GST invoices, and pay online.",
        channel: "BOTH",
        deliveryStatus: "DELIVERED",
      },
    ],
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `✅ Seed completed in ${elapsed}s: 1 Admin, 3 Employees, 50 Customers, ${subRows.length} Subscriptions, ${invoiceRows.length} Invoices, ${paymentRows.length} Payments.`
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
