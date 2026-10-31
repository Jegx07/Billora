import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { NotificationService } from "@/server/services/notification.service";

export interface RequestApprovalInput {
  type:
    | "DISCOUNT_OVERRIDE"
    | "CANCELLATION"
    | "REFUND"
    | "HIGH_VALUE_QUOTATION"
    | "BULK_EMAIL"
    | "TASK_COMPLETION";
  title: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  approverId?: string;
  taskId?: string;
  workflowExecutionId?: string;
  metadata?: Record<string, any>;
}

export class ApprovalService {
  /**
   * Submit an approval request
   */
  static async requestApproval(session: AuthSessionContext, input: RequestApprovalInput) {
    const count = await prisma.workflowApproval.count();
    const approvalCode = `APR-${new Date().getFullYear()}-${String(count + 101).padStart(4, "0")}`;

    // If approver not specified, assign to any available Admin or designated Manager
    let approverId = input.approverId;
    if (!approverId) {
      const adminUser = await prisma.user.findFirst({
        where: { role: { name: "ADMIN" } },
      });
      approverId = adminUser?.id;
    }

    const approval = await prisma.workflowApproval.create({
      data: {
        approvalCode,
        type: input.type,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        requestedById: session.userId,
        approverId: approverId ?? null,
        taskId: input.taskId ?? null,
        workflowExecutionId: input.workflowExecutionId ?? null,
        status: "PENDING",
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true } },
        approver: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (approverId && approverId !== session.userId) {
      await NotificationService.notify({
        userId: approverId,
        eventType: "WELCOME",
        title: `Approval Requested: ${approval.approvalCode}`,
        message: `${session.fullName} submitted a ${input.type.replace(/_/g, " ")} request: "${input.title}".`,
        channel: "IN_APP",
      });
    }

    return approval;
  }

  /**
   * List approvals with filters
   */
  static async listApprovals(
    session: AuthSessionContext,
    query: {
      status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL";
      type?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status && query.status !== "ALL") {
      where.status = query.status;
    }
    if (query.type && query.type !== "ALL") {
      where.type = query.type;
    }

    // Role filtering: EMPLOYEE sees their requests or assigned approvals; ADMIN sees all
    if (session.role === "EMPLOYEE") {
      where.OR = [
        { requestedById: session.userId },
        { approverId: session.userId },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.workflowApproval.count({ where }),
      prisma.workflowApproval.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, fullName: true, email: true } },
          approver: { select: { id: true, fullName: true, email: true } },
          task: { select: { id: true, taskCode: true, title: true, priority: true } },
          workflowExecution: { select: { id: true, executionCode: true, workflow: { select: { name: true } } } },
        },
        orderBy: { requestedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Approve or reject an approval request
   */
  static async decideApproval(
    session: AuthSessionContext,
    approvalId: string,
    decision: "APPROVED" | "REJECTED",
    comment?: string
  ) {
    const approval = await prisma.workflowApproval.findUnique({
      where: { id: approvalId },
      include: {
        requestedBy: true,
      },
    });

    if (!approval) throw new AppError("NOT_FOUND", "Approval request not found", 404);
    if (approval.status !== "PENDING") {
      throw new AppError("CONFLICT", `This request has already been ${approval.status.toLowerCase()}`, 409);
    }

    // Role check: Only ADMIN, designated approver, or supervisor can decide
    if (session.role !== "ADMIN" && approval.approverId && approval.approverId !== session.userId) {
      throw new AppError("FORBIDDEN", "You are not authorized to decide this approval request", 403);
    }

    const updated = await prisma.workflowApproval.update({
      where: { id: approvalId },
      data: {
        status: decision,
        approverId: session.userId,
        decisionComment: comment?.trim() ?? null,
        decidedAt: new Date(),
      },
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true } },
        approver: { select: { id: true, fullName: true, email: true } },
      },
    });

    // Notify requester
    await NotificationService.notify({
      userId: approval.requestedById,
      eventType: "WELCOME",
      title: `Approval ${decision}: ${approval.approvalCode}`,
      message: `Your ${approval.type.replace(/_/g, " ")} request was ${decision.toLowerCase()} by ${session.fullName}.${comment ? ` Note: "${comment}"` : ""}`,
      channel: "IN_APP",
    });

    // If attached to a task, update task status accordingly
    if (approval.taskId) {
      if (decision === "APPROVED") {
        await prisma.workflowTask.update({
          where: { id: approval.taskId },
          data: { status: "COMPLETED", completedAt: new Date(), progress: 100 },
        });
      } else {
        await prisma.workflowTask.update({
          where: { id: approval.taskId },
          data: { status: "BLOCKED", blockerReason: `Approval rejected: ${comment || "Decision declined"}` },
        });
      }
    }

    // Dynamic import to avoid circular dependency
    if (approval.workflowExecutionId) {
      try {
        const { WorkflowEngineService } = await import("./workflow-engine.service");
        await WorkflowEngineService.resumeApproval(approval.id, decision, comment, session);
      } catch (err) {
        console.error("Error resuming workflow execution after approval:", err);
      }
    }

    return updated;
  }
}
