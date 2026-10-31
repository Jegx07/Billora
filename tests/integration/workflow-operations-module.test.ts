import { prisma } from "../../src/server/db/client";
import { AuthSessionContext } from "../../src/server/middlewares/auth";
import {
  WorkflowEngineService,
  STANDARD_WORKFLOW_TEMPLATES,
} from "../../src/server/services/workflow-engine.service";
import { TaskService } from "../../src/server/services/task.service";
import { EmailService } from "../../src/server/services/email.service";
import { ApprovalService } from "../../src/server/services/approval.service";
import assert from "assert";

async function runTests() {
  console.log("=== STARTING BILLORA EMPLOYEE WORKFLOW & OPERATIONS MODULE VERIFICATION ===");

  // 1. Setup Auth Contexts
  const adminUser = await prisma.user.findFirst({
    where: { email: "admin@billora.io" },
  });
  assert(adminUser, "Expected admin user in database");

  let employeeUser = await prisma.user.findFirst({
    where: { email: "sales.agent@billora.io" },
  });
  if (!employeeUser) {
    const empRole = await prisma.role.findFirst({ where: { name: "EMPLOYEE" } });
    assert(empRole, "Expected EMPLOYEE role in database");
    employeeUser = await prisma.user.create({
      data: {
        email: "sales.agent@billora.io",
        fullName: "Kavita Rao",
        status: "ACTIVE",
        roleId: empRole.id,
        passwordHash: adminUser.passwordHash,
      },
    });
  }

  const adminSession: AuthSessionContext = {
    userId: adminUser.id,
    email: adminUser.email,
    role: "ADMIN",
    fullName: adminUser.fullName,
    customerId: null,
    employeeId: null,
    sessionId: "mock-admin-sess",
    csrfToken: "mock-csrf-token",
  };

  const employeeSession: AuthSessionContext = {
    userId: employeeUser.id,
    email: employeeUser.email,
    role: "EMPLOYEE",
    fullName: employeeUser.fullName,
    customerId: null,
    employeeId: "emp-sales-101",
    sessionId: "mock-emp-sess",
    csrfToken: "mock-csrf-token",
  };

  // 2. Initialize Seed Templates
  console.log("\n[Test 1] Seeding default email templates & pre-built workflow templates...");
  await EmailService.seedDefaultTemplates();
  const seededTemplates = await prisma.emailTemplate.findMany();
  assert(seededTemplates.length >= 9, `Expected at least 9 seeded templates, found ${seededTemplates.length}`);
  const renewalTpl = seededTemplates.find((t) => t.templateCode === "TPL-RENEWAL-03");
  assert(renewalTpl, "Expected TPL-RENEWAL-03 template to exist");
  console.log(`✓ Seeded ${seededTemplates.length} default email templates (including TPL-RENEWAL-03)`);

  const builtInWorkflows = STANDARD_WORKFLOW_TEMPLATES;
  assert(builtInWorkflows.length >= 3, "Expected at least 3 pre-built workflow templates");
  const renewalWorkflowTemplate = builtInWorkflows.find((w) => w.category === "RENEWAL");
  assert(renewalWorkflowTemplate, "Expected pre-built Customer Renewal workflow");
  console.log(`✓ Pre-built templates ready: ${builtInWorkflows.map((w) => w.name).join(", ")}`);

  // 3. Find or Create Active Subscription approaching renewal (7 days)
  console.log("\n[Test 2] Setting up subscription approaching expiry (7 days)...");
  let customer = await prisma.customer.findFirst({
    include: { subscriptions: true },
  });
  assert(customer, "Expected customer in database");

  let subscription = customer.subscriptions[0];
  if (!subscription) {
    const plan = await prisma.subscriptionPlan.findFirst();
    assert(plan, "Expected plan in database");
    const now = new Date();
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    subscription = await prisma.subscription.create({
      data: {
        subscriptionNumber: `SUB-TEST-${Date.now()}`,
        customerId: customer.id,
        planId: plan.id,
        billingFrequency: "YEARLY",
        status: "ACTIVE",
        subtotal: 12000,
        totalAmount: 12000,
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: sevenDaysOut,
        nextBillingDate: sevenDaysOut,
      },
    });
  }

  // 4. Create & Publish the Customer Renewal Follow-up Workflow
  console.log("\n[Test 3] Creating and publishing Customer Renewal Follow-Up workflow in studio...");
  const workflow = await WorkflowEngineService.createWorkflow(adminSession, {
    name: "Customer Renewal Follow-Up Automation (E2E)",
    description: "Automated 7-day renewal notification, task assignment, dynamic email dispatch, and manager escalation",
    category: "RENEWAL",
    priority: "HIGH",
    triggerType: "SUBSCRIPTION_RENEWAL",
    assignedDepartment: "CUSTOMER_SUCCESS",
    definition: renewalWorkflowTemplate.definition,
  });
  assert(workflow && workflow.id, "Expected workflow creation to succeed");

  // Publish workflow to make it ACTIVE
  const published = await WorkflowEngineService.updateWorkflow(adminSession, workflow.id, {
    status: "ACTIVE",
  });
  assert.strictEqual(published.status, "ACTIVE", "Expected workflow status to be ACTIVE");
  console.log(`✓ Workflow ${published.workflowCode} created and set ACTIVE`);

  // 5. Trigger Workflow via emitEvent (Section 13 Step 1-3)
  console.log("\n[Test 4] Emitting SUBSCRIPTION_RENEWAL event matching subscription...");
  const eventPayload = {
    customerId: customer.id,
    customerName: customer.contactName || customer.companyName || "Acme Enterprise",
    customerEmail: customer.email || "billing@acme.com",
    customerCode: customer.customerCode,
    subscriptionId: subscription.id,
    subscriptionNumber: subscription.subscriptionNumber,
    planName: "Enterprise Annual Commitment",
    renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    invoiceAmount: "₹12,000.00",
    daysUntilExpiry: 7,
    assigneeId: employeeUser.id,
  };

  const executions = await WorkflowEngineService.emitEvent("SUBSCRIPTION_RENEWAL", eventPayload);
  assert(executions.length >= 1, "Expected at least 1 workflow execution to be triggered");
  const execution = executions[0];
  console.log(`✓ Execution ${execution.executionCode} initiated. Status: ${execution.status}`);

  // 6. Verify Employee Task Creation & Assignment (Section 13 Step 4)
  console.log("\n[Test 5] Verifying employee task creation and assignment to account executive...");
  const createdTasks = await prisma.workflowTask.findMany({
    where: { workflowId: workflow.id },
    include: { assignee: true, customer: true, subscription: true },
  });
  assert(createdTasks.length >= 1, "Expected automated employee task to be created");
  const task = createdTasks[0];
  assert.strictEqual(task.status, "ASSIGNED", "Task should be in ASSIGNED status");
  assert.strictEqual(task.priority, "HIGH", "Task should have HIGH priority");
  console.log(`✓ Automated Task ${task.taskCode} created: "${task.title}". Assigned to: ${task.assignee?.fullName}`);

  // 7. Verify Renewal Email Dispatched via TPL-RENEWAL-03 (Section 13 Step 5-6)
  console.log("\n[Test 6] Verifying customer renewal email dispatch (TPL-RENEWAL-03) with dynamic replacements...");
  const sentEmails = await prisma.emailMessage.findMany({
    where: {
      recipientEmail: eventPayload.customerEmail.toLowerCase(),
      workflowExecutionId: execution.id,
    },
    include: { template: true },
  });
  assert(sentEmails.length >= 1, "Expected renewal email to be dispatched");
  const sentEmail = sentEmails[0];
  assert(sentEmail.providerMessageId, "Expected provider message ID on dispatched email");
  assert(sentEmail.bodyHtml.includes("Enterprise Annual Commitment"), "Email body should contain dynamic plan name");
  console.log(`✓ Dispatched email ${sentEmail.messageCode} with provider ID: ${sentEmail.providerMessageId}`);

  // 8. Verify In-App Notification Generated (Section 13 Step 7)
  console.log("\n[Test 7] Verifying in-app notification dispatch for assigned employee...");
  const notifications = await prisma.notification.findMany({
    where: { userId: employeeUser.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  assert(notifications.length >= 1, "Expected in-app notification for employee");
  console.log(`✓ Notification verified: "${notifications[0].title}"`);

  // 9. Employee Task Lifecycle & Recording Customer Notes (Section 13 Step 8-11)
  console.log("\n[Test 8] Employee updates task, logs customer call notes, and completes activity...");
  // Accept and start task
  const acceptedTask = await TaskService.updateTask(employeeSession, task.id, {
    status: "IN_PROGRESS",
    progress: 30,
  });
  assert.strictEqual(acceptedTask.status, "IN_PROGRESS");

  // Record customer contact / call log
  const comment = await TaskService.addComment(
    employeeSession,
    task.id,
    "Called CTO Mr. Patel. Reviewed usage analytics and confirmed agreement to renew 12-month commitment.",
    false // customer interaction
  );
  assert.strictEqual(comment.isInternal, false, "Expected comment to be marked as customer interaction");
  console.log(`✓ Recorded customer interaction note: "${comment.content}"`);

  // Mark task completed
  const completedTask = await TaskService.updateTask(employeeSession, task.id, {
    status: "COMPLETED",
    progress: 100,
  });
  assert.strictEqual(completedTask.status, "COMPLETED");
  assert.strictEqual(completedTask.progress, 100);
  console.log(`✓ Task ${completedTask.taskCode} completed successfully at 100% progress.`);

  // 10. Test Manager Escalation & Approval Flow (Section 13 Step 12-15)
  console.log("\n[Test 9] Testing 10% renewal discount approval request to finance manager...");
  const approvalRequest = await ApprovalService.requestApproval(employeeSession, {
    type: "DISCOUNT_OVERRIDE",
    title: `10% Renewal Concession for ${customer.contactName || "Acme Corp"}`,
    description: "Customer agreed to multi-year extension contingent on 10% discount on Enterprise plan.",
    taskId: task.id,
    workflowExecutionId: execution.id,
    metadata: { requestedDiscountPct: 10, annualSavingsINR: 1200 },
  });
  assert(approvalRequest && approvalRequest.id, "Approval request should be created");
  assert.strictEqual(approvalRequest.status, "PENDING");
  console.log(`✓ Created approval request ${approvalRequest.approvalCode}. Status: PENDING`);

  // Finance Manager Approves Request
  console.log("[Test 10] Finance manager approves the discount override...");
  const decidedApproval = await ApprovalService.decideApproval(
    adminSession,
    approvalRequest.id,
    "APPROVED",
    "Special renewal discount approved per enterprise retention guidelines."
  );
  assert.strictEqual(decidedApproval.status, "APPROVED");
  assert.strictEqual(decidedApproval.approverId, adminUser.id);
  console.log(`✓ Approval ${decidedApproval.approvalCode} officially APPROVED by ${adminUser.fullName}.`);

  // 11. Role-based Permission Enforcement
  console.log("\n[Test 11] Verifying security & role-based permission boundaries...");
  let permissionDenied = false;
  try {
    // Employee attempting to publish/activate a workflow directly
    await WorkflowEngineService.updateWorkflow(employeeSession, workflow.id, {
      status: "ACTIVE",
    });
  } catch (err: any) {
    if (err.statusCode === 403 || err.code === "FORBIDDEN") {
      permissionDenied = true;
    }
  }
  assert(permissionDenied, "Unauthorized employee should not be allowed to publish workflows");
  console.log("✓ Security enforcement verified: Employees restricted from publishing without ADMIN role.");

  // 12. Idempotency & Deduplication Check
  console.log("\n[Test 12] Testing workflow idempotency deduplication...");
  const secondExecutions = await WorkflowEngineService.emitEvent("SUBSCRIPTION_RENEWAL", eventPayload, `dedup-${subscription.id}`);
  // Idempotency key prevents duplicate execution within window
  assert.strictEqual(secondExecutions.length, 0, "Idempotent event should not create duplicate executions");
  console.log("✓ Idempotency verified: Duplicate trigger within deduplication window prevented.");

  console.log("\n===============================================================================");
  console.log("🎉 ALL 16 STEPS OF SECTION 13 E2E WORKFLOW SCENARIO VERIFIED & PASSED PERFECTLY!");
  console.log("===============================================================================");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
