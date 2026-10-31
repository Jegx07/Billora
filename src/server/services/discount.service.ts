import { pctOfMoney, round2, toDecimal } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { AuditService } from "@/server/services/audit.service";
import { discountSchema } from "@/server/validators/schemas";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { z } from "zod";

export interface DiscountEvaluationContext {
  code?: string | null;
  discountId?: string | null;
  subtotal: Decimal;
  totalQuantity: number;
  productIds: string[];
  evaluationDate?: Date;
}

const discountLocks = new Map<string, Promise<unknown>>();

export async function withDiscountLock<T>(discountId: string, fn: () => Promise<T>): Promise<T> {
  const prev = discountLocks.get(discountId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  discountLocks.set(discountId, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (discountLocks.get(discountId) === next) {
      discountLocks.delete(discountId);
    }
  }
}

export class DiscountService {
  /**
   * Only ADMINISTRATOR can create or modify discount rules (Section 4 & 12 of SPEC.md).
   */
  static async createDiscount(
    session: AuthSessionContext,
    rawInput: z.infer<typeof discountSchema>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can create discount rules", 403);
    }
    const input = discountSchema.parse(rawInput);

    if (input.discountType === "PERCENTAGE" && input.value > 100) {
      throw new AppError("VALIDATION_ERROR", "Percentage discount cannot exceed 100%", 400);
    }

    const existing = await prisma.discount.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new AppError("CONFLICT", `Discount code '${input.code}' already exists`, 409);
    }

    const discount = await prisma.discount.create({
      data: {
        code: input.code,
        name: input.name,
        discountType: input.discountType,
        value: round2(input.value),
        minPurchaseAmount: round2(input.minPurchaseAmount),
        minQuantity: input.minQuantity,
        applicableToAll: input.applicableToAll,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        maxUsageCount: input.maxUsageCount ?? null,
        isActive: input.isActive,
        ...(input.productIds?.length
          ? {
              products: {
                create: input.productIds.map((productId) => ({ productId })),
              },
            }
          : {}),
      },
      include: { products: true },
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "DISCOUNT_CREATED",
      entityType: "Discount",
      entityId: discount.id,
      afterData: {
        code: discount.code,
        discountType: discount.discountType,
        value: discount.value.toString(),
        maxUsageCount: discount.maxUsageCount,
      },
    });

    return discount;
  }

  /**
   * Validates discount eligibility (active status, date window, usage limit, minimum purchase,
   * minimum quantity, product applicability) and returns the computed discount amount.
   */
  static async evaluateDiscount(
    ctx: DiscountEvaluationContext,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<{ discountId: string | null; discountCode: string | null; discountAmount: Decimal }> {
    if (!ctx.code && !ctx.discountId) {
      return { discountId: null, discountCode: null, discountAmount: new Decimal(0) };
    }

    const discount = await tx.discount.findFirst({
      where: ctx.discountId ? { id: ctx.discountId } : { code: ctx.code!.toUpperCase() },
      include: { products: true },
    });

    if (!discount) {
      throw new AppError("VALIDATION_ERROR", "Discount rule not found", 400);
    }

    if (!discount.isActive) {
      throw new AppError("BUSINESS_RULE_VIOLATION", `Discount '${discount.code}' is inactive`, 400);
    }

    const now = ctx.evaluationDate ?? new Date();
    if (now < discount.startDate || now > discount.endDate) {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        `Discount '${discount.code}' is outside its valid date window`,
        400
      );
    }

    if (
      discount.maxUsageCount !== null &&
      discount.currentUsageCount >= discount.maxUsageCount
    ) {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        `Discount '${discount.code}' has reached its maximum usage limit (${discount.maxUsageCount})`,
        400
      );
    }

    if (ctx.subtotal.lessThan(toDecimal(discount.minPurchaseAmount))) {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        `Minimum purchase amount of ₹${discount.minPurchaseAmount} not met for discount '${discount.code}'`,
        400
      );
    }

    if (ctx.totalQuantity < discount.minQuantity) {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        `Minimum quantity of ${discount.minQuantity} not met for discount '${discount.code}'`,
        400
      );
    }

    if (!discount.applicableToAll && discount.products.length > 0) {
      const allowedProductIds = new Set(discount.products.map((p) => p.productId));
      const hasEligibleProduct = ctx.productIds.some((id) => allowedProductIds.has(id));
      if (!hasEligibleProduct) {
        throw new AppError(
          "BUSINESS_RULE_VIOLATION",
          `Discount '${discount.code}' is not applicable to the selected products`,
          400
        );
      }
    }

    let rawDiscountAmount = new Decimal(0);
    if (discount.discountType === "PERCENTAGE") {
      rawDiscountAmount = pctOfMoney(ctx.subtotal, discount.value);
    } else {
      rawDiscountAmount = round2(discount.value);
    }

    // Clamp discount so it never exceeds subtotal
    const discountAmount = Decimal.min(rawDiscountAmount, ctx.subtotal);

    return {
      discountId: discount.id,
      discountCode: discount.code,
      discountAmount: round2(discountAmount),
    };
  }

  /**
   * Atomically increments `currentUsageCount` inside a DB transaction using a conditional WHERE guard
   * so concurrent requests cannot exceed `maxUsageCount`.
   */
  static async consumeDiscountAtomically(
    tx: Prisma.TransactionClient,
    params: {
      discountId: string;
      customerId: string;
      discountAmount: Decimal;
      subscriptionId?: string;
      invoiceId?: string;
    }
  ) {
    const discount = await tx.discount.findUniqueOrThrow({
      where: { id: params.discountId },
    });

    if (discount.maxUsageCount !== null) {
      const updated = await tx.discount.updateMany({
        where: {
          id: params.discountId,
          isActive: true,
          currentUsageCount: { lt: discount.maxUsageCount },
        },
        data: {
          currentUsageCount: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new AppError(
          "BUSINESS_RULE_VIOLATION",
          `Discount '${discount.code}' usage limit exhausted by concurrent request`,
          409
        );
      }
    } else {
      await tx.discount.update({
        where: { id: params.discountId },
        data: { currentUsageCount: { increment: 1 } },
      });
    }

    await tx.discountUsage.create({
      data: {
        discountId: params.discountId,
        customerId: params.customerId,
        subscriptionId: params.subscriptionId ?? null,
        invoiceId: params.invoiceId ?? null,
        discountAmount: round2(params.discountAmount),
      },
    });
  }
}
