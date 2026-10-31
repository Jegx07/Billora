import { calculateVariantUnitPrice, round2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { AuditService } from "@/server/services/audit.service";
import {
  productSchema,
  subscriptionPlanSchema,
  taxRuleSchema,
  variantSchema,
} from "@/server/validators/schemas";
import { z } from "zod";

export class CatalogService {
  /**
   * Create a Product (ADMIN only)
   */
  static async createProduct(
    session: AuthSessionContext,
    rawInput: z.infer<typeof productSchema>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can create products", 403);
    }
    const input = productSchema.parse(rawInput);
    const count = await prisma.product.count();
    const productCode = `PRD-${String(count + 101).padStart(3, "0")}`;

    const product = await prisma.product.create({
      data: {
        productCode,
        name: input.name,
        productType: input.productType,
        salesPrice: round2(input.salesPrice),
        costPrice: round2(input.costPrice),
        description: input.description ?? null,
        notes: input.notes ?? null,
        status: input.status,
      },
      include: { variants: true },
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: product.id,
      afterData: { productCode, name: product.name, salesPrice: product.salesPrice.toString() },
    });

    return product;
  }

  static async updateProduct(
    session: AuthSessionContext,
    productId: string,
    rawInput: Partial<z.infer<typeof productSchema>>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can update products", 403);
    }
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) throw new AppError("NOT_FOUND", "Product not found", 404);

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(rawInput.name !== undefined ? { name: rawInput.name } : {}),
        ...(rawInput.productType !== undefined ? { productType: rawInput.productType } : {}),
        ...(rawInput.salesPrice !== undefined ? { salesPrice: round2(rawInput.salesPrice) } : {}),
        ...(rawInput.costPrice !== undefined ? { costPrice: round2(rawInput.costPrice) } : {}),
        ...(rawInput.description !== undefined ? { description: rawInput.description } : {}),
        ...(rawInput.notes !== undefined ? { notes: rawInput.notes } : {}),
        ...(rawInput.status !== undefined ? { status: rawInput.status } : {}),
      },
      include: { variants: true },
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: productId,
      beforeData: { salesPrice: existing.salesPrice.toString(), status: existing.status },
      afterData: { salesPrice: updated.salesPrice.toString(), status: updated.status },
    });

    return updated;
  }

  /**
   * Add a Product Variant (ADMIN only).
   * Final Unit Price = Base Sales Price + Variant Additional Price.
   */
  static async createProductVariant(
    session: AuthSessionContext,
    productId: string,
    rawInput: z.infer<typeof variantSchema>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can create product variants", 403);
    }
    const input = variantSchema.parse(rawInput);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name: input.name,
        sku: input.sku,
        additionalPrice: round2(input.additionalPrice),
        status: input.status,
      },
    });

    const finalUnitPrice = calculateVariantUnitPrice(product.salesPrice, variant.additionalPrice);

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "PRODUCT_VARIANT_CREATED",
      entityType: "ProductVariant",
      entityId: variant.id,
      afterData: {
        productId,
        name: variant.name,
        additionalPrice: variant.additionalPrice.toString(),
        finalUnitPrice: finalUnitPrice.toString(),
      },
    });

    return {
      ...variant,
      baseSalesPrice: product.salesPrice,
      finalUnitPrice,
    };
  }

  static async updateProductVariant(
    session: AuthSessionContext,
    variantId: string,
    rawInput: Partial<z.infer<typeof variantSchema>>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can modify product variants", 403);
    }
    const existing = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Variant not found", 404);

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(rawInput.name !== undefined ? { name: rawInput.name } : {}),
        ...(rawInput.sku !== undefined ? { sku: rawInput.sku } : {}),
        ...(rawInput.additionalPrice !== undefined
          ? { additionalPrice: round2(rawInput.additionalPrice) }
          : {}),
        ...(rawInput.status !== undefined ? { status: rawInput.status } : {}),
      },
    });

    return {
      ...updated,
      baseSalesPrice: existing.product.salesPrice,
      finalUnitPrice: calculateVariantUnitPrice(
        existing.product.salesPrice,
        updated.additionalPrice
      ),
    };
  }

  /**
   * Create or update Tax Rules (ADMIN only)
   */
  static async createTaxRule(
    session: AuthSessionContext,
    rawInput: z.infer<typeof taxRuleSchema>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can configure tax rules", 403);
    }
    const input = taxRuleSchema.parse(rawInput);

    const taxRule = await prisma.taxRule.create({
      data: {
        name: input.name,
        taxType: input.taxType,
        percentage: round2(input.percentage),
        applicability: input.applicability,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : null,
        isActive: input.isActive,
      },
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "TAX_RULE_CREATED",
      entityType: "TaxRule",
      entityId: taxRule.id,
      afterData: { name: taxRule.name, percentage: taxRule.percentage.toString() },
    });

    return taxRule;
  }

  static async updateTaxRule(
    session: AuthSessionContext,
    taxRuleId: string,
    rawInput: Partial<z.infer<typeof taxRuleSchema>>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can modify tax rules", 403);
    }
    const updated = await prisma.taxRule.update({
      where: { id: taxRuleId },
      data: {
        ...(rawInput.name !== undefined ? { name: rawInput.name } : {}),
        ...(rawInput.taxType !== undefined ? { taxType: rawInput.taxType } : {}),
        ...(rawInput.percentage !== undefined ? { percentage: round2(rawInput.percentage) } : {}),
        ...(rawInput.isActive !== undefined ? { isActive: rawInput.isActive } : {}),
      },
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "TAX_RULE_UPDATED",
      entityType: "TaxRule",
      entityId: taxRuleId,
      afterData: { name: updated.name, percentage: updated.percentage.toString(), isActive: updated.isActive },
    });

    return updated;
  }

  /**
   * Create Subscription Plan (ADMIN only)
   */
  static async createSubscriptionPlan(
    session: AuthSessionContext,
    rawInput: z.infer<typeof subscriptionPlanSchema>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can create subscription plans", 403);
    }
    const input = subscriptionPlanSchema.parse(rawInput);
    const count = await prisma.subscriptionPlan.count();
    const planCode = `PLN-${input.billingFrequency.slice(0, 3)}-${String(count + 101).padStart(3, "0")}`;

    const plan = await prisma.subscriptionPlan.create({
      data: {
        planCode,
        name: input.name,
        description: input.description ?? null,
        basePrice: round2(input.basePrice),
        billingFrequency: input.billingFrequency,
        minQuantity: input.minQuantity,
        availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
        availableUntil: input.availableUntil ? new Date(input.availableUntil) : null,
        autoCloseDays: input.autoCloseDays ?? null,
        allowEarlyCancel: input.allowEarlyCancel,
        allowPause: input.allowPause,
        allowRenewal: input.allowRenewal,
        defaultTermMonths: input.defaultTermMonths,
        status: input.status,
        ...(input.productIds?.length
          ? {
              planProducts: {
                create: input.productIds.map((productId) => ({
                  productId,
                  defaultQuantity: input.minQuantity,
                  includedInBase: true,
                })),
              },
            }
          : {}),
      },
      include: {
        planProducts: { include: { product: true } },
      },
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "SUBSCRIPTION_PLAN_CREATED",
      entityType: "SubscriptionPlan",
      entityId: plan.id,
      afterData: {
        planCode: plan.planCode,
        name: plan.name,
        billingFrequency: plan.billingFrequency,
        basePrice: plan.basePrice.toString(),
      },
    });

    return plan;
  }

  static async updateSubscriptionPlan(
    session: AuthSessionContext,
    planId: string,
    rawInput: Partial<z.infer<typeof subscriptionPlanSchema>>
  ) {
    if (session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can update subscription plans", 403);
    }
    return prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(rawInput.name !== undefined ? { name: rawInput.name } : {}),
        ...(rawInput.description !== undefined ? { description: rawInput.description } : {}),
        ...(rawInput.basePrice !== undefined ? { basePrice: round2(rawInput.basePrice) } : {}),
        ...(rawInput.billingFrequency !== undefined
          ? { billingFrequency: rawInput.billingFrequency }
          : {}),
        ...(rawInput.minQuantity !== undefined ? { minQuantity: rawInput.minQuantity } : {}),
        ...(rawInput.allowEarlyCancel !== undefined
          ? { allowEarlyCancel: rawInput.allowEarlyCancel }
          : {}),
        ...(rawInput.allowPause !== undefined ? { allowPause: rawInput.allowPause } : {}),
        ...(rawInput.allowRenewal !== undefined ? { allowRenewal: rawInput.allowRenewal } : {}),
        ...(rawInput.autoCloseDays !== undefined ? { autoCloseDays: rawInput.autoCloseDays } : {}),
        ...(rawInput.status !== undefined ? { status: rawInput.status } : {}),
      },
    });
  }
}
