import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import {
  assertCustomerAccess,
  AuthSessionContext,
  generateRandomToken,
  hashPassword,
  hashToken,
  UserRole,
  verifyPassword,
} from "@/server/middlewares/auth";
import { AuditService } from "@/server/services/audit.service";
import { NotificationService } from "@/server/services/notification.service";
import {
  createCustomerSchema,
  createEmployeeSchema,
  forgotPasswordSchema,
  loginSchema,
  registerCustomerSchema,
  resetPasswordSchema,
} from "@/server/validators/schemas";
import { z } from "zod";

const DEFAULT_DEMO_USERS: Record<
  string,
  { role: UserRole; fullName: string; defaultPassword: string }
> = {
  "admin@billora.io": {
    role: "ADMIN",
    fullName: "Vikramaditya Rao (Admin)",
    defaultPassword: "Admin@Billora2026!",
  },
  "arjun.mehta@billora.io": {
    role: "EMPLOYEE",
    fullName: "Arjun Mehta",
    defaultPassword: "Emp@Billora2026!",
  },
  "priya.sharma@acmeindia.in": {
    role: "CUSTOMER",
    fullName: "Priya Sharma",
    defaultPassword: "Cust@Billora2026!",
  },
};

export class AuthService {
  static async ensureRoles() {
    const roles: { name: UserRole; description: string }[] = [
      { name: "ADMIN", description: "Administrator with full platform access" },
      { name: "EMPLOYEE", description: "Employee managing quotations, subscriptions, and billing" },
      { name: "CUSTOMER", description: "Customer self-service portal access" },
    ];
    for (const r of roles) {
      await prisma.role.upsert({
        where: { name: r.name },
        update: {},
        create: r,
      });
    }
  }

  /**
   * Public registration ONLY creates CUSTOMER accounts.
   * Never allows selecting ADMIN or EMPLOYEE roles.
   */
  static async registerCustomer(rawInput: z.infer<typeof registerCustomerSchema>) {
    const input = registerCustomerSchema.parse(rawInput);
    await this.ensureRoles();

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new AppError("CONFLICT", "An account with this email address already exists", 409);
    }

    const customerRole = await prisma.role.findUniqueOrThrow({
      where: { name: "CUSTOMER" },
    });

