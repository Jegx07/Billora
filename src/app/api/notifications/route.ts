import { getOrSetServerCache } from "@/server/cache/query-cache";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { NotificationService } from "@/server/services/notification.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const countOnly = searchParams.get("countOnly") === "true";

    if (countOnly) {
      const unreadCount = await getOrSetServerCache(
        `notif:count:${session.userId}`,
        15_000,
        () =>
          prisma.notification.count({
            where: { userId: session.userId, isRead: false },
          })
      );
      return apiSuccess({ unreadCount });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    return apiSuccess({ notifications, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    if (body.markAll) {
      await NotificationService.markAllAsRead(session.userId);
    } else if (body.notificationId) {
      await NotificationService.markAsRead(body.notificationId, session.userId);
    }
    return apiSuccess({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
