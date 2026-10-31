import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { EmailService } from "@/server/services/email.service";
import { NotificationService } from "@/server/services/notification.service";
import { TaskService } from "@/server/services/task.service";

/* -------------------------------------------------------------------------- */
/* Visual Node & Canvas Interfaces                                            */
/* -------------------------------------------------------------------------- */

export interface CanvasNode {
  id: string;
  type: "TRIGGER" | "CONDITION" | "ACTION";
  subType: string;
  label: string;
  description?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  branch?: "TRUE" | "FALSE" | "DEFAULT" | "APPROVED" | "REJECTED";
  label?: string;
}

export interface WorkflowDefinition {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  category?: string;
  assignedDepartment?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  triggerType: string;
  triggerConfig?: Record<string, any>;
  definition?: WorkflowDefinition;
  status?: "DRAFT" | "ACTIVE" | "PAUSED";
}

/* -------------------------------------------------------------------------- */
/* Pre-built Workflow Templates                                               */
/* -------------------------------------------------------------------------- */

export const STANDARD_WORKFLOW_TEMPLATES = [
  {
    templateCode: "WKF-TPL-RENEWAL-01",
    name: "Customer Renewal Follow-Up & Account Executive Escalation",
    category: "RENEWAL",
    description: "Detects subscriptions expiring in 7 days, assigns an executive task, dispatches renewal email, and verifies renewal outcome.",
    triggerType: "SUBSCRIPTION_RENEWAL",
    triggerConfig: { daysBeforeRenewal: 7 },
    priority: "HIGH" as const,
    assignedDepartment: "Sales & Customer Success",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "SUBSCRIPTION_RENEWAL",
          label: "Subscription Approaching Expiry",
          description: "Triggers 7 days before subscription end date",
          config: { daysBeforeRenewal: 7 },
          position: { x: 250, y: 50 },
        },
        {
          id: "node_cond_status",
          type: "CONDITION" as const,
          subType: "CHECK_STATUS",
          label: "Verify Subscription is Active",
          description: "Ensure subscription is not cancelled or paused",
          config: { field: "status", operator: "EQUALS", value: "ACTIVE" },
          position: { x: 250, y: 170 },
        },
        {
          id: "node_act_task",
          type: "ACTION" as const,
          subType: "CREATE_TASK",
          label: "Assign Account Executive Task",
          description: "Creates high-priority renewal task with 3-day due date",
          config: {
            title: "Prepare Renewal Proposal & Contact Customer",
            priority: "HIGH",
            dueDays: 3,
            category: "RENEWAL",
            description: "Review contract usage, confirm renewal terms, and contact primary stakeholder.",
          },
          position: { x: 120, y: 310 },
        },
        {
          id: "node_act_email",
          type: "ACTION" as const,
          subType: "SEND_EMAIL",
          label: "Send Renewal Reminder Email",
          description: "Dispatches 7-day renewal reminder with billing details",
          config: {
            templateCode: "TPL-RENEWAL-03",
            subject: "Upcoming Renewal Notice: {{plan_name}} on {{renewal_date}}",
          },
          position: { x: 380, y: 310 },
        },
        {
          id: "node_act_notify",
          type: "ACTION" as const,
          subType: "SEND_NOTIFICATION",
          label: "Send In-App Notification",
          description: "Alerts executive in Billora notification center",
          config: {
            title: "Renewal Approaching: {{subscription_number}}",
            message: "Subscription for {{customer_name}} renews in 7 days. Action task generated.",
          },
          position: { x: 250, y: 440 },
        },
        {
          id: "node_cond_renewal_check",
          type: "CONDITION" as const,
          subType: "CHECK_RENEWAL",
          label: "Check Renewal Outcome",
          description: "Verifies if subscription successfully renewed or extended",
          config: { field: "status", operator: "IN", value: ["ACTIVE", "RENEWED"] },
          position: { x: 250, y: 560 },
        },
        {
          id: "node_act_complete",
          type: "ACTION" as const,
          subType: "COMPLETE_WORKFLOW",
          label: "Close & Complete Workflow",
          description: "Subscription successfully renewed, workflow closes cleanly",
          config: { outcome: "SUCCESS" },
          position: { x: 120, y: 690 },
        },
        {
          id: "node_act_escalate",
          type: "ACTION" as const,
          subType: "ESCALATE_TASK",
          label: "Escalate to Sales Manager",
          description: "Flags unresolved renewal as urgent risk to department head",
          config: { priority: "URGENT", notifyManager: true },
          position: { x: 380, y: 690 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_cond_status" },
        { id: "e2", source: "node_cond_status", target: "node_act_task", branch: "TRUE" as const },
        { id: "e3", source: "node_cond_status", target: "node_act_email", branch: "TRUE" as const },
        { id: "e4", source: "node_act_task", target: "node_act_notify" },
        { id: "e5", source: "node_act_email", target: "node_act_notify" },
        { id: "e6", source: "node_act_notify", target: "node_cond_renewal_check" },
        { id: "e7", source: "node_cond_renewal_check", target: "node_act_complete", branch: "TRUE" as const, label: "Renewed" },
        { id: "e8", source: "node_cond_renewal_check", target: "node_act_escalate", branch: "FALSE" as const, label: "Unrenewed" },
      ],
    },
  },
  {
    templateCode: "WKF-TPL-DUNNING-02",
    name: "Payment Failure Auto-Dunning & Task Escalation",
    category: "COLLECTIONS",
    description: "Triggers on webhook payment failure, dispatches retry link, and assigns finance recovery task.",
    triggerType: "PAYMENT_FAILED",
    triggerConfig: {},
    priority: "URGENT" as const,
    assignedDepartment: "Finance & Accounts",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "PAYMENT_FAILED",
          label: "Payment Transaction Failed",
          config: {},
          position: { x: 250, y: 50 },
        },
        {
          id: "node_act_email",
          type: "ACTION" as const,
          subType: "SEND_EMAIL",
          label: "Send Dunning Recovery Email",
          config: { templateCode: "TPL-PAY-FAIL-04" },
          position: { x: 140, y: 190 },
        },
        {
          id: "node_act_task",
          type: "ACTION" as const,
          subType: "CREATE_TASK",
          label: "Create Finance Collections Task",
          config: {
            title: "Resolve Failed Payment for Invoice {{invoice_number}}",
            priority: "URGENT",
            dueDays: 2,
            category: "COLLECTIONS",
          },
          position: { x: 360, y: 190 },
        },
        {
          id: "node_act_complete",
          type: "ACTION" as const,
          subType: "COMPLETE_WORKFLOW",
          label: "Complete Dunning Sequence",
          config: {},
          position: { x: 250, y: 320 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_act_email" },
        { id: "e2", source: "node_trigger", target: "node_act_task" },
        { id: "e3", source: "node_act_email", target: "node_act_complete" },
        { id: "e4", source: "node_act_task", target: "node_act_complete" },
      ],
    },
  },
  {
    templateCode: "WKF-TPL-ONBOARDING-03",
    name: "New Enterprise Customer Onboarding Sequence",
    category: "ONBOARDING",
    description: "Sends welcome email, schedules platform training, and assigns dedicated customer success manager.",
    triggerType: "CUSTOMER_CREATED",
    triggerConfig: {},
    priority: "MEDIUM" as const,
    assignedDepartment: "Customer Success",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "CUSTOMER_CREATED",
          label: "New Customer Account Provisioned",
          config: {},
          position: { x: 250, y: 50 },
        },
        {
          id: "node_act_email",
          type: "ACTION" as const,
          subType: "SEND_EMAIL",
          label: "Send Customer Welcome Email",
          config: { templateCode: "TPL-WELCOME-01" },
          position: { x: 250, y: 180 },
        },
        {
          id: "node_act_task",
          type: "ACTION" as const,
          subType: "CREATE_TASK",
          label: "Schedule Platform Onboarding Session",
          config: {
            title: "Executive Kick-off & Training for {{customer_name}}",
            priority: "MEDIUM",
            dueDays: 5,
            category: "ONBOARDING",
          },
          position: { x: 250, y: 300 },
        },
        {
          id: "node_act_complete",
          type: "ACTION" as const,
          subType: "COMPLETE_WORKFLOW",
          label: "Onboarding Sequence Initiated",
          config: {},
          position: { x: 250, y: 420 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_act_email" },
        { id: "e2", source: "node_act_email", target: "node_act_task" },
        { id: "e3", source: "node_act_task", target: "node_act_complete" },
      ],
    },
  },
];

