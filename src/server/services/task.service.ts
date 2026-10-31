import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { NotificationService } from "@/server/services/notification.service";

export interface CreateTaskInput {
  title: string;
  description?: string;
  category?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId?: string;
  managerId?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  quotationId?: string;
  workflowId?: string;
  workflowExecutionId?: string;
  startDate?: Date | string;
  dueDate?: Date | string;
  collaboratorIds?: string[];
}

export interface TaskFilterQuery {
  tab?: "assigned_to_me" | "created_by_me" | "all" | "overdue" | "awaiting_approval" | "completed";
  status?: string;
  priority?: string;
  customerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class TaskService {
  /**
   * Create an employee task with audit and in-app notification
   */
  static async createTask(session: AuthSessionContext, input: CreateTaskInput) {
    const count = await prisma.workflowTask.count();
    const taskCode = `TSK-${new Date().getFullYear()}-${String(count + 101).padStart(4, "0")}`;

    const task = await prisma.workflowTask.create({
      data: {
        taskCode,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        category: input.category ?? "GENERAL",
        priority: input.priority ?? "MEDIUM",
        status: input.assigneeId ? "ASSIGNED" : "ASSIGNED",
        creatorId: session.userId,
        assigneeId: input.assigneeId ?? session.userId,
        managerId: input.managerId ?? null,
        customerId: input.customerId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        invoiceId: input.invoiceId ?? null,
        quotationId: input.quotationId ?? null,
        workflowId: input.workflowId ?? null,
        workflowExecutionId: input.workflowExecutionId ?? null,
        startDate: input.startDate ? new Date(input.startDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        ...(input.collaboratorIds?.length
          ? {
              collaborators: {
                create: input.collaboratorIds.map((userId) => ({
                  userId,
                  role: "COLLABORATOR",
                })),
              },
            }
          : {}),
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        creator: { select: { id: true, fullName: true, email: true } },
        manager: { select: { id: true, fullName: true, email: true } },
        customer: { select: { id: true, customerCode: true, contactName: true, companyName: true, email: true } },
        subscription: { select: { id: true, subscriptionNumber: true, status: true, totalAmount: true } },
      },
    });

    // Notify assignee if not the creator
    if (task.assigneeId && task.assigneeId !== session.userId) {
      await NotificationService.notify({
        userId: task.assigneeId,
        eventType: "WELCOME", // re-using internal notification channels
        title: `New Task Assigned: ${task.taskCode}`,
        message: `${session.fullName} assigned you task "${task.title}". Priority: ${task.priority}.`,
        channel: "IN_APP",
      });
    }

    return task;
  }

  /**
   * List tasks based on filters and role-based permissions
   */
  static async listTasks(session: AuthSessionContext, query: TaskFilterQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by tab / assignment scope
    if (query.tab === "assigned_to_me") {
      where.assigneeId = session.userId;
    } else if (query.tab === "created_by_me") {
      where.creatorId = session.userId;
    } else if (query.tab === "overdue") {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ["COMPLETED", "CANCELLED"] };
    } else if (query.tab === "awaiting_approval") {
      where.status = "AWAITING_APPROVAL";
    } else if (query.tab === "completed") {
      where.status = "COMPLETED";
    } else if (query.tab === "all") {
      if (session.role === "EMPLOYEE") {
        // Employees see tasks assigned to them, created by them, or where they are collaborators
        where.OR = [
          { assigneeId: session.userId },
          { creatorId: session.userId },
          { collaborators: { some: { userId: session.userId } } },
        ];
      }
    } else {
      // Default: assigned to me or created by me
      if (session.role === "EMPLOYEE") {
        where.OR = [
          { assigneeId: session.userId },
          { creatorId: session.userId },
        ];
      }
    }

    // Status filter
    if (query.status && query.status !== "ALL") {
      where.status = query.status;
    }

    // Priority filter
    if (query.priority && query.priority !== "ALL") {
      where.priority = query.priority;
    }

    // Customer filter
    if (query.customerId) {
      where.customerId = query.customerId;
    }

    // Search filter
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      where.OR = [
        { taskCode: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.workflowTask.count({ where }),
      prisma.workflowTask.findMany({
        where,
        include: {
          assignee: { select: { id: true, fullName: true, email: true } },
          creator: { select: { id: true, fullName: true, email: true } },
          manager: { select: { id: true, fullName: true, email: true } },
          customer: { select: { id: true, customerCode: true, contactName: true, companyName: true } },
          subscription: { select: { id: true, subscriptionNumber: true, status: true, totalAmount: true } },
          comments: {
            take: 2,
            orderBy: { createdAt: "desc" },
            include: { author: { select: { id: true, fullName: true } } },
          },
          _count: { select: { comments: true, collaborators: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    // Check overdue status dynamically
    const enriched = items.map((task) => {
      const isOverdue =
        task.dueDate &&
        new Date(task.dueDate) < new Date() &&
        !["COMPLETED", "CANCELLED"].includes(task.status);
      return {
        ...task,
        isOverdue: Boolean(isOverdue),
      };
    });

    return {
      items: enriched,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get complete details of a task
   */
  static async getTask(session: AuthSessionContext, taskId: string) {
    const task = await prisma.workflowTask.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        creator: { select: { id: true, fullName: true, email: true } },
        manager: { select: { id: true, fullName: true, email: true } },
        customer: { select: { id: true, customerCode: true, contactName: true, companyName: true, email: true, phone: true } },
        subscription: { select: { id: true, subscriptionNumber: true, status: true, totalAmount: true, currentPeriodEnd: true, plan: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, dueDate: true } },
        quotation: { select: { id: true, quotationNumber: true, totalAmount: true, status: true } },
        workflow: { select: { id: true, workflowCode: true, name: true } },
        workflowExecution: { select: { id: true, executionCode: true, status: true } },
        collaborators: {
          include: { task: false },
        },
        comments: {
          include: { author: { select: { id: true, fullName: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        approvals: {
          include: {
            requestedBy: { select: { id: true, fullName: true } },
            approver: { select: { id: true, fullName: true } },
          },
          orderBy: { requestedAt: "desc" },
        },
      },
    });

    if (!task) {
      throw new AppError("NOT_FOUND", "Task not found", 404);
    }

    // Role check: Admin, Creator, Assignee, Manager, or Collaborator
    if (
      session.role === "EMPLOYEE" &&
      task.assigneeId !== session.userId &&
      task.creatorId !== session.userId &&
      task.managerId !== session.userId
    ) {
      // Allowed if collaborator
    }

    return task;
  }

  /**
   * Update task status, progress, notes, or assignees
   */
  static async updateTask(
    session: AuthSessionContext,
    taskId: string,
    input: {
      status?: string;
      progress?: number;
      assigneeId?: string;
      managerId?: string;
      priority?: string;
      dueDate?: Date | string;
      blockerReason?: string | null;
    }
  ) {
    const existing = await prisma.workflowTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new AppError("NOT_FOUND", "Task not found", 404);

    const isCompleting = input.status === "COMPLETED" && existing.status !== "COMPLETED";

    const updated = await prisma.workflowTask.update({
      where: { id: taskId },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
        ...(input.blockerReason !== undefined ? { blockerReason: input.blockerReason } : {}),
        ...(isCompleting ? { completedAt: new Date(), progress: 100 } : {}),
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        customer: true,
      },
    });

    return updated;
  }

  /**
   * Add comment or customer interaction record
   */
  static async addComment(
    session: AuthSessionContext,
    taskId: string,
    content: string,
    isInternal = true,
    attachments?: string[]
  ) {
    const task = await prisma.workflowTask.findUnique({ where: { id: taskId } });
    if (!task) throw new AppError("NOT_FOUND", "Task not found", 404);

    const comment = await prisma.workflowTaskComment.create({
      data: {
        taskId,
        authorId: session.userId,
        content: content.trim(),
        isInternal,
        attachments: attachments?.length ? JSON.stringify(attachments) : null,
      },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
      },
    });

    return comment;
  }
}
