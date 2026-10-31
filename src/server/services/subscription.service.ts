import { calculateNextBillingDate } from "@/lib/dates";
import { toDecimal } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { assertCustomerAccess, AuthSessionContext } from "@/server/middlewares/auth";
import { AuditService } from "@/server/services/audit.service";
import { DiscountService, withDiscountLock } from "@/server/services/discount.service";
import { NotificationService } from "@/server/services/notification.service";
import { QuotationService } from "@/server/services/quotation.service";
import { createSubscriptionSchema, subscriptionTransitionSchema } from "@/server/validators/schemas";
import { z } from "zod";

export type SubscriptionStatusType =
  | "DRAFT"
  | "QUOTATION"
  | "CONFIRMED"
  | "ACTIVE"
  | "PAUSED"
  | "CANCELLED"
  | "EXPIRED"
  | "CLOSED";

/**
 * Explicit Allowed-Transitions Table (Section 9 of SPEC.md)
 */
const ALLOWED_TRANSITIONS: Record<SubscriptionStatusType, SubscriptionStatusType[]> = {
  DRAFT: ["QUOTATION", "CONFIRMED", "CANCELLED"],
  QUOTATION: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "CANCELLED", "EXPIRED", "CLOSED"],
  PAUSED: ["ACTIVE", "CANCELLED", "CLOSED"],
  EXPIRED: ["ACTIVE", "CLOSED"],
  CANCELLED: ["CLOSED"],
  CLOSED: [],
};

