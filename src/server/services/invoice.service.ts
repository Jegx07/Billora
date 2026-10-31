import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { assertCustomerAccess, AuthSessionContext } from "@/server/middlewares/auth";
import { AuditService } from "@/server/services/audit.service";
import { NotificationService } from "@/server/services/notification.service";

export class InvoiceService {
  static async getInvoiceById(session: AuthSessionContext, invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        subscription: { include: { plan: true } },
        discount: true,
        lines: { include: { product: true, variant: true, taxRule: true } },
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
    assertCustomerAccess(session, invoice.customerId);

    const isOverdue =
      invoice.status === "CONFIRMED" &&
      Number(invoice.outstandingAmount) > 0 &&
      invoice.dueDate.getTime() < Date.now();

    return {
      ...invoice,
      isOverdue,
    };
  }

  static async updateInvoiceStatus(
    session: AuthSessionContext,
    invoiceId: string,
    action: "CONFIRM" | "CANCEL" | "SEND_REMINDER"
  ) {
    if (session.role !== "ADMIN" && session.role !== "EMPLOYEE") {
      throw new AppError("FORBIDDEN", "Only administrators and employees can manage invoices", 403);
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);

    if (action === "SEND_REMINDER") {
      if (invoice.customer.userId) {
        await NotificationService.notify({
          userId: invoice.customer.userId,
          eventType: "PAYMENT_OVERDUE",
          title: `Payment Reminder: Invoice ${invoice.invoiceNumber}`,
          message: `Friendly reminder that Invoice ${invoice.invoiceNumber} has an outstanding balance of ₹${invoice.outstandingAmount} due on ${invoice.dueDate.toISOString().slice(0, 10)}.`,
        });
      }
      await AuditService.log({
        actorId: session.userId,
        actorRole: session.role,
        action: "INVOICE_REMINDER_SENT",
        entityType: "Invoice",
        entityId: invoiceId,
      });
      return invoice;
    }

    if (action === "CANCEL") {
      if (invoice.status === "PAID" || Number(invoice.amountPaid) > 0) {
        throw new AppError(
          "BUSINESS_RULE_VIOLATION",
          "Cannot cancel an invoice that already has verified payments",
          400
        );
      }
      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: "CANCELLED", cancelledAt: new Date(), outstandingAmount: 0 },
      });
      await AuditService.log({
        actorId: session.userId,
        actorRole: session.role,
        action: "INVOICE_CANCELLED",
        entityType: "Invoice",
        entityId: invoiceId,
      });
      return updated;
    }

    // action === "CONFIRM"
    if (invoice.status !== "DRAFT") {
      throw new AppError("BUSINESS_RULE_VIOLATION", "Only DRAFT invoices can be confirmed", 400);
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "CONFIRMED" },
    });

    if (invoice.customer.userId) {
      await NotificationService.notify({
        userId: invoice.customer.userId,
        eventType: "INVOICE_CONFIRMED",
        title: `Invoice ${invoice.invoiceNumber} Confirmed`,
        message: `Your invoice ${invoice.invoiceNumber} for ₹${invoice.totalAmount} has been confirmed.`,
        idempotencyKey: `inv_confirmed_${invoice.id}`,
      });
    }

    await AuditService.log({
      actorId: session.userId,
      actorRole: session.role,
      action: "INVOICE_CONFIRMED",
      entityType: "Invoice",
      entityId: invoiceId,
    });

    return updated;
  }

  /**
   * Queries all overdue invoices (CONFIRMED status, outstandingAmount > 0, dueDate < asOfDate).
   */
  static async findOverdueInvoices(asOfDate: Date = new Date(), customerId?: string) {
    return prisma.invoice.findMany({
      where: {
        status: "CONFIRMED",
        outstandingAmount: { gt: 0 },
        dueDate: { lt: asOfDate },
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: true,
        subscription: true,
      },
      orderBy: { dueDate: "asc" },
    });
  }
}
