import { addMoney, round2, subMoney, toDecimal } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { assertCustomerAccess, AuthSessionContext } from "@/server/middlewares/auth";
import { AuditService } from "@/server/services/audit.service";
import { NotificationService } from "@/server/services/notification.service";
import { recordPaymentSchema, refundPaymentSchema } from "@/server/validators/schemas";
import crypto from "crypto";
import Decimal from "decimal.js";
import { z } from "zod";

export class PaymentService {
  /**
   * Computes expected Razorpay HMAC SHA-256 signature for `orderId|paymentId`.
   */
  static computeRazorpayPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    secret = process.env.RAZORPAY_KEY_SECRET || "rzp_test_BilloraSecretKey99887766"
  ): string {
    return crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
  }

  /**
   * Computes expected Razorpay Webhook HMAC SHA-256 signature for raw request body.
   */
  static computeRazorpayWebhookSignature(
    rawBody: string,
    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "whsec_BilloraWebhookSecret11223344"
  ): string {
    return crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  }

  /**
   * Records a verified payment against an invoice inside a DB transaction.
   * Supports partial and full payments.
   * An invoice transitions to `PAID` ONLY when `outstandingAmount == 0`.
   */
  static async recordPayment(
    session: AuthSessionContext,
    rawInput: z.infer<typeof recordPaymentSchema>
  ) {
    const input = recordPaymentSchema.parse(rawInput);

    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { customer: true },
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);

    assertCustomerAccess(session, invoice.customerId);

    if (invoice.status === "CANCELLED") {
      throw new AppError("BUSINESS_RULE_VIOLATION", "Cannot record payment for a cancelled invoice", 400);
    }

    const currentOutstanding = round2(invoice.outstandingAmount);
    const paymentAmount = round2(input.amount);

    if (currentOutstanding.lessThanOrEqualTo(0)) {
      throw new AppError("BUSINESS_RULE_VIOLATION", "Invoice is already paid in full", 400);
    }

    if (paymentAmount.greaterThan(currentOutstanding)) {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        `Payment amount (₹${paymentAmount}) cannot exceed outstanding balance (₹${currentOutstanding})`,
        400
      );
    }

    if (input.transactionReference) {
      const dupRef = await prisma.payment.findUnique({
        where: { transactionReference: input.transactionReference },
      });
      if (dupRef) {
        throw new AppError("CONFLICT", "Duplicate payment transaction reference", 409);
      }
    }

    const count = await prisma.payment.count();
    const paymentNumber = `PAY-2026-${String(count + 10001).padStart(5, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          method: input.method,
          amount: paymentAmount,
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          transactionReference: input.transactionReference ?? null,
          status: "VERIFIED",
          notes: input.notes ?? null,
          recordedById: session.userId,
        },
      });

      const newAmountPaid = addMoney(invoice.amountPaid, paymentAmount);
      const newOutstanding = Decimal.max(new Decimal(0), subMoney(invoice.totalAmount, newAmountPaid));
      const newStatus = newOutstanding.equals(0) ? "PAID" : "CONFIRMED";

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: round2(newAmountPaid),
          outstandingAmount: round2(newOutstanding),
          status: newStatus,
          paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt,
        },
      });

      return { payment, updatedInvoice };
    });

    if (invoice.customer.userId) {
      await NotificationService.notify({
        userId: invoice.customer.userId,
        eventType: "PAYMENT_SUCCESS",
        title: `Payment Received (${result.payment.paymentNumber})`,
        message: `We received ₹${paymentAmount} for Invoice ${invoice.invoiceNumber}. Remaining balance: ₹${result.updatedInvoice.outstandingAmount}.`,
        idempotencyKey: `notif_pay_${result.payment.id}`,
      });
    }

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: result.payment.id,
      afterData: {
        paymentNumber: result.payment.paymentNumber,
        invoiceId: invoice.id,
        amount: paymentAmount.toString(),
        newInvoiceStatus: result.updatedInvoice.status,
        outstandingAmount: result.updatedInvoice.outstandingAmount.toString(),
      },
    });

    return result;
  }

  /**
   * Creates a server-side Razorpay Order for an invoice's outstanding balance (or specified partial amount).
   */
  static async createRazorpayOrder(
    session: AuthSessionContext,
    invoiceId: string,
    requestedAmount?: number
  ) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
    assertCustomerAccess(session, invoice.customerId);

    const outstanding = round2(invoice.outstandingAmount);
    if (outstanding.lessThanOrEqualTo(0)) {
      throw new AppError("BUSINESS_RULE_VIOLATION", "Invoice has no outstanding balance", 400);
    }

    const orderAmount = requestedAmount ? round2(requestedAmount) : outstanding;
    if (orderAmount.lessThanOrEqualTo(0) || orderAmount.greaterThan(outstanding)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Order amount must be between ₹0.01 and ₹${outstanding}`,
        400
      );
    }

    const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
    const count = await prisma.payment.count();
    const paymentNumber = `PAY-2026-${String(count + 10001).padStart(5, "0")}-${Math.floor(100 + Math.random() * 900)}`;

    const pendingPayment = await prisma.payment.create({
      data: {
        paymentNumber,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        method: "RAZORPAY",
        amount: orderAmount,
        razorpayOrderId,
        status: "PENDING",
        recordedById: session.userId,
      },
    });

    return {
      orderId: razorpayOrderId,
      amountInPaise: orderAmount.times(100).toNumber(),
      amount: orderAmount.toNumber(),
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_BilloraKeyId001",
      paymentId: pendingPayment.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.contactName,
      customerEmail: invoice.customer.email,
      // Provide test signature helper in non-production for seamless E2E/browser verification
      testSignaturePreview:
        process.env.NODE_ENV !== "production"
          ? {
              sampleRazorpayPaymentId: `pay_${ razorpayOrderId.slice(6) }`,
              sampleSignature: this.computeRazorpayPaymentSignature(
                razorpayOrderId,
                `pay_${ razorpayOrderId.slice(6) }`
              ),
            }
          : undefined,
    };
  }

  /**
   * Verifies Razorpay HMAC SHA-256 signature on the server before marking payment VERIFIED
   * and updating invoice balances. Never trusts client-side payment status without signature verification.
   */
  static async verifyRazorpayPayment(
    session: AuthSessionContext,
    params: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  ) {
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: params.razorpayOrderId },
      include: { invoice: { include: { customer: true } } },
    });
    if (!payment) {
      throw new AppError("NOT_FOUND", "Razorpay order not found", 404);
    }

    assertCustomerAccess(session, payment.customerId);

    if (payment.status === "VERIFIED") {
      return {
        alreadyVerified: true,
        payment,
        invoice: payment.invoice,
      };
    }

    const expectedSignature = this.computeRazorpayPaymentSignature(
      params.razorpayOrderId,
      params.razorpayPaymentId
    );

    const sigBufA = Buffer.from(expectedSignature);
    const sigBufB = Buffer.from(params.razorpaySignature || "");
    const isValid =
      sigBufA.length === sigBufB.length && crypto.timingSafeEqual(sigBufA, sigBufB);

    if (!isValid) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: "Invalid Razorpay HMAC signature",
        },
      });
      throw new AppError("UNAUTHORIZED", "Invalid Razorpay payment signature", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const freshInv = await tx.invoice.findUniqueOrThrow({
        where: { id: payment.invoiceId },
      });

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "VERIFIED",
          razorpayPaymentId: params.razorpayPaymentId,
          razorpaySignature: params.razorpaySignature,
          transactionReference: params.razorpayPaymentId,
          paymentDate: new Date(),
        },
      });

      const newAmountPaid = addMoney(freshInv.amountPaid, payment.amount);
      const newOutstanding = Decimal.max(
        new Decimal(0),
        subMoney(freshInv.totalAmount, newAmountPaid)
      );
      const newStatus = newOutstanding.equals(0) ? "PAID" : "CONFIRMED";

      const updatedInvoice = await tx.invoice.update({
        where: { id: freshInv.id },
        data: {
          amountPaid: round2(newAmountPaid),
          outstandingAmount: round2(newOutstanding),
          status: newStatus,
          paidAt: newStatus === "PAID" ? new Date() : freshInv.paidAt,
        },
      });

      return { payment: updatedPayment, invoice: updatedInvoice };
    });

    return {
      alreadyVerified: false,
      ...result,
    };
  }

  /**
   * Processes incoming Razorpay Webhook events with HMAC signature verification
   * and idempotent event deduplication (`WebhookEvent` table).
   */
  static async processRazorpayWebhook(rawBody: string, signatureHeader: string) {
    const expectedSignature = this.computeRazorpayWebhookSignature(rawBody);
    const bufA = Buffer.from(expectedSignature);
    const bufB = Buffer.from(signatureHeader || "");

    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      throw new AppError("UNAUTHORIZED", "Invalid Razorpay webhook signature", 401);
    }

    const payload = JSON.parse(rawBody) as {
      id: string;
      event: string;
      payload?: {
        payment?: {
          entity?: {
            id: string;
            order_id: string;
            amount: number;
            status: string;
            error_description?: string;
          };
        };
      };
    };

    if (!payload.id || !payload.event) {
      throw new AppError("VALIDATION_ERROR", "Malformed webhook payload", 400);
    }

    // Check idempotency in WebhookEvent table
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId: payload.id },
    });
    if (existingEvent) {
      return { duplicate: true, eventId: payload.id };
    }

    const entity = payload.payload?.payment?.entity;

    await prisma.$transaction(async (tx) => {
      await tx.webhookEvent.create({
        data: {
          provider: "RAZORPAY",
          eventId: payload.id,
          eventType: payload.event,
          payloadJson: rawBody,
        },
      });

      if (payload.event === "payment.captured" && entity?.order_id) {
        const payment = await tx.payment.findUnique({
          where: { razorpayOrderId: entity.order_id },
        });

        if (payment && payment.status !== "VERIFIED") {
          const invoice = await tx.invoice.findUniqueOrThrow({
            where: { id: payment.invoiceId },
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "VERIFIED",
              razorpayPaymentId: entity.id,
              transactionReference: entity.id,
              paymentDate: new Date(),
            },
          });

          const newAmountPaid = addMoney(invoice.amountPaid, payment.amount);
          const newOutstanding = Decimal.max(
            new Decimal(0),
            subMoney(invoice.totalAmount, newAmountPaid)
          );
          const newStatus = newOutstanding.equals(0) ? "PAID" : "CONFIRMED";

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: round2(newAmountPaid),
              outstandingAmount: round2(newOutstanding),
              status: newStatus,
              paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt,
            },
          });
        }
      } else if (payload.event === "payment.failed" && entity?.order_id) {
        await tx.payment.updateMany({
          where: { razorpayOrderId: entity.order_id, status: "PENDING" },
          data: {
            status: "FAILED",
            failureReason: entity.error_description ?? "Payment failed at gateway",
          },
        });
      }
    });

    return { duplicate: false, eventId: payload.id, eventType: payload.event };
  }

  /**
   * Records a refund on a verified payment and adjusts the invoice balance accordingly.
   */
  static async refundPayment(
    session: AuthSessionContext,
    rawInput: z.infer<typeof refundPaymentSchema>
  ) {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError("FORBIDDEN", "Only administrators and employees can process refunds", 403);
    }

    const input = refundPaymentSchema.parse(rawInput);
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: { invoice: true },
    });
    if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
    if (payment.status !== "VERIFIED") {
      throw new AppError("BUSINESS_RULE_VIOLATION", "Only VERIFIED payments can be refunded", 400);
    }

    const refundDec = round2(input.refundAmount);
    const maxRefundable = subMoney(payment.amount, payment.refundedAmount);
    if (refundDec.greaterThan(maxRefundable)) {
      throw new AppError(
        "BUSINESS_RULE_VIOLATION",
        `Refund amount (₹${refundDec}) exceeds refundable balance (₹${maxRefundable})`,
        400
      );
    }

    return prisma.$transaction(async (tx) => {
      const newRefundedTotal = addMoney(payment.refundedAmount, refundDec);
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: newRefundedTotal,
          status: newRefundedTotal.equals(toDecimal(payment.amount)) ? "REFUNDED" : "VERIFIED",
          notes: payment.notes ? `${payment.notes} | Refund: ${input.reason}` : `Refund: ${input.reason}`,
        },
      });

      const newAmountPaid = Decimal.max(
        new Decimal(0),
        subMoney(payment.invoice.amountPaid, refundDec)
      );
      const newOutstanding = subMoney(payment.invoice.totalAmount, newAmountPaid);

      const updatedInvoice = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: round2(newAmountPaid),
          outstandingAmount: round2(newOutstanding),
          status: newOutstanding.greaterThan(0) ? "CONFIRMED" : "PAID",
        },
      });

      return { payment: updatedPayment, invoice: updatedInvoice };
    });
  }
}