    const passwordHash = hashPassword(input.password);
    const verificationToken = generateRandomToken(24);
    const customerCount = await prisma.customer.count();
    const customerCode = `CUST-${String(customerCount + 1001).padStart(4, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          roleId: customerRole.id,
          status: "ACTIVE",
          verificationToken,
          emailVerifiedAt: new Date(),
        },
      });

      // Check if a Customer record with this email was pre-created by an Employee/Admin
      const existingCustomer = await tx.customer.findUnique({
        where: { email: input.email },
      });

      const customer = existingCustomer
        ? await tx.customer.update({
          where: { id: existingCustomer.id },
          data: {
            userId: user.id,
            contactName: input.fullName,
            companyName: input.companyName ?? existingCustomer.companyName,
            phone: input.phone ?? existingCustomer.phone,
            gstin: input.gstin ?? existingCustomer.gstin,
          },
        })
        : await tx.customer.create({
          data: {
            customerCode,
            userId: user.id,
            contactName: input.fullName,
            companyName: input.companyName ?? null,
            email: input.email,
            phone: input.phone ?? null,
            gstin: input.gstin ?? null,
          },
        });

      const rawSessionToken = generateRandomToken(32);
      const csrfToken = generateRandomToken(16);
      const session = await tx.session.create({
        data: {
          tokenHash: hashToken(rawSessionToken),
          csrfToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return { user, customer, rawSessionToken, csrfToken, sessionId: session.id };
    });

    await NotificationService.notify({
      userId: result.user.id,
      eventType: "WELCOME",
      title: "Welcome to Billora",
      message: `Hello ${result.user.fullName}, your Billora customer portal account (${result.customer.customerCode}) is ready.`,
      idempotencyKey: `welcome_${result.user.id}`,
    });

    await AuditService.log({
      actorId: result.user.id,
      actorRole: "CUSTOMER",
      action: "CUSTOMER_REGISTERED",
      entityType: "Customer",
      entityId: result.customer.id,
      afterData: { email: result.user.email, customerCode: result.customer.customerCode },
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: "CUSTOMER" as UserRole,
        customerId: result.customer.id,
        employeeId: null,
      },
      sessionToken: result.rawSessionToken,
      csrfToken: result.csrfToken,
    };
  }

  static async login(rawInput: z.infer<typeof loginSchema>, ipAddress?: string, userAgent?: string) {
    const input = loginSchema.parse(rawInput);

    let user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        role: true,
        customer: true,
        employee: true,
      },
    });

    // Auto-provision standard demo accounts on first login if the database has not been seeded yet
    if (!user && DEFAULT_DEMO_USERS[input.email]) {
      const spec = DEFAULT_DEMO_USERS[input.email];
      await this.ensureRoles();
      const roleRec = await prisma.role.findUniqueOrThrow({ where: { name: spec.role } });
      user = await prisma.user.create({
        data: {
          email: input.email,
          fullName: spec.fullName,
          passwordHash: hashPassword(spec.defaultPassword),
          roleId: roleRec.id,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
        include: {
          role: true,
          customer: true,
          employee: true,
        },
      });

      if (spec.role === "EMPLOYEE" && !user.employee) {
        const empCount = await prisma.employee.count();
        const emp = await prisma.employee.create({
          data: {
            employeeCode: `EMP-${String(empCount + 101).padStart(3, "0")}`,
            userId: user.id,
            department: "Revenue Operations",
            designation: "Senior Billing Specialist",
            phone: "+91 98201 11200",
          },
        });
        user = { ...user, employee: emp };
      } else if (spec.role === "CUSTOMER" && !user.customer) {
        const custCount = await prisma.customer.count();
        const cust = await prisma.customer.create({
          data: {
            customerCode: `CUST-${String(custCount + 1001).padStart(4, "0")}`,
            userId: user.id,
            contactName: user.fullName,
            companyName: "Acme Cloud Technologies Pvt Ltd",
            email: user.email,
            phone: "+91 98110 10001",
            gstin: "29AAACB1001F1Z5",
            city: "Bengaluru",
            state: "Karnataka",
            country: "India",
            postalCode: "560001",
          },
        });
        user = { ...user, customer: cust };
      }
    }

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AppError("UNAUTHORIZED", "Invalid email address or password", 401);
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("FORBIDDEN", `Your account is currently ${user.status}`, 403);
    }

    const rawSessionToken = generateRandomToken(32);
    const csrfToken = generateRandomToken(16);

    await prisma.$transaction([
      prisma.session.create({
        data: {
          tokenHash: hashToken(rawSessionToken),
          csrfToken,
          userId: user.id,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name as UserRole,
        customerId: user.customer?.id ?? null,
        employeeId: user.employee?.id ?? null,
      },
      sessionToken: rawSessionToken,
      csrfToken,
    };
  }

  static async logout(sessionId: string) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  }

  static async requestPasswordReset(rawInput: z.infer<typeof forgotPasswordSchema>) {
    const input = forgotPasswordSchema.parse(rawInput);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      // Return success even if email not found to prevent user enumeration
      return { resetToken: null, expiresAt: null };
    }

    const rawResetToken = generateRandomToken(24);
    const tokenHash = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiry

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    await NotificationService.notify({
      userId: user.id,
      eventType: "PASSWORD_RESET",
      title: "Password Reset Requested",
      message: `A password reset token was generated for your account. It expires in 30 minutes.`,
    });

    return {
      message: "If an account with this email exists, a password reset link has been dispatched.",
      expiresAt,
    };
  }

  static async resetPassword(rawInput: z.infer<typeof resetPasswordSchema>) {
    const input = resetPasswordSchema.parse(rawInput);
    const tokenHash = hashToken(input.token);

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt !== null) {
      throw new AppError("VALIDATION_ERROR", "Invalid or already used password reset token", 400);
    }

    if (resetRecord.expiresAt.getTime() < Date.now()) {
      throw new AppError("VALIDATION_ERROR", "Password reset token has expired", 400);
    }

    const newPasswordHash = hashPassword(input.password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all existing sessions on password change
      prisma.session.deleteMany({
        where: { userId: resetRecord.userId },
      }),
    ]);

    await AuditService.log({
      actorId: resetRecord.userId,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId: resetRecord.userId,
    });

    return { updated: true };
  }

  /**
   * Only ADMINISTRATOR can create employee accounts (Section 4 & 5 of SPEC.md).
   */
  static async createEmployee(
    session: AuthSessionContext,
    rawInput: z.infer<typeof createEmployeeSchema>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can create employee accounts", 403);
    }

    const input = createEmployeeSchema.parse(rawInput);
    await this.ensureRoles();

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError("CONFLICT", "An account with this email address already exists", 409);
    }

    const employeeRole = await prisma.role.findUniqueOrThrow({ where: { name: "EMPLOYEE" } });
    const empCount = await prisma.employee.count();
    const employeeCode = `EMP-${String(empCount + 101).padStart(3, "0")}`;
    const passwordHash = hashPassword(input.password);

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          roleId: employeeRole.id,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });

      return tx.employee.create({
        data: {
          employeeCode,
          userId: user.id,
          department: input.department,
          designation: input.designation,
          phone: input.phone ?? null,
        },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, status: true, createdAt: true },
          },
        },
      });
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "EMPLOYEE_CREATED",
      entityType: "Employee",
      entityId: employee.id,
      afterData: {
        employeeCode: employee.employeeCode,
        email: input.email,
        department: input.department,
        designation: input.designation,
      },
    });

    return employee;
  }

  static async createCustomer(
    session: AuthSessionContext,
    rawInput: z.infer<typeof createCustomerSchema>
  ) {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError("FORBIDDEN", "Unauthorized to create customer records", 403);
    }

    const input = createCustomerSchema.parse(rawInput);
    await this.ensureRoles();

    const existing = await prisma.customer.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError("CONFLICT", "A customer with this email already exists", 409);
    }

    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      throw new AppError("CONFLICT", "An account with this email address already exists", 409);
    }

    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "CUSTOMER" } });
    const count = await prisma.customer.count();
    const customerCode = `CUST-${String(count + 1001).padStart(4, "0")}`;

    const customer = await prisma.$transaction(async (tx) => {
      let userId: string | null = null;
      if (input.password) {
        const user = await tx.user.create({
          data: {
            email: input.email,
            fullName: input.contactName,
            passwordHash: hashPassword(input.password),
            roleId: customerRole.id,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        });
        userId = user.id;
      }

      return tx.customer.create({
        data: {
          customerCode,
          userId,
          contactName: input.contactName,
          companyName: input.companyName ?? null,
          email: input.email,
          phone: input.phone ?? null,
          gstin: input.gstin ?? null,
          billingAddress: input.billingAddress ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          postalCode: input.postalCode ?? null,
          assignedEmployeeId: input.assignedEmployeeId ?? session.employeeId ?? null,
        },
      });
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "CUSTOMER_CREATED",
      entityType: "Customer",
      entityId: customer.id,
      afterData: { customerCode: customer.customerCode, email: customer.email },
    });

    return customer;
  }

  static async getCustomerById(session: AuthSessionContext, customerId: string) {
    assertCustomerAccess(session, customerId);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        assignedEmployee: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { plan: true },
        },
        invoices: {
          orderBy: { invoiceDate: "desc" },
          take: 20,
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          take: 20,
        },
      },
    });

    if (!customer) {
      throw new AppError("NOT_FOUND", "Customer not found", 404);
    }

    return customer;
  }
}
