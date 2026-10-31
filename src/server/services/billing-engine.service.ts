import {
  BillingFrequencyType,
  buildBillingIdempotencyKey,
  calculateNextBillingDate,
} from "@/lib/dates";
import { round2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { NotificationService } from "@/server/services/notification.service";

export interface SingleBillingResult {
  subscriptionId: string;
  subscriptionNumber: string;
  status: "GENERATED" | "SKIPPED_DUPLICATE" | "SKIPPED_NOT_DUE" | "FAILED";
  invoiceId?: string;
  invoiceNumber?: string;
  idempotencyKey?: string;
  error?: string;
}

// Process-level mutex map to serialize concurrent in-process worker invocations per subscription
const subscriptionLocks = new Map<string, Promise<unknown>>();

async function withSubscriptionLock<T>(subscriptionId: string, fn: () => Promise<T>): Promise<T> {
  const prev = subscriptionLocks.get(subscriptionId) ?? Promise.resolve();
  let release!: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  subscriptionLocks.set(subscriptionId, prev.then(() => nextLock));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (subscriptionLocks.get(subscriptionId) === nextLock) {
      subscriptionLocks.delete(subscriptionId);
    }
  }
}

export class BillingEngineService {
  /**
   * Processes a single subscription's due billing cycle inside an atomic database transaction.
   * Guarantees zero duplicate invoices via:
   * 1. Per-subscription lock + transactional check of `nextBillingDate` and `status === "ACTIVE"`
   * 2. Deterministic `idempotencyKey = bill_${subscriptionId}_${periodStart}_${periodEnd}`
   * 3. Database unique constraint `@@unique([subscriptionId, billingPeriodStart, billingPeriodEnd])`
   *    on both `BillingPeriod` and `Invoice`.
   */
  static async billSubscriptionPeriod(
    subscriptionId: string,
    asOfDate: Date = new Date(),
    explicitPeriodStart?: Date
  ): Promise<SingleBillingResult> {
    return withSubscriptionLock(subscriptionId, async () => {
      const subSnapshot = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          customer: true,
          plan: true,
          lines: true,
        },
      });

      if (!subSnapshot) {
        throw new AppError("NOT_FOUND", `Subscription ${subscriptionId} not found`, 404);
      }

      if (subSnapshot.status !== "ACTIVE") {
        return {
          subscriptionId,
          subscriptionNumber: subSnapshot.subscriptionNumber,
          status: "SKIPPED_NOT_DUE",
        };
      }

      const periodStart = explicitPeriodStart ?? subSnapshot.nextBillingDate;
      if (periodStart.getTime() > asOfDate.getTime()) {
        return {
          subscriptionId,
          subscriptionNumber: subSnapshot.subscriptionNumber,
          status: "SKIPPED_NOT_DUE",
        };
      }

      const frequency = subSnapshot.billingFrequency as BillingFrequencyType;
      const periodEnd = calculateNextBillingDate(
        periodStart,
        frequency,
        subSnapshot.anchorBillingDay
      );
      const idempotencyKey = buildBillingIdempotencyKey(
        subscriptionId,
        periodStart,
        periodEnd
      );

      // Fast pre-check for existing BillingPeriod or Invoice by idempotencyKey
      const existingPeriod = await prisma.billingPeriod.findUnique({
        where: { idempotencyKey },
        include: { invoice: true },
      });

      if (existingPeriod?.invoice) {
        return {
          subscriptionId,
          subscriptionNumber: subSnapshot.subscriptionNumber,
          status: "SKIPPED_DUPLICATE",
          invoiceId: existingPeriod.invoice.id,
          invoiceNumber: existingPeriod.invoice.invoiceNumber,
          idempotencyKey,
        };
      }

      try {
        const txResult = await prisma.$transaction(async (tx) => {
          // Re-verify inside transaction with conditional atomic update on nextBillingDate
          const freshSub = await tx.subscription.findUniqueOrThrow({
            where: { id: subscriptionId },
            include: { lines: true, customer: true, plan: true },
          });

          const alreadyBilled = await tx.billingPeriod.findUnique({
            where: { idempotencyKey },
            include: { invoice: true },
          });

          if (alreadyBilled?.invoice) {
            return {
              duplicate: true,
              invoice: alreadyBilled.invoice,
            };
          }

          // Atomically claim the billing period by advancing nextBillingDate only if it matches freshSub.nextBillingDate
          const claim = await tx.subscription.updateMany({
            where: {
              id: subscriptionId,
              status: "ACTIVE",
              nextBillingDate: freshSub.nextBillingDate,
            },
            data: {
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              nextBillingDate: periodEnd,
            },
          });

          if (claim.count === 0 && !explicitPeriodStart) {
            const raceInvoice = await tx.invoice.findFirst({
              where: { idempotencyKey },
            });
            if (raceInvoice) {
              return { duplicate: true, invoice: raceInvoice };
            }
          }

          const billingPeriod = await tx.billingPeriod.create({
            data: {
              subscriptionId,
              billingPeriodStart: periodStart,
              billingPeriodEnd: periodEnd,
              idempotencyKey,
              status: "COMPLETED",
              attemptCount: 1,
            },
          });

          const dueDate = new Date(
            asOfDate.getTime() + freshSub.paymentTermsDays * 24 * 60 * 60 * 1000
          );

          // Generate unique sequential/deterministic invoice number
          const invCount = await tx.invoice.count();
          const randSuffix = Math.floor(100 + Math.random() * 900);
          const invoiceNumber = `INV-2026-${String(invCount + 10001).padStart(5, "0")}-${randSuffix}`;

          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              customerId: freshSub.customerId,
              subscriptionId: freshSub.id,
              billingPeriodId: billingPeriod.id,
              billingPeriodStart: periodStart,
              billingPeriodEnd: periodEnd,
              idempotencyKey,
              discountId: freshSub.discountId,
              invoiceDate: asOfDate,
              dueDate,
              status: "CONFIRMED",
              subtotal: round2(freshSub.subtotal),
              discountAmount: round2(freshSub.discountAmount),
              taxAmount: round2(freshSub.taxAmount),
              totalAmount: round2(freshSub.totalAmount),
              amountPaid: round2(0),
              outstandingAmount: round2(freshSub.totalAmount),
              notes: `Automated recurring invoice for ${freshSub.subscriptionNumber} (${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)})`,
              lines: {
                create: freshSub.lines.map((sl) => ({
                  productId: sl.productId,
                  variantId: sl.variantId,
                  productNameSnapshot: sl.productNameSnapshot,
                  variantNameSnapshot: sl.variantNameSnapshot,
                  description: sl.variantNameSnapshot
                    ? `${sl.productNameSnapshot} (${sl.variantNameSnapshot})`
                    : sl.productNameSnapshot,
                  quantity: sl.quantity,
                  baseUnitPrice: round2(sl.baseUnitPrice),
                  variantPriceDelta: round2(sl.variantPriceDelta),
                  unitPrice: round2(sl.unitPrice),
                  taxRuleId: sl.taxRuleId,
                  taxNameSnapshot: sl.taxNameSnapshot,
                  taxRateSnapshot: round2(sl.taxRateSnapshot),
                  lineSubtotal: round2(sl.lineSubtotal),
                  lineDiscountAmount: round2(sl.lineDiscountAmount),
                  lineTaxAmount: round2(sl.lineTaxAmount),
                  lineTotal: round2(sl.lineTotal),
                })),
              },
            },
          });

