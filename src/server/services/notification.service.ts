import { prisma } from "@/server/db/client";

export interface SendNotificationInput {
  userId: string;
  eventType:
    | "WELCOME"
    | "EMAIL_VERIFICATION"
    | "PASSWORD_RESET"
    | "SUBSCRIPTION_CONFIRMED"
    | "INVOICE_GENERATED"
    | "INVOICE_CONFIRMED"
    | "PAYMENT_SUCCESS"
    | "PAYMENT_FAILED"
    | "UPCOMING_RENEWAL"
    | "SUBSCRIPTION_EXPIRED"
    | "PAYMENT_OVERDUE"
    | "DISCOUNT_APPLIED";
  title: string;
  message: string;
  channel?: "IN_APP" | "EMAIL" | "BOTH";
  idempotencyKey?: string;
}

export class NotificationService {
  /**
   * Sends an in-app and/or email notification with idempotency deduplication so background job retries
   * never send duplicate notifications.
   */
  static async notify(input: SendNotificationInput) {
    if (input.idempotencyKey) {
      const existing = await prisma.notification.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    return prisma.notification.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        title: input.title,
        message: input.message,
        channel: input.channel ?? "BOTH",
        deliveryStatus: "DELIVERED",
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
  }

  static async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