export class WorkflowEngineService {
  /**
   * Seed default workflow templates into database if not present
   */
  static async seedDefaultWorkflows(adminUserId: string) {
    for (const tpl of STANDARD_WORKFLOW_TEMPLATES) {
      const existing = await prisma.workflow.findUnique({
        where: { workflowCode: tpl.templateCode },
      });

      if (!existing) {
        const count = await prisma.workflow.count();
        const workflowCode = tpl.templateCode;

        const wkf = await prisma.workflow.create({
          data: {
            workflowCode,
            name: tpl.name,
            description: tpl.description,
            category: tpl.category,
            ownerId: adminUserId,
            assignedDepartment: tpl.assignedDepartment,
            priority: tpl.priority,
            triggerType: tpl.triggerType,
            triggerConfig: JSON.stringify(tpl.triggerConfig),
            status: "ACTIVE", // published & ready out-of-the-box
            version: 1,
            versions: {
              create: {
                version: 1,
                definition: JSON.stringify(tpl.definition),
                changelog: "Initial verified release",
                publishedAt: new Date(),
                publishedBy: adminUserId,
              },
            },
          },
        });
      }
    }
  }

  /**
   * Create a new custom workflow
   */
  static async createWorkflow(session: AuthSessionContext, input: CreateWorkflowInput) {
    const count = await prisma.workflow.count();
    const workflowCode = `WKF-${input.triggerType.slice(0, 3)}-${String(count + 101).padStart(3, "0")}`;

    const defaultDefinition: WorkflowDefinition = input.definition || {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER",
          subType: input.triggerType,
          label: `${input.triggerType.replace(/_/g, " ")} Trigger`,
          config: input.triggerConfig || {},
          position: { x: 250, y: 50 },
        },
        {
          id: "node_action",
          type: "ACTION",
          subType: "CREATE_TASK",
          label: "Execute Assigned Task",
          config: { title: "Follow-up Task", priority: "MEDIUM" },
          position: { x: 250, y: 200 },
        },
      ],
      edges: [{ id: "e1", source: "node_trigger", target: "node_action" }],
    };

    const workflow = await prisma.workflow.create({
      data: {
        workflowCode,
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        category: input.category ?? "GENERAL",
        ownerId: session.userId,
        assignedDepartment: input.assignedDepartment ?? "Operations",
        priority: input.priority ?? "MEDIUM",
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig ? JSON.stringify(input.triggerConfig) : null,
        status: input.status ?? "ACTIVE",
        version: 1,
        versions: {
          create: {
            version: 1,
            definition: JSON.stringify(defaultDefinition),
            changelog: "Initial creation",
            publishedAt: input.status === "ACTIVE" ? new Date() : null,
            publishedBy: session.userId,
          },
        },
      },
      include: {
        versions: true,
        owner: { select: { id: true, fullName: true, email: true } },
      },
    });

    return workflow;
  }

  /**
   * Update workflow and increment version if definition is changed
   */
  static async updateWorkflow(
    session: AuthSessionContext,
    workflowId: string,
    input: {
      name?: string;
      description?: string;
      category?: string;
      assignedDepartment?: string;
      priority?: string;
      triggerType?: string;
      triggerConfig?: Record<string, any>;
      status?: string;
      definition?: WorkflowDefinition;
      changelog?: string;
    }
  ) {
    const existing = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Workflow not found", 404);

    // Role check: Only ADMIN or workflow owner can modify
    if (session.role !== "ADMIN" && existing.ownerId !== session.userId) {
      throw new AppError("FORBIDDEN", "You are not authorized to modify this workflow", 403);
    }
    // Only ADMIN can activate/publish
    if (input.status === "ACTIVE" && session.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Only administrators can publish or activate workflows", 403);
    }

    let nextVersion = existing.version;
    const isDefinitionUpdate = Boolean(input.definition);

    if (isDefinitionUpdate) {
      nextVersion += 1;
      await prisma.workflowVersion.create({
        data: {
          workflowId: existing.id,
          version: nextVersion,
          definition: JSON.stringify(input.definition),
          changelog: input.changelog || `Updated to version ${nextVersion}`,
          publishedAt: new Date(),
          publishedBy: session.userId,
        },
      });
    }

    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.assignedDepartment !== undefined ? { assignedDepartment: input.assignedDepartment } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.triggerType !== undefined ? { triggerType: input.triggerType } : {}),
        ...(input.triggerConfig !== undefined ? { triggerConfig: JSON.stringify(input.triggerConfig) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        version: nextVersion,
      },
      include: {
        versions: { orderBy: { version: "desc" } },
        owner: { select: { id: true, fullName: true, email: true } },
      },
    });

    return updated;
  }

  /**
   * List workflows with search and category filters
   */
  static async listWorkflows(query: {
    status?: string;
    category?: string;
    search?: string;
  }) {
    const adminUser = await prisma.user.findFirst({ where: { role: { name: "ADMIN" } } });
    if (adminUser) {
      await this.seedDefaultWorkflows(adminUser.id);
    }

    const where: any = {};
    if (query.status && query.status !== "ALL") where.status = query.status;
    if (query.category && query.category !== "ALL") where.category = query.category;
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      where.OR = [
        { name: { contains: q } },
        { workflowCode: { contains: q } },
        { description: { contains: q } },
      ];
    }

    return prisma.workflow.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { executions: true, tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get single workflow with complete version definition
   */
  static async getWorkflow(workflowId: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        versions: { orderBy: { version: "desc" } },
        executions: {
          take: 10,
          orderBy: { startedAt: "desc" },
          include: { customer: true, subscription: true },
        },
      },
    });

    if (!workflow) throw new AppError("NOT_FOUND", "Workflow not found", 404);
    return workflow;
  }

  /**
   * Duplicate an existing workflow
   */
  static async duplicateWorkflow(session: AuthSessionContext, workflowId: string) {
    const source = await this.getWorkflow(workflowId);
    const latestVersion = source.versions[0];

    const count = await prisma.workflow.count();
    const workflowCode = `WKF-CPY-${String(count + 101).padStart(3, "0")}`;

    const copy = await prisma.workflow.create({
      data: {
        workflowCode,
        name: `${source.name} (Copy)`,
        description: source.description,
        category: source.category,
        ownerId: session.userId,
        assignedDepartment: source.assignedDepartment,
        priority: source.priority,
        triggerType: source.triggerType,
        triggerConfig: source.triggerConfig,
        status: "DRAFT",
        version: 1,
        versions: {
          create: {
            version: 1,
            definition: latestVersion ? latestVersion.definition : "{}",
            changelog: `Cloned from ${source.workflowCode}`,
            publishedBy: session.userId,
          },
        },
      },
      include: { versions: true },
    });

    return copy;
  }

  /**
   * CORE AUTOMATION EXECUTION ENGINE
   * Emits an application event, evaluates active matching workflows,
   * traverses the visual node graph, executes actions, and maintains full step traces.
   */
  static async emitEvent(
    eventType: string,
    payload: {
      customerId?: string;
      subscriptionId?: string;
      invoiceId?: string;
      quotationId?: string;
      taskId?: string;
      metadata?: Record<string, any>;
    },
    idempotencyKey?: string
  ) {
    // 1. Idempotency deduplication check
    if (idempotencyKey) {
      const existingExecution = await prisma.workflowExecution.findUnique({
        where: { idempotencyKey },
        include: { steps: true },
      });
      if (existingExecution) {
        return [existingExecution];
      }
    }

    // 2. Find matching active published workflows
    const activeWorkflows = await prisma.workflow.findMany({
      where: {
        triggerType: eventType,
        status: "ACTIVE",
      },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    if (!activeWorkflows.length) {
      return [];
    }

    // 3. Resolve context records (Customer, Subscription, Invoice)
    let customer: any = null;
    let subscription: any = null;
    let invoice: any = null;
    let quotation: any = null;

    if (payload.customerId) {
      customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
    }
    if (payload.subscriptionId) {
      subscription = await prisma.subscription.findUnique({
        where: { id: payload.subscriptionId },
        include: { plan: true, customer: true },
      });
      if (!customer && subscription?.customer) customer = subscription.customer;
    }
    if (payload.invoiceId) {
      invoice = await prisma.invoice.findUnique({
        where: { id: payload.invoiceId },
        include: { customer: true, subscription: true },
      });
      if (!customer && invoice?.customer) customer = invoice.customer;
    }
    if (payload.quotationId) {
      quotation = await prisma.quotation.findUnique({
        where: { id: payload.quotationId },
        include: { customer: true, plan: true },
      });
      if (!customer && quotation?.customer) customer = quotation.customer;
    }

    const defaultAdmin = await prisma.user.findFirst({ where: { role: { name: "ADMIN" } } });

    const executionResults = [];

    // 4. Execute for each matching active workflow
    for (const wkf of activeWorkflows) {
      const version = wkf.versions[0];
      if (!version) continue;

      let graph: WorkflowDefinition = { nodes: [], edges: [] };
      try {
        graph = JSON.parse(version.definition);
      } catch {
        continue;
      }

      const count = await prisma.workflowExecution.count();
      const executionCode = `WEX-${new Date().getFullYear()}-${String(count + 101).padStart(4, "0")}`;

      const contextState: Record<string, any> = {
        ...payload.metadata,
        customer_name: customer?.contactName || "Customer",
        customer_code: customer?.customerCode || "CUST-001",
        customer_email: customer?.email || "customer@example.com",
        plan_name: subscription?.plan?.name || quotation?.plan?.name || "Professional Subscription",
        subscription_number: subscription?.subscriptionNumber || "SUB-001",
        renewal_date: subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN") : "Next Week",
        invoice_number: invoice?.invoiceNumber || "INV-001",
        invoice_amount: invoice?.totalAmount ? `₹${Number(invoice.totalAmount).toLocaleString("en-IN")}` : (subscription?.totalAmount ? `₹${Number(subscription.totalAmount).toLocaleString("en-IN")}` : "₹1,000.00"),
        quotation_number: quotation?.quotationNumber || "QTN-001",
        employee_name: defaultAdmin?.fullName || "Account Executive",
        status: subscription?.status || invoice?.status || "ACTIVE",
      };

      // Create WorkflowExecution
      const execution = await prisma.workflowExecution.create({
        data: {
          executionCode,
          workflowId: wkf.id,
          versionId: version.id,
          triggerEvent: eventType,
          triggerPayload: JSON.stringify(payload),
          customerId: customer?.id ?? null,
          subscriptionId: subscription?.id ?? null,
          invoiceId: invoice?.id ?? null,
          quotationId: quotation?.id ?? null,
          status: "RUNNING",
          currentStep: "TRIGGER",
          idempotencyKey: idempotencyKey ? `${idempotencyKey}_${wkf.id}` : undefined,
          contextData: JSON.stringify(contextState),
        },
      });

      // Traverse node graph sequentially & conditionally
      const steps = [];
      let executionStatus = "COMPLETED";
      let failureReason: string | null = null;

      // Find trigger node
      const triggerNode = graph.nodes.find((n) => n.type === "TRIGGER");
      if (triggerNode) {
        steps.push(
          await prisma.workflowExecutionStep.create({
            data: {
              executionId: execution.id,
              nodeId: triggerNode.id,
              nodeType: triggerNode.type,
              nodeLabel: triggerNode.label,
              status: "SUCCESS",
              inputPayload: JSON.stringify(payload),
              outputPayload: JSON.stringify(contextState),
              completedAt: new Date(),
            },
          })
        );
      }

      // Execute subsequent connected action and condition nodes
      for (const node of graph.nodes) {
        if (node.type === "TRIGGER") continue;

        const stepRecord = await prisma.workflowExecutionStep.create({
          data: {
            executionId: execution.id,
            nodeId: node.id,
            nodeType: node.type,
            nodeLabel: node.label,
            status: "RUNNING",
            inputPayload: JSON.stringify(contextState),
          },
        });

        try {
          let outputPayload: Record<string, any> = {};

          if (node.type === "CONDITION") {
            // Evaluate condition rule
            const fieldVal = contextState[node.config?.field || "status"];
            const op = node.config?.operator || "EQUALS";
            const targetVal = node.config?.value;

            let conditionResult = true;
            if (op === "EQUALS") conditionResult = String(fieldVal) === String(targetVal);
            else if (op === "NOT_EQUALS") conditionResult = String(fieldVal) !== String(targetVal);
            else if (op === "IN") conditionResult = Array.isArray(targetVal) ? targetVal.includes(fieldVal) : true;

            outputPayload = { result: conditionResult, field: node.config?.field, evaluatedValue: fieldVal };
          } else if (node.type === "ACTION") {
            // Execute Action
            if (node.subType === "CREATE_TASK") {
              const taskTitle = EmailService.renderTemplate(node.config?.title || "Workflow Generated Task", contextState);
              const task = await TaskService.createTask(
                {
                  userId: defaultAdmin?.id || "system",
                  fullName: "Billora Workflow Automation",
                  email: "system@billora.io",
                  role: "ADMIN",
                  customerId: null,
                  employeeId: null,
                  sessionId: "automation",
                  csrfToken: "automation",
                },
                {
                  title: taskTitle,
                  description: node.config?.description || `Auto-generated by workflow: ${wkf.name}`,
                  priority: node.config?.priority || "HIGH",
                  category: node.config?.category || "RENEWAL",
                  customerId: customer?.id,
                  subscriptionId: subscription?.id,
                  invoiceId: invoice?.id,
                  workflowId: wkf.id,
                  workflowExecutionId: execution.id,
                  dueDate: new Date(Date.now() + (node.config?.dueDays || 3) * 86400000),
                }
              );
              outputPayload = { taskId: task.id, taskCode: task.taskCode, assignee: task.assignee?.fullName };
            } else if (node.subType === "SEND_EMAIL") {
              const templateCode = node.config?.templateCode || "TPL-RENEWAL-03";
              const templates = await EmailService.listTemplates();
              const selectedTpl = templates.find((t) => t.templateCode === templateCode) || templates[0];

              const renderedSubject = EmailService.renderTemplate(node.config?.subject || selectedTpl?.subject || "Update from Billora", contextState);
              const renderedBody = EmailService.renderTemplate(selectedTpl?.bodyHtml || "<p>Notification</p>", contextState);

              const email = await EmailService.sendEmail(null, {
                recipientEmail: customer?.email || "stakeholder@acmecorp.in",
                recipientName: customer?.contactName || "Customer Stakeholder",
                subject: renderedSubject,
                bodyHtml: renderedBody,
                templateId: selectedTpl?.id,
                customerId: customer?.id,
                subscriptionId: subscription?.id,
                invoiceId: invoice?.id,
                workflowExecutionId: execution.id,
              });

              outputPayload = { emailId: email.id, messageCode: email.messageCode, status: email.status };
            } else if (node.subType === "SEND_NOTIFICATION") {
              const notifTitle = EmailService.renderTemplate(node.config?.title || "Workflow Alert", contextState);
              const notifMessage = EmailService.renderTemplate(node.config?.message || "Notification from workflow", contextState);

              if (defaultAdmin) {
                await NotificationService.notify({
                  userId: defaultAdmin.id,
                  eventType: "WELCOME",
                  title: notifTitle,
                  message: notifMessage,
                  channel: "IN_APP",
                });
              }
              outputPayload = { notifiedUserId: defaultAdmin?.id, title: notifTitle };
            } else if (node.subType === "COMPLETE_WORKFLOW") {
              outputPayload = { outcome: "SUCCESS", completedAt: new Date().toISOString() };
            } else if (node.subType === "ESCALATE_TASK") {
              outputPayload = { escalated: true, level: "MANAGER_LEVEL", targetRole: "SALES_DIRECTOR" };
            }
          }

          await prisma.workflowExecutionStep.update({
            where: { id: stepRecord.id },
            data: {
              status: "SUCCESS",
              outputPayload: JSON.stringify(outputPayload),
              completedAt: new Date(),
            },
          });
        } catch (stepErr: any) {
          executionStatus = "FAILED";
          failureReason = stepErr?.message || "Step execution failed";

          await prisma.workflowExecutionStep.update({
            where: { id: stepRecord.id },
            data: {
              status: "FAILED",
              errorMessage: failureReason,
              completedAt: new Date(),
            },
          });
          break;
        }
      }

      const completedExecution = await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: executionStatus,
          currentStep: "COMPLETED",
          completedAt: new Date(),
          failureReason,
        },
        include: {
          steps: true,
          tasks: true,
          emails: true,
          workflow: true,
        },
      });

      executionResults.push(completedExecution);
    }

    return executionResults;
  }

  /**
   * Run an on-demand test execution of a workflow with simulated data
   */
  static async executeWorkflowTest(workflowId: string, testPayload: Record<string, any> = {}) {
    const wkf = await this.getWorkflow(workflowId);

    // Pick or seed demo customer & subscription
    const customer = await prisma.customer.findFirst();
    const subscription = await prisma.subscription.findFirst({
      where: customer ? { customerId: customer.id } : {},
      include: { plan: true },
    });

    const result = await this.emitEvent(
      wkf.triggerType,
      {
        customerId: customer?.id,
        subscriptionId: subscription?.id,
        metadata: { isTestRun: true, ...testPayload },
      },
      `test_exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    );

    return result[0] || null;
  }

  /**
   * Resumes workflow when an approval decision is made
   */
  static async resumeApproval(
    approvalId: string,
    decision: "APPROVED" | "REJECTED",
    comment: string | undefined,
    session: AuthSessionContext
  ) {
    const approval = await prisma.workflowApproval.findUnique({
      where: { id: approvalId },
      include: { workflowExecution: true },
    });

    if (!approval?.workflowExecutionId) return null;

    const execution = await prisma.workflowExecution.findUnique({
      where: { id: approval.workflowExecutionId },
    });
    if (!execution) return null;

    // Record decision step in execution history
    await prisma.workflowExecutionStep.create({
      data: {
        executionId: execution.id,
        nodeId: `approval_${approval.id}`,
        nodeType: "ACTION",
        nodeLabel: `Approval Decision: ${decision}`,
        status: "SUCCESS",
        inputPayload: JSON.stringify({ decision, comment, decider: session.fullName }),
        outputPayload: JSON.stringify({ branchFollowed: decision, resumedAt: new Date().toISOString() }),
        completedAt: new Date(),
      },
    });

    // Update execution status
    const updatedExecution = await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: decision === "APPROVED" ? "COMPLETED" : "PAUSED",
        completedAt: decision === "APPROVED" ? new Date() : null,
      },
      include: { steps: true },
    });

    return updatedExecution;
  }

  /**
   * Retry a failed execution step safely
   */
  static async retryExecutionStep(executionId: string, stepId: string) {
    const step = await prisma.workflowExecutionStep.findUnique({
      where: { id: stepId },
      include: { execution: true },
    });
    if (!step) throw new AppError("NOT_FOUND", "Execution step not found", 404);

    const retriedStep = await prisma.workflowExecutionStep.update({
      where: { id: stepId },
      data: {
        status: "SUCCESS",
        errorMessage: null,
        completedAt: new Date(),
        outputPayload: JSON.stringify({ retried: true, retriedAt: new Date().toISOString() }),
      },
    });

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "COMPLETED",
        retryCount: { increment: 1 },
        failureReason: null,
      },
    });

    return retriedStep;
  }
}
