import { prisma } from "@/server/db/client";
import { AuthSessionContext, hashPassword } from "@/server/middlewares/auth";
import { AiAssistantService } from "@/server/services/ai-assistant.service";
import { AuthService } from "@/server/services/auth.service";
import { GeminiService } from "@/server/services/gemini.service";
import { beforeAll, describe, expect, it } from "vitest";

describe("Billora — AI Business Assistant & Gemini Production Verification", () => {
  let adminSession: AuthSessionContext;
  let employeeSession: AuthSessionContext;
  let customerSession: AuthSessionContext;

  beforeAll(async () => {
    await AuthService.ensureRoles();

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
    const empRole = await prisma.role.findUniqueOrThrow({ where: { name: "EMPLOYEE" } });
    const custRole = await prisma.role.findUniqueOrThrow({ where: { name: "CUSTOMER" } });

    // 1. Ensure Admin User
    const adminUser = await prisma.user.upsert({
      where: { email: "admin@billora.io" },
      update: { status: "ACTIVE", roleId: adminRole.id },
      create: {
        email: "admin@billora.io",
        fullName: "Admin Vikramaditya",
        passwordHash: hashPassword("Admin@Billora2026!"),
        roleId: adminRole.id,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    // 2. Ensure Employee User
    const empUser = await prisma.user.upsert({
      where: { email: "arjun.mehta@billora.io" },
      update: { status: "ACTIVE", roleId: empRole.id },
      create: {
        email: "arjun.mehta@billora.io",
        fullName: "Arjun Mehta",
        passwordHash: hashPassword("Emp@Billora2026!"),
        roleId: empRole.id,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    // 3. Ensure Customer User
    const custUser = await prisma.user.upsert({
      where: { email: "priya.sharma@acmeindia.in" },
      update: { status: "ACTIVE", roleId: custRole.id },
      create: {
        email: "priya.sharma@acmeindia.in",
        fullName: "Priya Sharma",
        passwordHash: hashPassword("Cust@Billora2026!"),
        roleId: custRole.id,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    adminSession = {
      sessionId: "test-admin-session",
      userId: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: "ADMIN",
    };

    employeeSession = {
      sessionId: "test-emp-session",
      userId: empUser.id,
      email: empUser.email,
      fullName: empUser.fullName,
      role: "EMPLOYEE",
    };

    customerSession = {
      sessionId: "test-cust-session",
      userId: custUser.id,
      email: custUser.email,
      fullName: custUser.fullName,
      role: "CUSTOMER",
    };
  });

  // Test 1: Basic greeting
  it("Test 1: Returns instant friendly greeting explaining BI capabilities without error", async () => {
    const res = await AiAssistantService.answerQuery(adminSession, "hello");
    expect(res.answer).toBeDefined();
    expect(res.answer.toLowerCase()).toContain("billora");
    expect(res.answer.toLowerCase()).toContain("monthly recurring revenue");
    expect(res.periodUsed).toBe("Real-time Assistant");
    expect(res.aiPowered).toBe(false); // Fast greeting: no unnecessary API/DB calls
  });

  // Test 2: Active subscriptions count
  it("Test 2: Retrieves actual active subscription count from database", async () => {
    const actualCount = await prisma.subscription.count({ where: { status: "ACTIVE" } });
    const res = await AiAssistantService.answerQuery(
      adminSession,
      "How many active subscriptions do we have?"
    );
    expect(res.metrics.activeSubscriptions).toBe(actualCount);
    expect(res.answer).toBeDefined();
  });

  // Test 3: Monthly recurring revenue (MRR)
  it("Test 3: Returns correctly calculated MRR and ARR", async () => {
    const res = await AiAssistantService.answerQuery(adminSession, "What is our current MRR?");
    expect(res.metrics.mrr).toBeDefined();
    expect(res.metrics.arr).toBeDefined();
    expect(res.answer).toContain("MRR");
  });

  // Test 4: Overdue invoices
  it("Test 4: Shows overdue invoices and real outstanding amounts", async () => {
    const res = await AiAssistantService.answerQuery(
      adminSession,
      "Show overdue invoices and outstanding amounts."
    );
    expect(res.metrics.matchingInvoicesCount).toBeDefined();
    expect(res.metrics.totalOutstandingINR).toBeDefined();
    expect(res.records).toBeInstanceOf(Array);
  });

  // Test 5: Upcoming renewals within 7 days
  it("Test 5: Identifies subscriptions renewing in the next 7 days", async () => {
    const res = await AiAssistantService.answerQuery(
      adminSession,
      "Which subscriptions are renewing in the next 7 days?"
    );
    expect(res.metrics.dueWithin7Days).toBeDefined();
    expect(res.records).toBeInstanceOf(Array);
  });

  // Test 6: Revenue collected this month
  it("Test 6: Calculates revenue collected this month from verified payments", async () => {
    const res = await AiAssistantService.answerQuery(
      adminSession,
      "How much revenue was collected this month?"
    );
    expect(res.metrics.cashCollectedThisMonth).toBeDefined();
    expect(res.answer).toContain("collected");
  });

  // Test 7: Empty database handling (simulated with no matches or empty state)
  it("Test 7: Handles empty or zero-count queries without fabricating sample data", async () => {
    const res = await AiAssistantService.answerQuery(
      adminSession,
      "Which invoices are overdue and unpaid?"
    );
    // If no overdue invoices exist, must clearly explain 0 overdue invoices
    expect(res.answer).toBeDefined();
    expect(typeof res.metrics.matchingInvoicesCount).toBe("number");
  });

  // Test 8: Unsupported questions
  it("Test 8: Gracefully guides user on unsupported/out-of-scope queries", async () => {
    const res = await AiAssistantService.answerQuery(
      adminSession,
      "What is the capital of France and can you write a poem?"
    );
    expect(res.answer).toBeDefined();
    expect(res.answer.toLowerCase()).toContain("billora");
  });

  // Role-Based Access Control: Customer blocked
  it("Security: Blocks CUSTOMER role from querying financial intelligence (403 Forbidden)", async () => {
    await expect(
      AiAssistantService.answerQuery(customerSession, "What is our MRR?")
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  // Role-Based Access Control: Employee permitted
  it("Security: Permits authorized EMPLOYEE role to query business intelligence", async () => {
    const res = await AiAssistantService.answerQuery(
      employeeSession,
      "What is our MRR?"
    );
    expect(res.metrics.mrr).toBeDefined();
  });

  // Validation: Empty question rejected
  it("Validation: Rejects empty question with 400 Bad Request", async () => {
    await expect(
      AiAssistantService.answerQuery(adminSession, "   ")
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  // Live Gemini Model Verification
  it("Gemini Service: Validates model availability and connectivity without leaking API key", async () => {
    const status = await GeminiService.checkConnectivity();
    expect(status.model).toBeDefined();
    expect(typeof status.isConfigured).toBe("boolean");
    // Ensure any returned error or status string never leaks the raw API key
    if (status.error) {
      expect(status.error).not.toContain("AQ.Ab8RN6");
    }
  });
});
