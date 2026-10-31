"use client";

import { PageHeader, StatusBadge, useToast } from "@/components/ui/Primitives";
import { Bell, CheckCheck } from "lucide-react";
import React, { useEffect, useState } from "react";

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadNotifications = async () => {
    const res = await fetch("/api/notifications");
    const json = await res.json();
    if (json.success) {
      setNotifications(json.data.notifications || []);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    toast({ title: "All notifications marked as read", variant: "info" });
    loadNotifications();
  };

  return (
    <div>
      <PageHeader
        category="AUTOMATED NOTIFICATION SERVICE"
        title="Notifications & Delivery Logs"
        description="Idempotent email and in-app notifications for welcome, invoice generation, payment settlement, renewals, and overdue reminders."
        actions={
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-bg-base px-3 text-xs font-medium text-text-primary hover:bg-bg-subtle"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark All as Read
          </button>
        }
      />

      <div className="rounded-lg border border-border bg-bg-base divide-y divide-border shadow-xs">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">No notifications recorded.</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-4 p-4 text-xs">
              <div className="flex items-start gap-3">
                <Bell className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-text-primary">{n.title}</div>
                  <div className="mt-0.5 text-text-secondary">{n.message}</div>
                  <div className="mt-1 font-mono text-[10px] text-text-muted">
                    Event: {n.eventType} • Channel: {n.channel} •{" "}
                    {new Date(n.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </div>
                </div>
              </div>
              <StatusBadge status={n.deliveryStatus} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
