import { prisma } from "@/server/db/client";

export interface WriteAuditLogInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
}

export class AuditService {
  static async log(input: WriteAuditLogInput) {
    return prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeJson: input.beforeData !== undefined ? JSON.stringify(input.beforeData) : null,
        afterJson: input.afterData !== undefined ? JSON.stringify(input.afterData) : null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }
}