          return { duplicate: false, invoice, customerUserId: freshSub.customer.userId };
        });

        if (txResult.duplicate) {
          return {
            subscriptionId,
            subscriptionNumber: subSnapshot.subscriptionNumber,
            status: "SKIPPED_DUPLICATE",
            invoiceId: txResult.invoice.id,
            invoiceNumber: txResult.invoice.invoiceNumber,
            idempotencyKey,
          };
        }

        if (txResult.customerUserId) {
          await NotificationService.notify({
            userId: txResult.customerUserId,
            eventType: "INVOICE_GENERATED",
            title: `New Invoice ${txResult.invoice.invoiceNumber}`,
            message: `Invoice ${txResult.invoice.invoiceNumber} for ₹${txResult.invoice.totalAmount} has been generated for subscription ${subSnapshot.subscriptionNumber}.`,
            idempotencyKey: `notif_inv_${idempotencyKey}`,
          });
        }

        return {
          subscriptionId,
          subscriptionNumber: subSnapshot.subscriptionNumber,
          status: "GENERATED",
          invoiceId: txResult.invoice.id,
          invoiceNumber: txResult.invoice.invoiceNumber,
          idempotencyKey,
        };
      } catch (err: unknown) {
        // Handle unique constraint violations gracefully as idempotent duplicate skips
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Unique constraint failed") || msg.includes("UNIQUE constraint failed")) {
          const existingInv = await prisma.invoice.findFirst({
            where: {
              OR: [
                { idempotencyKey },
                {
                  subscriptionId,
                  billingPeriodStart: periodStart,
                  billingPeriodEnd: periodEnd,
                },
              ],
            },
          });
          if (existingInv) {
            return {
              subscriptionId,
              subscriptionNumber: subSnapshot.subscriptionNumber,
              status: "SKIPPED_DUPLICATE",
              invoiceId: existingInv.id,
              invoiceNumber: existingInv.invoiceNumber,
              idempotencyKey,
            };
          }
        }

        return {
          subscriptionId,
          subscriptionNumber: subSnapshot.subscriptionNumber,
          status: "FAILED",
          idempotencyKey,
          error: msg,
        };
      }
    });
  }

  /**
   * Finds all eligible ACTIVE subscriptions whose `nextBillingDate <= asOfDate`
   * and executes recurring billing for each one, recording a `BillingJobRun` summary.
   */
  static async runDueBillingCycle(options?: {
    asOfDate?: Date;
    triggeredBy?: "SCHEDULER" | "MANUAL" | "BULLMQ";
    subscriptionIds?: string[];
  }) {
    const asOfDate = options?.asOfDate ? new Date(options.asOfDate) : new Date();
    const triggeredBy = options?.triggeredBy ?? "MANUAL";

    const dueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        nextBillingDate: { lte: asOfDate },
        ...(options?.subscriptionIds?.length ? { id: { in: options.subscriptionIds } } : {}),
      },
      select: { id: true, subscriptionNumber: true },
      orderBy: { nextBillingDate: "asc" },
    });

    const runCode = `RUN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const jobRun = await prisma.billingJobRun.create({
      data: {
        runCode,
        triggeredBy,
        status: "RUNNING",
        eligibleCount: dueSubscriptions.length,
      },
    });

    const results: SingleBillingResult[] = [];
    let generatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const sub of dueSubscriptions) {
      const res = await this.billSubscriptionPeriod(sub.id, asOfDate);
      results.push(res);
      if (res.status === "GENERATED") generatedCount++;
      else if (res.status === "FAILED") failedCount++;
      else skippedCount++;
    }

    const finalStatus =
      failedCount > 0 ? (generatedCount > 0 ? "PARTIAL_FAILURE" : "FAILED") : "COMPLETED";

    const updatedRun = await prisma.billingJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: finalStatus,
        generatedCount,
        skippedCount,
        failedCount,
        detailsJson: JSON.stringify(results.slice(0, 100)),
        completedAt: new Date(),
      },
    });

    return {
      jobRun: updatedRun,
      results,
    };
  }
}
