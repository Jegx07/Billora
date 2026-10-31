import { performance } from "node:perf_hooks";
import { prisma } from "../src/server/db/client";
import { AnalyticsService } from "../src/server/services/analytics.service";
import { AuthSessionContext, getSessionFromRequest, hashToken } from "../src/server/middlewares/auth";
import { NextRequest } from "next/server";

async function measureMs(label: string, fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  const elapsed = Number((performance.now() - start).toFixed(2));
  console.log(`   - ${label.padEnd(45)} : ${elapsed} ms`);
  return elapsed;
}

async function runBenchmark() {
  console.log("====================================================================");
  console.log(" BILLORA — PERFORMANCE BENCHMARK SUITE");
  console.log("====================================================================\n");

  // Warmup connection & let initial SQLite WAL pragma setup complete
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" } },
    include: { role: true },
  });
  const customerRecord = await prisma.customer.findFirst();
  await new Promise((r) => setTimeout(r, 100));

  if (!adminUser || !customerRecord) {
    throw new Error("Seeded admin user or customer not found");
  }

  // Create a temporary session token to benchmark getSessionFromRequest
  const rawToken = "benchmark_session_token_2026";
  const tokenHash = hashToken(rawToken);
  await prisma.session.upsert({
    where: { tokenHash },
    update: { expiresAt: new Date(Date.now() + 3600_000) },
    create: {
      tokenHash,
      csrfToken: "csrf_bench",
      userId: adminUser.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const adminSession: AuthSessionContext = {
    userId: adminUser.id,
    email: adminUser.email,
    fullName: adminUser.fullName,
    role: "ADMIN",
    customerId: null,
    employeeId: null,
    csrfToken: "csrf_bench",
    sessionId: "sess_bench",
  };

  console.log("Measuring Core Workloads:");

  const req = new NextRequest("http://localhost:3000/api/auth/me", {
    headers: { authorization: `Bearer ${rawToken}` },
  });

  const authCold = await measureMs("1. Auth Session Validation (1st call)", () =>
    getSessionFromRequest(req)
  );
  const authWarm = await measureMs("2. Auth Session Validation (2nd call)", () =>
    getSessionFromRequest(req)
  );

  const dashCold = await measureMs("3. Admin Dashboard Metrics (1st call)", () =>
    AnalyticsService.getDashboardMetrics(adminSession, { preset: "CURRENT_YEAR" })
  );
  const dashWarm = await measureMs("4. Admin Dashboard Metrics (2nd call)", () =>
    AnalyticsService.getDashboardMetrics(adminSession, { preset: "CURRENT_YEAR" })
  );

  const opsLoad = await measureMs("5. Operations Overview (11 parallel queries)", async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await Promise.all([
      prisma.workflow.count({ where: { status: "ACTIVE" } }),
      prisma.workflow.count(),
      prisma.workflowExecution.count({ where: { startedAt: { gte: oneDayAgo } } }),
      prisma.workflowTask.count({
        where: { assigneeId: adminSession.userId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      prisma.workflowTask.count({
        where: {
          assigneeId: adminSession.userId,
          dueDate: { lt: now },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      }),
      prisma.workflowTask.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
      prisma.workflowApproval.count({ where: { status: "PENDING" } }),
      prisma.emailMessage.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.workflowTask.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { customer: { select: { contactName: true } } },
      }),
      prisma.workflowExecution.findMany({
        take: 5,
        orderBy: { startedAt: "desc" },
        include: {
          workflow: { select: { name: true, workflowCode: true } },
          customer: { select: { contactName: true } },
        },
      }),
      prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, fullName: true, email: true, role: { select: { name: true } } },
        orderBy: { fullName: "asc" },
      }),
    ]);
  });

  const subsPage = await measureMs("6. Subscriptions Table Page (2,003 records)", async () => {
    await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, customerCode: true, contactName: true, companyName: true, email: true },
          },
          plan: {
            select: { id: true, name: true, billingFrequency: true },
          },
          _count: { select: { invoices: true, lines: true } },
        },
      }),
    ]);
  });

  const invPage = await measureMs("7. Invoices Table Page (823 records)", async () => {
    await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.findMany({
        take: 20,
        orderBy: { invoiceDate: "desc" },
        include: {
          customer: {
            select: { id: true, customerCode: true, contactName: true, companyName: true },
          },
          subscription: {
            select: { id: true, subscriptionNumber: true, billingFrequency: true },
          },
          _count: { select: { payments: true, lines: true } },
        },
      }),
    ]);
  });

  const portalLoad = await measureMs("8. Customer Portal Overview", async () => {
    await Promise.all([
      prisma.customer.findUnique({ where: { id: customerRecord.id } }),
      prisma.subscription.findMany({
        where: { customerId: customerRecord.id },
        take: 25,
        include: { plan: true, lines: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { customerId: customerRecord.id },
        take: 25,
        include: { subscription: { select: { subscriptionNumber: true } } },
        orderBy: { invoiceDate: "desc" },
      }),
      prisma.payment.findMany({
        where: { customerId: customerRecord.id },
        take: 25,
        include: { invoice: { select: { invoiceNumber: true } } },
        orderBy: { paymentDate: "desc" },
      }),
      prisma.subscriptionPlan.findMany({ where: { status: "ACTIVE" } }),
    ]);
  });

  const mutationLatency = await measureMs(
    "9. Database Mutation (User lastLoginAt update)",
    async () => {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { lastLoginAt: new Date() },
      });
    }
  );

  console.log("\nSummary JSON:");
  console.log(
    JSON.stringify({
      authCold,
      authWarm,
      dashCold,
      dashWarm,
      opsLoad,
      subsPage,
      invPage,
      portalLoad,
      mutationLatency,
    })
  );
}

runBenchmark()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
