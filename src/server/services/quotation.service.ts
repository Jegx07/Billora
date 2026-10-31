import { calculateNextBillingDate } from "@/lib/dates";
import {
  addMoney,
  calculateVariantUnitPrice,
  mulMoney,
  pctOfMoney,
  round2,
  subMoney,
  toDecimal,
} from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { assertCustomerAccess, AuthSessionContext } from "@/server/middlewares/auth";
import { AuditService } from "@/server/services/audit.service";
import { DiscountService } from "@/server/services/discount.service";
import { createQuotationSchema, quotationLineInputSchema } from "@/server/validators/schemas";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { z } from "zod";

export interface ComputedLineItem {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  description: string;
  quantity: number;
  baseUnitPrice: Decimal;
  variantPriceDelta: Decimal;
  unitPrice: Decimal;
  taxRuleId: string | null;
  taxNameSnapshot: string | null;
  taxRateSnapshot: Decimal;
  lineSubtotal: Decimal;
  lineDiscountAmount: Decimal;
  lineTaxAmount: Decimal;
  lineTotal: Decimal;
}

export class QuotationService {
  /**
   * Computes server-side pricing, variant deltas, discount distribution, and tax snapshots
   * for a set of line items. Never trusts client-submitted prices or totals.
   */
  static async computePricingPreview(
    params: {
      lines: z.infer<typeof quotationLineInputSchema>[];
      discountCode?: string | null;
      discountId?: string | null;
      evaluationDate?: Date;
    },
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const parsedLines = z.array(quotationLineInputSchema).min(1).parse(params.lines);

    const rawLines: Omit<
      ComputedLineItem,
      "lineDiscountAmount" | "lineTaxAmount" | "lineTotal"
    >[] = [];

    let subtotal = new Decimal(0);
    let totalQuantity = 0;
    const productIds: string[] = [];

    for (const item of parsedLines) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
      if (!product || product.status !== "ACTIVE") {
        throw new AppError(
          "VALIDATION_ERROR",
          `Product '${item.productId}' is missing or inactive`,
          400
        );
      }

      let variantId: string | null = null;
      let variantName: string | null = null;
      let variantPriceDelta = new Decimal(0);

      if (item.variantId) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
        });
        if (!variant || variant.productId !== product.id || variant.status !== "ACTIVE") {
          throw new AppError(
            "VALIDATION_ERROR",
            `Variant '${item.variantId}' does not belong to product '${product.name}' or is inactive`,
            400
          );
        }
        variantId = variant.id;
        variantName = variant.name;
        variantPriceDelta = round2(variant.additionalPrice);
      }

      const baseUnitPrice = round2(product.salesPrice);
      const unitPrice = calculateVariantUnitPrice(baseUnitPrice, variantPriceDelta);
      const lineSubtotal = mulMoney(unitPrice, item.quantity);

      let taxRuleId: string | null = null;
      let taxNameSnapshot: string | null = null;
      let taxRateSnapshot = new Decimal(0);

      if (item.taxRuleId) {
        const taxRule = await tx.taxRule.findUnique({ where: { id: item.taxRuleId } });
        if (!taxRule || !taxRule.isActive) {
          throw new AppError("VALIDATION_ERROR", "Selected tax rule is inactive or missing", 400);
        }
        taxRuleId = taxRule.id;
        taxNameSnapshot = taxRule.name;
        taxRateSnapshot = round2(taxRule.percentage);
      }

      subtotal = addMoney(subtotal, lineSubtotal);
      totalQuantity += item.quantity;
      productIds.push(product.id);

      rawLines.push({
        productId: product.id,
        productName: product.name,
        variantId,
        variantName,
        description:
          item.description ||
          (variantName ? `${product.name} (${variantName})` : product.name),
        quantity: item.quantity,
        baseUnitPrice,
        variantPriceDelta,
        unitPrice,
        taxRuleId,
        taxNameSnapshot,
        taxRateSnapshot,
        lineSubtotal,
      });
    }

    const discountEval = await DiscountService.evaluateDiscount(
      {
        code: params.discountCode,
        discountId: params.discountId,
        subtotal,
        totalQuantity,
        productIds,
        evaluationDate: params.evaluationDate,
      },
      tx
    );

    const totalDiscount = discountEval.discountAmount;
    let remainingDiscount = totalDiscount;

    const computedLines: ComputedLineItem[] = [];
    let totalTax = new Decimal(0);
    let grandTotal = new Decimal(0);

    for (let i = 0; i < rawLines.length; i++) {
      const rl = rawLines[i];
      let lineDiscount = new Decimal(0);

      if (totalDiscount.greaterThan(0) && subtotal.greaterThan(0)) {
        if (i === rawLines.length - 1) {
          lineDiscount = remainingDiscount;
        } else {
          lineDiscount = round2(rl.lineSubtotal.dividedBy(subtotal).times(totalDiscount));
          remainingDiscount = subMoney(remainingDiscount, lineDiscount);
        }
      }

      const taxableBase = Decimal.max(new Decimal(0), subMoney(rl.lineSubtotal, lineDiscount));
      const lineTaxAmount = pctOfMoney(taxableBase, rl.taxRateSnapshot);
      const lineTotal = addMoney(taxableBase, lineTaxAmount);

      totalTax = addMoney(totalTax, lineTaxAmount);
      grandTotal = addMoney(grandTotal, lineTotal);

      computedLines.push({
        ...rl,
        lineDiscountAmount: lineDiscount,
        lineTaxAmount,
        lineTotal,
      });
    }

    return {
      subtotal: round2(subtotal),
      discountId: discountEval.discountId,
      discountCode: discountEval.discountCode,
      discountAmount: round2(totalDiscount),
      taxAmount: round2(totalTax),
      totalAmount: round2(grandTotal),
      lines: computedLines,
    };
  }

  static async createQuotation(
    session: AuthSessionContext,
    rawInput: z.infer<typeof createQuotationSchema>
  ) {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError("FORBIDDEN", "Only administrators and employees can create quotations", 403);
    }

    const input = createQuotationSchema.parse(rawInput);

    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
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

    const preview = await this.computePricingPreview({
      lines: input.lines,
      discountCode: input.discountCode,
    });

    const count = await prisma.quotation.count();
    const quotationNumber = `QT-2026-${String(count + 1001).padStart(4, "0")}`;
    const issueDate = new Date();
    const expiryDate = new Date(issueDate.getTime() + input.validityDays * 24 * 60 * 60 * 1000);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        customerId: customer.id,
        planId: plan.id,
        templateId: input.templateId ?? null,
        discountId: preview.discountId,
        status: "DRAFT",
        issueDate,
        expiryDate,
        subtotal: preview.subtotal,
        discountAmount: preview.discountAmount,
        taxAmount: preview.taxAmount,
        totalAmount: preview.totalAmount,
        notes: input.notes ?? null,
        createdById: session.userId,
        lines: {
          create: preview.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            description: l.description,
            quantity: l.quantity,
            baseUnitPrice: l.baseUnitPrice,
            variantPriceDelta: l.variantPriceDelta,
            unitPrice: l.unitPrice,
            taxRuleId: l.taxRuleId,
            taxRateSnapshot: l.taxRateSnapshot,
            lineSubtotal: l.lineSubtotal,
            lineDiscountAmount: l.lineDiscountAmount,
            lineTaxAmount: l.lineTaxAmount,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: {
        customer: true,
        plan: true,
        discount: true,
        lines: { include: { product: true, variant: true, taxRule: true } },
      },
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "QUOTATION_CREATED",
      entityType: "Quotation",
      entityId: quotation.id,
      afterData: {
        quotationNumber,
        customerId: customer.id,
        totalAmount: quotation.totalAmount.toString(),
      },
    });

    return quotation;
  }

  static async updateQuotationStatus(
    session: AuthSessionContext,
    quotationId: string,
    targetStatus: "DRAFT" | "QUOTATION" | "CONFIRMED" | "EXPIRED" | "CANCELLED"
  ) {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError("FORBIDDEN", "Unauthorized to update quotation status", 403);
    }

    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) throw new AppError("NOT_FOUND", "Quotation not found", 404);

    if (quotation.status === "CANCELLED" && targetStatus !== "DRAFT") {
      throw new AppError("BUSINESS_RULE_VIOLATION", "Cancelled quotation cannot be confirmed", 400);
    }

    if (targetStatus === "CONFIRMED" && quotation.expiryDate.getTime() < Date.now()) {
      await prisma.quotation.update({
        where: { id: quotationId },
        data: { status: "EXPIRED" },
      });
      throw new AppError("BUSINESS_RULE_VIOLATION", "Quotation has expired and cannot be confirmed", 400);
    }

    const updated = await prisma.quotation.update({
      where: { id: quotationId },
      data: { status: targetStatus },
      include: { customer: true, plan: true, lines: true },
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: `QUOTATION_STATUS_${targetStatus}`,
      entityType: "Quotation",
      entityId: quotationId,
      beforeData: { status: quotation.status },
      afterData: { status: updated.status },
    });

    return updated;
  }

  /**
   * 1-Click conversion from CONFIRMED Quotation into a Subscription without re-entering data.
   * Preserves all historical pricing snapshots and records SubscriptionHistory.
   */
  static async convertToSubscription(
    session: AuthSessionContext,
    quotationId: string,
    options?: { activateImmediately?: boolean; startDate?: Date }
  ) {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError("FORBIDDEN", "Only administrators and employees can convert quotations", 403);
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: true,
        plan: true,
        lines: { include: { product: true, variant: true, taxRule: true } },
        subscription: true,
      },
    });

    if (!quotation) throw new AppError("NOT_FOUND", "Quotation not found", 404);
    if (quotation.subscription) {
      throw new AppError(
        "CONFLICT",
        `Quotation ${quotation.quotationNumber} has already been converted to subscription ${quotation.subscription.subscriptionNumber}`,
        409
      );
    }
    if (quotation.status !== "CONFIRMED") {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        "Only CONFIRMED quotations can be converted into subscriptions",
        400
      );
    }

    const startDate = options?.startDate ? new Date(options.startDate) : new Date();
    const anchorBillingDay = startDate.getUTCDate();
    const nextBillingDate = calculateNextBillingDate(
      startDate,
      quotation.plan.billingFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
      anchorBillingDay
    );
    const expiryDate = calculateNextBillingDate(
      startDate,
      "MONTHLY",
      anchorBillingDay,
      quotation.plan.defaultTermMonths
    );

    const subCount = await prisma.subscription.count();
    const subscriptionNumber = `SUB-2026-${String(subCount + 10001).padStart(5, "0")}`;
    const targetStatus = options?.activateImmediately ? "ACTIVE" : "CONFIRMED";

    const subscription = await prisma.$transaction(async (tx) => {
      if (quotation.discountId && toDecimal(quotation.discountAmount).greaterThan(0)) {
        await DiscountService.consumeDiscountAtomically(tx, {
          discountId: quotation.discountId,
          customerId: quotation.customerId,
          discountAmount: toDecimal(quotation.discountAmount),
        });
      }

      const created = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId: quotation.customerId,
          planId: quotation.planId,
          quotationId: quotation.id,
          discountId: quotation.discountId,
          status: targetStatus,
          billingFrequency: quotation.plan.billingFrequency,
          paymentTermsDays: 7,
          startDate,
          expiryDate,
          anchorBillingDay,
          currentPeriodStart: startDate,
          currentPeriodEnd: nextBillingDate,
          nextBillingDate: startDate, // Due immediately for initial cycle billing
          subtotal: quotation.subtotal,
          discountAmount: quotation.discountAmount,
          taxAmount: quotation.taxAmount,
          totalAmount: quotation.totalAmount,
          lines: {
            create: quotation.lines.map((ql) => ({
              productId: ql.productId,
              variantId: ql.variantId,
              productNameSnapshot: ql.product.name,
              variantNameSnapshot: ql.variant?.name ?? null,
              quantity: ql.quantity,
              baseUnitPrice: ql.baseUnitPrice,
              variantPriceDelta: ql.variantPriceDelta,
              unitPrice: ql.unitPrice,
              taxRuleId: ql.taxRuleId,
              taxNameSnapshot: ql.taxRule?.name ?? null,
              taxRateSnapshot: ql.taxRateSnapshot,
              lineSubtotal: ql.lineSubtotal,
              lineDiscountAmount: ql.lineDiscountAmount,
              lineTaxAmount: ql.lineTaxAmount,
              lineTotal: ql.lineTotal,
            })),
          },
          history: {
            create: [
              {
                fromStatus: "QUOTATION",
                toStatus: "CONFIRMED",
                action: "CONVERT_FROM_QUOTATION",
                actorUserId: session.userId,
                reason: `Converted from quotation ${quotation.quotationNumber}`,
              },
              ...(targetStatus === "ACTIVE"
                ? [
                    {
                      fromStatus: "CONFIRMED",
                      toStatus: "ACTIVE",
                      action: "ACTIVATE",
                      actorUserId: session.userId,
                      reason: "Activated upon quotation conversion",
                    },
                  ]
                : []),
            ],
          },
        },
        include: {
          customer: true,
          plan: true,
          lines: true,
          history: true,
        },
      });

      return created;
    });

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "QUOTATION_CONVERTED_TO_SUBSCRIPTION",
      entityType: "Subscription",
      entityId: subscription.id,
      afterData: {
        quotationNumber: quotation.quotationNumber,
        subscriptionNumber: subscription.subscriptionNumber,
        status: subscription.status,
      },
    });

    return subscription;
  }

  static async getQuotationById(session: AuthSessionContext, quotationId: string) {
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: true,
        plan: true,
        discount: true,
        subscription: true,
        lines: { include: { product: true, variant: true, taxRule: true } },
      },
    });
    if (!quotation) throw new AppError("NOT_FOUND", "Quotation not found", 404);
    assertCustomerAccess(session, quotation.customerId);
    return quotation;
  }
}
