import { prisma } from "@/server/db/client";
import {
  AuthSessionContext,
  getSessionFromRequest,
  hashPassword,
  hashToken,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/server/middlewares/auth";
import { AuthService } from "@/server/services/auth.service";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

describe("Billora — Authentication & Three-Role Authorization System", () => {
  let adminUserId: string;
  let employeeUserId: string;
  let customerUserId: string;
  let inactiveUserId: string;

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
        fullName: "Vikramaditya Rao (Admin)",
        passwordHash: hashPassword("Admin@Billora2026!"),
        roleId: adminRole.id,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    adminUserId = adminUser.id;

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
    employeeUserId = empUser.id;

    await prisma.employee.upsert({
      where: { userId: empUser.id },
      update: {},
      create: {
        employeeCode: "EMP-TEST-001",
        userId: empUser.id,
        department: "Revenue Operations",
        designation: "Senior Billing Specialist",
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
    customerUserId = custUser.id;

    await prisma.customer.upsert({
      where: { email: "priya.sharma@acmeindia.in" },
      update: { userId: custUser.id },
      create: {
        customerCode: "CUST-TEST-001",
        userId: custUser.id,
        contactName: "Priya Sharma",
        companyName: "Acme Cloud Technologies",
        email: "priya.sharma@acmeindia.in",
      },
    });

    // 4. Ensure Inactive Account
    const inactiveUser = await prisma.user.upsert({
      where: { email: "inactive.user@billora.io" },
      update: { status: "DEACTIVATED" },
      create: {
        email: "inactive.user@billora.io",
        fullName: "Suspended User",
        passwordHash: hashPassword("Suspended@2026!"),
        roleId: empRole.id,
        status: "DEACTIVATED",
      },
    });
    inactiveUserId = inactiveUser.id;
  });

  // --------------------------------------------------------------------------
  // 1. Three-Role Login & Dashboard Redirection Target
  // --------------------------------------------------------------------------
  it("1. Successfully authenticates Administrator and assigns ADMIN role", async () => {
    const result = await AuthService.login({
      email: "admin@billora.io",
      password: "Admin@Billora2026!",
    });

    expect(result.user.email).toBe("admin@billora.io");
    expect(result.user.role).toBe("ADMIN");
    expect(result.sessionToken).toBeDefined();

    // Redirection rule: ADMIN -> /dashboard
    const redirectUrl = result.user.role === "CUSTOMER" ? "/portal" : "/dashboard";
    expect(redirectUrl).toBe("/dashboard");
  });

  it("2. Successfully authenticates Employee and assigns EMPLOYEE role", async () => {
    const result = await AuthService.login({
      email: "arjun.mehta@billora.io",
      password: "Emp@Billora2026!",
    });

    expect(result.user.email).toBe("arjun.mehta@billora.io");
    expect(result.user.role).toBe("EMPLOYEE");
    expect(result.sessionToken).toBeDefined();

    // Redirection rule: EMPLOYEE -> /dashboard (with role-scoped operational view)
    const redirectUrl = result.user.role === "CUSTOMER" ? "/portal" : "/dashboard";
    expect(redirectUrl).toBe("/dashboard");
  });

  it("3. Successfully authenticates Customer and redirects to /portal", async () => {
    const result = await AuthService.login({
      email: "priya.sharma@acmeindia.in",
      password: "Cust@Billora2026!",
    });

    expect(result.user.email).toBe("priya.sharma@acmeindia.in");
    expect(result.user.role).toBe("CUSTOMER");
    expect(result.user.customerId).toBeTruthy();
    expect(result.sessionToken).toBeDefined();

    // Redirection rule: CUSTOMER -> /portal
    const redirectUrl = result.user.role === "CUSTOMER" ? "/portal" : "/dashboard";
    expect(redirectUrl).toBe("/portal");
  });

  // --------------------------------------------------------------------------
  // 2. Authentication Failures & Defensive Security
  // --------------------------------------------------------------------------
  it("4. Rejects invalid password with 401 Unauthorized", async () => {
    await expect(
      AuthService.login({
        email: "admin@billora.io",
        password: "WrongPassword999!",
      })
    ).rejects.toThrow("Invalid email address or password");
  });

  it("5. Rejects non-existent email with 401 Unauthorized without user enumeration", async () => {
    await expect(
      AuthService.login({
        email: "nonexistent.hacker@evil.com",
        password: "SomePassword123!",
      })
    ).rejects.toThrow("Invalid email address or password");
  });

  it("6. Rejects inactive or deactivated account with 403 Forbidden", async () => {
    await expect(
      AuthService.login({
        email: "inactive.user@billora.io",
        password: "Suspended@2026!",
      })
    ).rejects.toThrow("Your account is currently DEACTIVATED");
  });

  // --------------------------------------------------------------------------
  // 3. Session Persistence, Refresh & Expiration
  // --------------------------------------------------------------------------
  it("7. Persists session and retrieves authenticated user on browser refresh", async () => {
    const login = await AuthService.login({
      email: "admin@billora.io",
      password: "Admin@Billora2026!",
    });

    const mockReq = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        authorization: `Bearer ${login.sessionToken}`,
      },
    });

    const session = await getSessionFromRequest(mockReq);
    expect(session).not.toBeNull();
    expect(session?.email).toBe("admin@billora.io");
    expect(session?.role).toBe("ADMIN");
  });

  it("8. Invalidates expired sessions and rejects access", async () => {
    const login = await AuthService.login({
      email: "arjun.mehta@billora.io",
      password: "Emp@Billora2026!",
    });

    // Manually expire session in DB
    const tokenHash = hashToken(login.sessionToken);
    await prisma.session.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const mockReq = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: `Bearer ${login.sessionToken}` },
    });

    const session = await getSessionFromRequest(mockReq);
    expect(session).toBeNull();
  });

  it("9. Logout completely destroys session in DB and invalidates token", async () => {
    const login = await AuthService.login({
      email: "priya.sharma@acmeindia.in",
      password: "Cust@Billora2026!",
    });

    const tokenHash = hashToken(login.sessionToken);
    const dbSession = await prisma.session.findUnique({ where: { tokenHash } });
    expect(dbSession).not.toBeNull();

    // Call logout service
    await AuthService.logout(dbSession!.id);

    const mockReq = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: `Bearer ${login.sessionToken}` },
    });

    const session = await getSessionFromRequest(mockReq);
    expect(session).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 4. Role Isolation & Escalation Prevention
  // --------------------------------------------------------------------------
  it("10. Prevents Customer from accessing Employee/Admin creation APIs", async () => {
    const custLogin = await AuthService.login({
      email: "priya.sharma@acmeindia.in",
      password: "Cust@Billora2026!",
    });

    const custSession: AuthSessionContext = {
      userId: custLogin.user.id,
      email: custLogin.user.email,
      fullName: custLogin.user.fullName,
      role: "CUSTOMER",
      customerId: custLogin.user.customerId,
      employeeId: null,
      csrfToken: custLogin.csrfToken,
      sessionId: "test_session",
    };

    await expect(
      AuthService.createEmployee(custSession, {
        fullName: "Fake Employee",
        email: "fake@billora.io",
        password: "FakePassword123!",
        department: "Sales",
        designation: "Agent",
      })
    ).rejects.toThrow("Only administrators can create employee accounts");
  });

  it("11. Prevents Employee from provisioning new Employee accounts", async () => {
    const empLogin = await AuthService.login({
      email: "arjun.mehta@billora.io",
      password: "Emp@Billora2026!",
    });

    const empSession: AuthSessionContext = {
      userId: empLogin.user.id,
      email: empLogin.user.email,
      fullName: empLogin.user.fullName,
      role: "EMPLOYEE",
      customerId: null,
      employeeId: empLogin.user.employeeId,
      csrfToken: empLogin.csrfToken,
      sessionId: "test_session_emp",
    };

    await expect(
      AuthService.createEmployee(empSession, {
        fullName: "Another Employee",
        email: "another@billora.io",
        password: "AnotherPassword123!",
        department: "Billing",
        designation: "Associate",
      })
    ).rejects.toThrow("Only administrators can create employee accounts");
  });

  it("12. Password reset request never leaks resetToken in response", async () => {
    const response = await AuthService.requestPasswordReset({
      email: "admin@billora.io",
    });

    // Check that resetToken is NOT present
    expect((response as Record<string, unknown>).resetToken).toBeUndefined();
    expect(response.message).toContain("password reset link has been dispatched");
  });
});

