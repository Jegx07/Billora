import { getOrSetServerCache } from "@/server/cache/query-cache";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);

    const data = await getOrSetServerCache(
      `ops:${session.userId}:${session.role}`,
      20_000,
      async () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
          activeWorkflowsCount,
          totalWorkflowsCount,
          executions24hCount,
          myPendingTasksCount,
          myOverdueTasksCount,
          allOpenTasksCount,
          pendingApprovalsCount,
          emailsSent30dCount,
          recentTasks,
          recentExecutions,
          teamMembers,
        ] = await Promise.all([
          prisma.workflow.count({ where: { status: "ACTIVE" } }),
          prisma.workflow.count(),
          prisma.workflowExecution.count({ where: { startedAt: { gte: oneDayAgo } } }),
          prisma.workflowTask.count({
            where: {
              assigneeId: session.userId,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          }),
          prisma.workflowTask.count({
            where: {
              assigneeId: session.userId,
              dueDate: { lt: now },
              status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          }),
          prisma.workflowTask.count({
            where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
          }),
          prisma.workflowApproval.count({ where: { status: "PENDING" } }),
          prisma.emailMessage.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
          prisma.workflowTask.findMany({
            where: session.role === "EMPLOYEE" ? { assigneeId: session.userId } : {},
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { customer: { select: { contactName: true } } },
          }),
          prisma.workflowExecution.findMany({
            take: 5,
            orderBy: { startedAt: "desc" },
            include: {
              workflow: { select: { name: true, workflowCode: true } },
              customer: { select: { contactName: true } },
            },
          }),
          prisma.user.findMany({
            where: { status: "ACTIVE" },
            select: { id: true, fullName: true, email: true, role: { select: { name: true } } },
            orderBy: { fullName: "asc" },
          }),
        ]);

        return {
          metrics: {
            activeWorkflows: activeWorkflowsCount,
            totalWorkflows: totalWorkflowsCount,
            executions24h: executions24hCount,
            myPendingTasks: myPendingTasksCount,
            myOverdueTasks: myOverdueTasksCount,
            allOpenTasks: allOpenTasksCount,
            pendingApprovals: pendingApprovalsCount,
            emailsSent30d: emailsSent30dCount,
          },
          recentTasks,
          recentExecutions,
          teamMembers,
        };
      }
    );

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
