"use client";

import { DataTable, PageHeader, StatusBadge } from "@/components/ui/Primitives";
import React, { useEffect, useState } from "react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/audit-logs?page=${page}&pageSize=30`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setLogs(json.data);
          setTotalPages(json.meta?.totalPages || 1);
        }
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <PageHeader
        category="IMMUTABLE SECURITY LEDGER"
        title="System Audit Logs"
        description="Administrator-only cryptographic audit trail of employee creations, catalog edits, state transitions, and payment verifications."
      />

      <DataTable
        columns={[
          {
            key: "time",
            header: "Timestamp (UTC)",
            mono: true,
            render: (r) => new Date(r.createdAt).toISOString().slice(0, 19).replace("T", " "),
          },
          {
            key: "actor",
            header: "Actor",
            render: (r) => (
              <div>
                <div className="font-semibold text-text-primary">
                  {r.actor?.fullName || "System / Webhook"}
                </div>
                <div className="font-mono text-[10px] text-text-muted">
                  {r.actorRole || "SYSTEM"}
                </div>
              </div>
            ),
          },
          {
            key: "action",
            header: "Action",
            mono: true,
            render: (r) => <StatusBadge status={r.action} />,
          },
          {
            key: "entity",
            header: "Entity Type & ID",
            mono: true,
            render: (r) => (
              <span>
                {r.entityType} ({r.entityId.slice(0, 12)})
              </span>
            ),
          },
          {
            key: "payload",
            header: "Recorded Snapshot",
            mono: true,
            render: (r) => (
              <span className="text-[11px] text-text-secondary truncate block max-w-md">
                {r.afterJson || r.beforeJson || "—"}
              </span>
            ),
          },
        ]}
        data={logs}
        rowKey={(r) => r.id}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