export class SubscriptionService {
  static async createSubscription(
    session: AuthSessionContext,
    rawInput: z.infer<typeof createSubscriptionSchema>
  ) {
    const input = createSubscriptionSchema.parse(rawInput);

    // If customer is creating via Self-Service Portal, enforce their own customerId
    if (session.role === "CUSTOMER") {
      assertCustomerAccess(session, input.customerId);
    }

    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      include: { user: true },
    });
    if (!customer) throw new AppError("NOT_FOUND", "Customer not found", 404);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan || plan.status !== "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", "Selected subscription plan is not active", 400);
    }

    const totalQty = input.lines.reduce((acc, l) => acc + l.quantity, 0);
    if (totalQty < plan.minQuantity) {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        `Plan '${plan.name}' requires a minimum quantity of ${plan.minQuantity}`,
        400
      );
    }

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const anchorBillingDay = startDate.getUTCDate();
    const periodEnd = calculateNextBillingDate(
      startDate,
      plan.billingFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
      anchorBillingDay
    );
    const expiryDate = calculateNextBillingDate(
      startDate,
      "MONTHLY",
      anchorBillingDay,
      plan.defaultTermMonths
    );

    const preview = await QuotationService.computePricingPreview({
      lines: input.lines,
      discountCode: input.discountCode,
      evaluationDate: startDate,
    });

    const subCount = await prisma.subscription.count();
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const subscriptionNumber = `SUB-2026-${String(subCount + 10001).padStart(5, "0")}-${randSuffix}`;
    const initialStatus: SubscriptionStatusType = input.activateImmediately ? "ACTIVE" : "DRAFT";

    const runCreateTx = () =>
      prisma.$transaction(async (tx) => {
        if (preview.discountId && preview.discountAmount.greaterThan(0)) {
          await DiscountService.consumeDiscountAtomically(tx, {
            discountId: preview.discountId,
            customerId: customer.id,
            discountAmount: preview.discountAmount,
          });
        }

        const sub = await tx.subscription.create({
          data: {
            subscriptionNumber,
            customerId: customer.id,
            planId: plan.id,
            discountId: preview.discountId,
            status: initialStatus,
            billingFrequency: plan.billingFrequency,
            paymentTermsDays: input.paymentTermsDays,
            startDate,
            expiryDate,
            anchorBillingDay,
            currentPeriodStart: startDate,
            currentPeriodEnd: periodEnd,
            nextBillingDate: startDate,
            subtotal: preview.subtotal,
            discountAmount: preview.discountAmount,
            taxAmount: preview.taxAmount,
            totalAmount: preview.totalAmount,
            lines: {
              create: preview.lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                productNameSnapshot: l.productName,
                variantNameSnapshot: l.variantName,
                quantity: l.quantity,
                baseUnitPrice: l.baseUnitPrice,
                variantPriceDelta: l.variantPriceDelta,
                unitPrice: l.unitPrice,
                taxRuleId: l.taxRuleId,
                taxNameSnapshot: l.taxNameSnapshot,
                taxRateSnapshot: l.taxRateSnapshot,
                lineSubtotal: l.lineSubtotal,
                lineDiscountAmount: l.lineDiscountAmount,
                lineTaxAmount: l.lineTaxAmount,
                lineTotal: l.lineTotal,
              })),
            },
            history: {
              create: {
                fromStatus: null,
                toStatus: initialStatus,
                action: input.activateImmediately ? "CREATE_AND_ACTIVATE" : "CREATE_DRAFT",
                actorUserId: session.userId,
                reason: "Initial subscription creation",
              },
            },
          },
          include: {
            customer: true,
            plan: true,
            lines: true,
            history: true,
          },
        });

        return sub;
      });

    const subscription = preview.discountId
      ? await withDiscountLock(preview.discountId, runCreateTx)
      : await runCreateTx();

    if (customer.userId && initialStatus === "ACTIVE") {
      await NotificationService.notify({
        userId: customer.userId,
        eventType: "SUBSCRIPTION_CONFIRMED",
        title: `Subscription ${subscription.subscriptionNumber} Active`,
        message: `Your subscription ${subscription.subscriptionNumber} (${plan.name}) is now active.`,
        idempotencyKey: `sub_active_${subscription.id}`,
      });
    }

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "SUBSCRIPTION_CREATED",
      entityType: "Subscription",
      entityId: subscription.id,
      afterData: {
        subscriptionNumber,
        status: subscription.status,
        totalAmount: subscription.totalAmount.toString(),
      },
    });

    return subscription;
  }

  /**
   * Executes a validated state-machine transition on a Subscription:
   * CONFIRM, ACTIVATE, PAUSE, RESUME, RENEW, CANCEL, CLOSE, EXPIRE.
   * Strictly checks plan permissions (`allowPause`, `allowEarlyCancel`, `allowRenewal`)
   * and writes an immutable SubscriptionHistory record.
   */
  static async transitionStatus(
    session: AuthSessionContext,
    subscriptionId: string,
    rawInput: z.infer<typeof subscriptionTransitionSchema>
  ) {
    const input = subscriptionTransitionSchema.parse(rawInput);

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, customer: true },
    });
    if (!sub) throw new AppError("NOT_FOUND", "Subscription not found", 404);

    assertCustomerAccess(session, sub.customerId);

    const currentStatus = sub.status as SubscriptionStatusType;
    let targetStatus: SubscriptionStatusType;

    switch (input.action) {
      case "CONFIRM":
        targetStatus = "CONFIRMED";
        break;
      case "ACTIVATE":
        targetStatus = "ACTIVE";
        break;
      case "PAUSE":
        if (!sub.plan.allowPause) {
          throw new AppError(
            "BUSINESS_RULE_VIOLATION",
            `Plan '${sub.plan.name}' does not permit pausing subscriptions`,
            400
          );
        }
        targetStatus = "PAUSED";
        break;
      case "RESUME":
        if (currentStatus !== "PAUSED") {
          throw new AppError(
            "BUSINESS_RULE_VIOLATION",
            "Only PAUSED subscriptions can be resumed",
            400
          );
        }
        targetStatus = "ACTIVE";
        break;
      case "RENEW":
        if (!sub.plan.allowRenewal) {
          throw new AppError(
            "BUSINESS_RULE_VIOLATION",
            `Plan '${sub.plan.name}' does not permit renewals`,
            400
          );
        }
        targetStatus = "ACTIVE";
        break;
      case "CANCEL":
        if (!sub.plan.allowEarlyCancel && session.role === "CUSTOMER") {
          throw new AppError(
            "BUSINESS_RULE_VIOLATION",
            `Plan '${sub.plan.name}' does not allow early customer cancellation`,
            400
          );
        }
        targetStatus = "CANCELLED";
        break;
      case "CLOSE":
        if (session.role === "CUSTOMER") {
          throw new AppError("FORBIDDEN", "Customers cannot manually close subscriptions", 403);
        }
        targetStatus = "CLOSED";
        break;
      case "EXPIRE":
        if (session.role === "CUSTOMER") {
          throw new AppError("FORBIDDEN", "Customers cannot expire subscriptions", 403);
        }
        targetStatus = "EXPIRED";
        break;
    }

    const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
    // Special case: RENEW on an already ACTIVE subscription extends its term & nextBillingDate
    const isActiveRenewal = input.action === "RENEW" && currentStatus === "ACTIVE";
    if (!isActiveRenewal && !allowedTargets.includes(targetStatus)) {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        `Invalid state transition from '${currentStatus}' to '${targetStatus}' via action '${input.action}'`,
        400
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: targetStatus,
    };

    if (input.action === "PAUSE") {
      updateData.pausedAt = now;
    } else if (input.action === "RESUME") {
      // Shift nextBillingDate forward by the duration the subscription was paused
      if (sub.pausedAt && sub.nextBillingDate) {
        const pausedDurationMs = Math.max(0, now.getTime() - sub.pausedAt.getTime());
        updateData.nextBillingDate = new Date(sub.nextBillingDate.getTime() + pausedDurationMs);
      }
      updateData.pausedAt = null;
    } else if (input.action === "CANCEL") {
      updateData.cancelledAt = now;
      updateData.cancellationReason = input.reason ?? "Cancelled by user";
    } else if (input.action === "CLOSE") {
      updateData.closedAt = now;
    } else if (input.action === "RENEW") {
      const baseRef = sub.expiryDate && sub.expiryDate > now ? sub.expiryDate : now;
      updateData.expiryDate = calculateNextBillingDate(
        baseRef,
        "MONTHLY",
        sub.anchorBillingDay,
        sub.plan.defaultTermMonths
      );
      if (currentStatus === "EXPIRED") {
        updateData.nextBillingDate = now;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          ...updateData,
          history: {
            create: {
              fromStatus: currentStatus,
              toStatus: targetStatus,
              action: input.action,
              actorUserId: session.userId,
              reason: input.reason ?? null,
            },
          },
        },
        include: {
          customer: true,
          plan: true,
          lines: true,
          history: { orderBy: { createdAt: "desc" } },
        },
      });

      return s;
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: `SUBSCRIPTION_${input.action}`,
      entityType: "Subscription",
      entityId: subscriptionId,
      beforeData: { status: currentStatus },
      afterData: { status: targetStatus, reason: input.reason ?? null },
    });

    if (sub.customer.userId) {
      if (targetStatus === "EXPIRED") {
        await NotificationService.notify({
          userId: sub.customer.userId,
          eventType: "SUBSCRIPTION_EXPIRED",
          title: `Subscription ${sub.subscriptionNumber} Expired`,
          message: `Your subscription ${sub.subscriptionNumber} has expired.`,
        });
      } else if (targetStatus === "ACTIVE" && currentStatus !== "ACTIVE") {
        await NotificationService.notify({
          userId: sub.customer.userId,
          eventType: "SUBSCRIPTION_CONFIRMED",
          title: `Subscription ${sub.subscriptionNumber} Active`,
          message: `Your subscription ${sub.subscriptionNumber} is now active.`,
        });
      }
    }

    return updated;
  }

  static async getSubscriptionById(session: AuthSessionContext, subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
        plan: true,
        discount: true,
        quotation: true,
        lines: { include: { product: true, variant: true, taxRule: true } },
        history: {
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { id: true, fullName: true, email: true } } },
        },
        invoices: {
          orderBy: { invoiceDate: "desc" },
          include: { payments: true },
        },
      },
    });
    if (!sub) throw new AppError("NOT_FOUND", "Subscription not found", 404);
    assertCustomerAccess(session, sub.customerId);
    return sub;
  }
}
