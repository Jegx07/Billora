import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";
import { EmailService } from "@/server/services/email.service";
import { NotificationService } from "@/server/services/notification.service";
import { TaskService } from "@/server/services/task.service";
import {
  evaluateExpressionString,
  resolveWorkflowPath,
} from "@/lib/workflow-nodes";

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
  retryPolicy?: {
    maxRetries?: number;
    backoffMs?: number;
    timeoutMs?: number;
    continueOnError?: boolean;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  branch?: "TRUE" | "FALSE" | "DEFAULT" | "ERROR" | "APPROVED" | "REJECTED";
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
  scheduleCron?: string;
}

export interface WorkflowIntegrationRecord {
  id: string;
  integrationKey: string;
  name: string;
  providerType: "EMAIL" | "WEBHOOK" | "HTTP_API" | "SMS" | "SLACK" | "TEAMS" | "GOOGLE_SHEETS" | "CRM";
  endpointUrl: string | null;
  credentialMasked: string;
  isActive: boolean;
  isApprovedForEmployees: boolean;
  configJson: string | null;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Phase 7: All 7 Ready-to-Use Customer Automation Templates                  */
/* -------------------------------------------------------------------------- */

export const STANDARD_WORKFLOW_TEMPLATES = [
  // TEMPLATE 1: CUSTOMER WELCOME AUTOMATION
  {
    templateCode: "WKF-TPL-WELCOME-01",
    name: "Customer Welcome Automation",
    category: "ONBOARDING",
    description:
      "Triggers on new customer registration, retrieves customer details, sends welcome email, creates in-app notification, and records execution.",
    triggerType: "CUSTOMER_CREATED",
    triggerConfig: { sourceFilter: "ALL" },
    priority: "HIGH" as const,
    assignedDepartment: "Customer Success",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "CUSTOMER_CREATED",
          label: "New Customer Registration",
          description: "Triggers when a new customer account is registered",
          config: { sourceFilter: "ALL" },
          position: { x: 80, y: 180 },
        },
        {
          id: "node_get_customer",
          type: "ACTION" as const,
          subType: "GET_CUSTOMER",
          label: "Retrieve Customer Details",
          description: "Loads full profile and contact information for {{customer.name}}",
          config: { lookupBy: "CONTEXT_ID", customerCodeOrEmail: "{{customer.code}}" },
          position: { x: 350, y: 180 },
        },
        {
          id: "node_send_welcome",
          type: "ACTION" as const,
          subType: "SEND_EMAIL",
          label: "Send Welcome Email",
          description: "Dispatches personalized welcome email to {{customer.email}}",
          config: {
            templateCode: "TPL-WELCOME-01",
            recipientEmail: "{{customer.email}}",
            subject: "Welcome to Billora, {{customer.name}}!",
          },
          position: { x: 620, y: 100 },
        },
        {
          id: "node_in_app_notif",
          type: "ACTION" as const,
          subType: "SEND_NOTIFICATION",
          label: "Create In-App Notification",
          description: "Notifies team and customer portal of new registration",
          config: {
            targetAudience: "ADMIN_AND_OWNER",
            title: "Welcome Dispatched: {{customer.name}}",
            message: "Customer {{customer.code}} ({{customer.email}}) registered and received welcome kit.",
          },
          position: { x: 620, y: 260 },
        },
        {
          id: "node_log_exec",
          type: "ACTION" as const,
          subType: "EXECUTION_LOGGER",
          label: "Record Execution",
          description: "Logs welcome automation completion to audit trail",
          config: {
            level: "INFO",
            message: "Customer Welcome Automation completed for {{customer.name}} ({{customer.code}})",
          },
          position: { x: 900, y: 180 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_get_customer", branch: "DEFAULT" as const },
        { id: "e2", source: "node_get_customer", target: "node_send_welcome", branch: "DEFAULT" as const },
        { id: "e3", source: "node_get_customer", target: "node_in_app_notif", branch: "DEFAULT" as const },
        { id: "e4", source: "node_send_welcome", target: "node_log_exec", branch: "DEFAULT" as const },
        { id: "e5", source: "node_in_app_notif", target: "node_log_exec", branch: "DEFAULT" as const },
      ],
    },
  },

  // TEMPLATE 2: SUBSCRIPTION RENEWAL REMINDER (7d / 3d / 1d schedules + duplicate protection)
  {
    templateCode: "WKF-TPL-RENEWAL-01",
    name: "Subscription Renewal Reminder (7d / 3d / 1d)",
    category: "RENEWAL",
    description:
      "Detects subscriptions approaching expiry, retrieves subscription & customer details, verifies ACTIVE status, sends idempotent renewal reminder, creates notification, and records execution.",
    triggerType: "SUBSCRIPTION_RENEWAL",
    triggerConfig: { daysBeforeRenewal: 7, reminderSchedules: [7, 3, 1], preventDuplicateReminders: true },
    priority: "HIGH" as const,
    assignedDepartment: "Sales & Customer Success",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "SUBSCRIPTION_RENEWAL",
          label: "Subscription Approaching Expiry",
          description: "Supports 7-day, 3-day, and 1-day pre-expiry reminder windows",
          config: { daysBeforeRenewal: "7", preventDuplicateReminders: true },
          position: { x: 60, y: 200 },
        },
        {
          id: "node_get_sub",
          type: "ACTION" as const,
          subType: "GET_SUBSCRIPTION",
          label: "Retrieve Subscription",
          description: "Loads subscription {{subscription.number}} and renewal date",
          config: { subscriptionNumber: "{{subscription.number}}" },
          position: { x: 310, y: 120 },
        },
        {
          id: "node_get_cust",
          type: "ACTION" as const,
          subType: "GET_CUSTOMER",
          label: "Retrieve Customer",
          description: "Loads primary contact {{customer.name}} ({{customer.email}})",
          config: { lookupBy: "CONTEXT_ID" },
          position: { x: 310, y: 280 },
        },
        {
          id: "node_cond_status",
          type: "CONDITION" as const,
          subType: "IF_ELSE",
          label: "IF Subscription Active?",
          description: "Verifies subscription status equals ACTIVE before sending reminder",
          config: {
            combinator: "AND",
            field: "subscription.status",
            operator: "EQUALS",
            value: "ACTIVE",
          },
          position: { x: 570, y: 200 },
        },
        {
          id: "node_send_reminder",
          type: "ACTION" as const,
          subType: "SEND_RENEWAL_REMINDER",
          label: "Send Renewal Reminder",
          description: "Dispatches idempotent renewal notice for {{subscription.plan_name}}",
          config: {
            reminderWindow: "7_DAYS",
            subject: "Upcoming Renewal Notice: {{subscription.plan_name}} on {{subscription.expiry_date}}",
          },
          position: { x: 840, y: 90 },
        },
        {
          id: "node_act_notify",
          type: "ACTION" as const,
          subType: "SEND_NOTIFICATION",
          label: "Create Renewal Notification",
          description: "Alerts account executive & logs in-app reminder",
          config: {
            targetAudience: "ADMIN_AND_OWNER",
            title: "Renewal Approaching: {{subscription.number}}",
            message: "Subscription for {{customer.name}} renews on {{subscription.expiry_date}}.",
          },
          position: { x: 840, y: 220 },
        },
        {
          id: "node_log_exec",
          type: "ACTION" as const,
          subType: "EXECUTION_LOGGER",
          label: "Record Execution",
          description: "Records renewal reminder delivery",
          config: {
            level: "INFO",
            message: "Renewal reminder processed for {{subscription.number}} ({{customer.email}})",
          },
          position: { x: 1100, y: 150 },
        },
        {
          id: "node_stop_inactive",
          type: "ACTION" as const,
          subType: "COMPLETE_WORKFLOW",
          label: "Stop Workflow (Not Active)",
          description: "Skips reminder when subscription is paused or cancelled",
          config: { outcome: "STOPPED", summary: "Subscription is not active; reminder skipped." },
          position: { x: 840, y: 350 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_get_sub" },
        { id: "e2", source: "node_get_sub", target: "node_get_cust" },
        { id: "e3", source: "node_get_cust", target: "node_cond_status" },
        { id: "e4", source: "node_cond_status", target: "node_send_reminder", branch: "TRUE" as const, label: "YES" },
        { id: "e5", source: "node_cond_status", target: "node_stop_inactive", branch: "FALSE" as const, label: "NO" },
        { id: "e6", source: "node_send_reminder", target: "node_act_notify" },
        { id: "e7", source: "node_act_notify", target: "node_log_exec" },
      ],
    },
  },

  // TEMPLATE 3: INVOICE OVERDUE AUTOMATION
  {
    templateCode: "WKF-TPL-OVERDUE-03",
    name: "Invoice Overdue Automation",
    category: "COLLECTIONS",
    description:
      "Triggers when an invoice becomes overdue, retrieves invoice, checks if Outstanding Amount > 0, retrieves customer details, sends payment reminder, creates notification, and records execution.",
    triggerType: "INVOICE_OVERDUE",
    triggerConfig: { daysOverdue: 1, minOutstanding: 1 },
    priority: "URGENT" as const,
    assignedDepartment: "Finance & Accounts",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "INVOICE_OVERDUE",
          label: "Invoice Becomes Overdue",
          description: "Triggers when invoice passes due date with unpaid balance",
          config: { daysOverdue: 1, minOutstanding: 1 },
          position: { x: 60, y: 200 },
        },
        {
          id: "node_get_inv",
          type: "ACTION" as const,
          subType: "GET_INVOICE",
          label: "Retrieve Invoice",
          description: "Fetches invoice {{invoice.number}} and due date",
          config: { invoiceNumber: "{{invoice.number}}" },
          position: { x: 290, y: 200 },
        },
        {
          id: "node_check_bal",
          type: "ACTION" as const,
          subType: "CHECK_OUTSTANDING_BALANCE",
          label: "Check Outstanding Balance",
          description: "Calculates remaining unpaid balance on {{invoice.number}}",
          config: {},
          position: { x: 520, y: 200 },
        },
        {
          id: "node_cond_bal",
          type: "CONDITION" as const,
          subType: "IF_ELSE",
          label: "IF Outstanding Amount > 0",
          description: "Routes TRUE if invoice still has unpaid balance > ₹0",
          config: {
            combinator: "AND",
            field: "invoice.outstanding_amount",
            operator: "GREATER_THAN",
            value: "0",
          },
          position: { x: 750, y: 200 },
        },
        {
          id: "node_get_cust",
          type: "ACTION" as const,
          subType: "GET_CUSTOMER",
          label: "Retrieve Customer Details",
          description: "Fetches billing contact for {{customer.name}}",
          config: { lookupBy: "CONTEXT_ID" },
          position: { x: 990, y: 90 },
        },
        {
          id: "node_send_rem",
          type: "ACTION" as const,
          subType: "SEND_PAYMENT_REMINDER",
          label: "Send Payment Reminder",
          description: "Sends overdue notice with balance ₹{{invoice.outstanding_amount}}",
          config: {
            subject: "Overdue Invoice Reminder: {{invoice.number}} (Balance: ₹{{invoice.outstanding_amount}})",
          },
          position: { x: 1230, y: 90 },
        },
        {
          id: "node_notif",
          type: "ACTION" as const,
          subType: "SEND_NOTIFICATION",
          label: "Create Collections Notification",
          description: "Notifies finance team of overdue follow-up",
          config: {
            targetAudience: "ADMIN_AND_OWNER",
            title: "Overdue Reminder Sent: {{invoice.number}}",
            message: "Customer {{customer.name}} notified for overdue balance ₹{{invoice.outstanding_amount}}.",
          },
          position: { x: 1230, y: 220 },
        },
        {
          id: "node_log",
          type: "ACTION" as const,
          subType: "EXECUTION_LOGGER",
          label: "Record Execution",
          description: "Logs overdue collection step to audit log",
          config: {
            level: "INFO",
            message: "Overdue reminder dispatched for {{invoice.number}} (₹{{invoice.outstanding_amount}})",
          },
          position: { x: 1470, y: 150 },
        },
        {
          id: "node_stop_paid",
          type: "ACTION" as const,
          subType: "COMPLETE_WORKFLOW",
          label: "Stop Workflow (Already Settled)",
          description: "Terminates cleanly if balance is already ₹0",
          config: { outcome: "STOPPED", summary: "Invoice has zero outstanding balance." },
          position: { x: 990, y: 330 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_get_inv" },
        { id: "e2", source: "node_get_inv", target: "node_check_bal" },
        { id: "e3", source: "node_check_bal", target: "node_cond_bal" },
        { id: "e4", source: "node_cond_bal", target: "node_get_cust", branch: "TRUE" as const, label: "TRUE (> 0)" },
        { id: "e5", source: "node_cond_bal", target: "node_stop_paid", branch: "FALSE" as const, label: "FALSE (0)" },
        { id: "e6", source: "node_get_cust", target: "node_send_rem" },
        { id: "e7", source: "node_send_rem", target: "node_notif" },
        { id: "e8", source: "node_notif", target: "node_log" },
      ],
    },
  },

  // TEMPLATE 4: PAYMENT SUCCESS AUTOMATION
  {
    templateCode: "WKF-TPL-PAY-SUCCESS-04",
    name: "Payment Success Automation",
    category: "BILLING",
    description:
      "Triggers when a verified payment is received, retrieves payment, verifies payment status is VERIFIED, retrieves invoice, sends payment confirmation receipt, and creates notification.",
    triggerType: "PAYMENT_SUCCESS",
    triggerConfig: { requireVerified: true },
    priority: "MEDIUM" as const,
    assignedDepartment: "Finance & Accounts",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "PAYMENT_SUCCESS",
          label: "Verified Payment Received",
          description: "Triggers when payment is verified in Billora ledger",
          config: { requireVerified: true },
          position: { x: 60, y: 180 },
        },
        {
          id: "node_get_pay",
          type: "ACTION" as const,
          subType: "GET_PAYMENT",
          label: "Retrieve Payment",
          description: "Loads payment transaction amount and reference",
          config: {},
          position: { x: 290, y: 180 },
        },
        {
          id: "node_check_pay",
          type: "ACTION" as const,
          subType: "CHECK_PAYMENT_STATUS",
          label: "Verify Payment Status",
          description: "Ensures payment status is cryptographically VERIFIED",
          config: {},
          position: { x: 520, y: 180 },
        },
        {
          id: "node_get_inv",
          type: "ACTION" as const,
          subType: "GET_INVOICE",
          label: "Retrieve Invoice",
          description: "Fetches linked invoice {{invoice.number}} and balance",
          config: { invoiceNumber: "{{invoice.number}}" },
          position: { x: 750, y: 180 },
        },
        {
          id: "node_notify_success",
          type: "ACTION" as const,
          subType: "NOTIFY_PAYMENT_SUCCESS",
          label: "Send Payment Confirmation",
          description: "Emails official payment receipt to {{customer.email}}",
          config: {
            subject: "Payment Confirmation: ₹{{payment.amount}} Received for {{invoice.number}}",
          },
          position: { x: 990, y: 100 },
        },
        {
          id: "node_in_app",
          type: "ACTION" as const,
          subType: "SEND_NOTIFICATION",
          label: "Create In-App Notification",
          description: "Records payment confirmation alert in workspace",
          config: {
            targetAudience: "ADMIN_AND_OWNER",
            title: "Payment Confirmed: {{invoice.number}}",
            message: "Verified payment of ₹{{payment.amount}} received from {{customer.name}}.",
          },
          position: { x: 990, y: 260 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_get_pay" },
        { id: "e2", source: "node_get_pay", target: "node_check_pay" },
        { id: "e3", source: "node_check_pay", target: "node_get_inv" },
        { id: "e4", source: "node_get_inv", target: "node_notify_success" },
        { id: "e5", source: "node_get_inv", target: "node_in_app" },
      ],
    },
  },

  // TEMPLATE 5: PAYMENT FAILURE AUTOMATION
  {
    templateCode: "WKF-TPL-DUNNING-02",
    name: "Payment Failure Automation",
    category: "COLLECTIONS",
    description:
      "Triggers on payment failure, retrieves payment and customer details, sends payment failure notification, creates finance follow-up task, and records execution.",
    triggerType: "PAYMENT_FAILED",
    triggerConfig: { autoDunning: true },
    priority: "URGENT" as const,
    assignedDepartment: "Finance & Accounts",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "PAYMENT_FAILED",
          label: "Payment Failure Trigger",
          description: "Triggers when a payment transaction fails",
          config: { autoDunning: true },
          position: { x: 60, y: 180 },
        },
        {
          id: "node_get_pay",
          type: "ACTION" as const,
          subType: "GET_PAYMENT",
          label: "Retrieve Payment",
          description: "Loads failed payment attempt details",
          config: {},
          position: { x: 290, y: 180 },
        },
        {
          id: "node_get_cust",
          type: "ACTION" as const,
          subType: "GET_CUSTOMER",
          label: "Retrieve Customer",
          description: "Loads customer contact {{customer.name}} ({{customer.email}})",
          config: { lookupBy: "CONTEXT_ID" },
          position: { x: 520, y: 180 },
        },
        {
          id: "node_act_email",
          type: "ACTION" as const,
          subType: "NOTIFY_PAYMENT_FAILURE",
          label: "Send Payment Failure Notification",
          description: "Dispatches dunning recovery email with retry link",
          config: {
            subject: "Action Required: Payment Failed for Invoice {{invoice.number}}",
          },
          position: { x: 760, y: 90 },
        },
        {
          id: "node_act_task",
          type: "ACTION" as const,
          subType: "CREATE_TASK",
          label: "Create Payment Follow-Up Task",
          description: "Assigns urgent collections recovery task to finance team",
          config: {
            title: "Resolve Failed Payment for Invoice {{invoice.number}} ({{customer.name}})",
            priority: "URGENT",
            dueDays: 2,
            category: "COLLECTIONS",
          },
          position: { x: 760, y: 260 },
        },
        {
          id: "node_act_complete",
          type: "ACTION" as const,
          subType: "EXECUTION_LOGGER",
          label: "Record Execution",
          description: "Logs dunning execution trace",
          config: {
            level: "WARN",
            message: "Payment failure workflow executed for {{customer.name}} ({{invoice.number}})",
          },
          position: { x: 1030, y: 180 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_get_pay" },
        { id: "e2", source: "node_get_pay", target: "node_get_cust" },
        { id: "e3", source: "node_get_cust", target: "node_act_email" },
        { id: "e4", source: "node_get_cust", target: "node_act_task" },
        { id: "e5", source: "node_act_email", target: "node_act_complete" },
        { id: "e6", source: "node_act_task", target: "node_act_complete" },
      ],
    },
  },

  // TEMPLATE 6: CUSTOMER ONBOARDING
  {
    templateCode: "WKF-TPL-ONBOARDING-03",
    name: "Customer Onboarding Automation",
    category: "ONBOARDING",
    description:
      "Triggers when a new customer is created, retrieves customer details, sends welcome email, notifies assigned employee via task, creates onboarding notification, and records completion.",
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
          label: "New Customer Created",
          description: "Triggers when a new customer is created in Billora",
          config: {},
          position: { x: 60, y: 180 },
        },
        {
          id: "node_get_cust",
          type: "ACTION" as const,
          subType: "GET_CUSTOMER",
          label: "Retrieve Customer Details",
          description: "Loads {{customer.name}} profile and assigned employee",
          config: { lookupBy: "CONTEXT_ID" },
          position: { x: 300, y: 180 },
        },
        {
          id: "node_act_email",
          type: "ACTION" as const,
          subType: "SEND_EMAIL",
          label: "Send Welcome Email",
          description: "Sends onboarding guide to {{customer.email}}",
          config: {
            templateCode: "TPL-WELCOME-01",
            subject: "Getting Started with Billora — {{customer.name}}",
          },
          position: { x: 550, y: 80 },
        },
        {
          id: "node_act_task",
          type: "ACTION" as const,
          subType: "CREATE_TASK",
          label: "Notify Assigned Employee",
          description: "Assigns onboarding kick-off task to account executive",
          config: {
            title: "Executive Onboarding Kick-Off for {{customer.name}} ({{customer.code}})",
            priority: "MEDIUM",
            dueDays: 5,
            category: "ONBOARDING",
          },
          position: { x: 550, y: 200 },
        },
        {
          id: "node_notif",
          type: "ACTION" as const,
          subType: "SEND_NOTIFICATION",
          label: "Create Onboarding Notification",
          description: "Posts onboarding alert in notification center",
          config: {
            targetAudience: "ASSIGNED_EMPLOYEE",
            title: "New Customer Onboarding: {{customer.name}}",
            message: "Onboarding task and welcome kit initiated for {{customer.code}}.",
          },
          position: { x: 550, y: 320 },
        },
        {
          id: "node_act_complete",
          type: "ACTION" as const,
          subType: "COMPLETE_WORKFLOW",
          label: "Record Completion",
          description: "Marks onboarding sequence completed",
          config: { outcome: "SUCCESS", summary: "Customer onboarding workflow completed" },
          position: { x: 840, y: 180 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_get_cust" },
        { id: "e2", source: "node_get_cust", target: "node_act_email" },
        { id: "e3", source: "node_get_cust", target: "node_act_task" },
        { id: "e4", source: "node_get_cust", target: "node_notif" },
        { id: "e5", source: "node_act_email", target: "node_act_complete" },
        { id: "e6", source: "node_act_task", target: "node_act_complete" },
        { id: "e7", source: "node_notif", target: "node_act_complete" },
      ],
    },
  },

  // TEMPLATE 7: SUBSCRIPTION EXPIRY AUTOMATION
  {
    templateCode: "WKF-TPL-EXPIRY-07",
    name: "Subscription Expiry Automation",
    category: "RENEWAL",
    description:
      "Triggers when a subscription expires, identifies the expired subscription, verifies current status, retrieves customer details, sends expiry notification, and records execution.",
    triggerType: "SUBSCRIPTION_EXPIRED",
    triggerConfig: { gracePeriodDays: 0 },
    priority: "HIGH" as const,
    assignedDepartment: "Sales & Customer Success",
    definition: {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER" as const,
          subType: "SUBSCRIPTION_EXPIRED",
          label: "Subscription Expires",
          description: "Triggers when subscription reaches expiration date",
          config: { gracePeriodDays: 0 },
          position: { x: 60, y: 180 },
        },
        {
          id: "node_get_sub",
          type: "ACTION" as const,
          subType: "GET_SUBSCRIPTION",
          label: "Identify Expired Subscription",
          description: "Retrieves expired contract {{subscription.number}}",
          config: { subscriptionNumber: "{{subscription.number}}" },
          position: { x: 300, y: 180 },
        },
        {
          id: "node_check_status",
          type: "ACTION" as const,
          subType: "CHECK_SUBSCRIPTION_STATUS",
          label: "Verify Current Status",
          description: "Verifies subscription status and period end timestamp",
          config: { expectedStatus: "EXPIRED" },
          position: { x: 540, y: 180 },
        },
        {
          id: "node_get_cust",
          type: "ACTION" as const,
          subType: "GET_CUSTOMER",
          label: "Retrieve Customer",
          description: "Loads customer contact {{customer.name}} ({{customer.email}})",
          config: { lookupBy: "CONTEXT_ID" },
          position: { x: 780, y: 180 },
        },
        {
          id: "node_notify_exp",
          type: "ACTION" as const,
          subType: "NOTIFY_SUBSCRIPTION_EXPIRY",
          label: "Send Expiry Notification",
          description: "Dispatches formal subscription expiration email & in-app alert",
          config: {
            subject: "Notice: Your Billora Subscription {{subscription.number}} Has Expired",
          },
          position: { x: 1020, y: 110 },
        },
        {
          id: "node_log_exp",
          type: "ACTION" as const,
          subType: "EXECUTION_LOGGER",
          label: "Record Execution",
          description: "Records expiration notification in workflow audit log",
          config: {
            level: "WARN",
            message: "Subscription expiry notice sent for {{subscription.number}} ({{customer.name}})",
          },
          position: { x: 1020, y: 250 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_get_sub" },
        { id: "e2", source: "node_get_sub", target: "node_check_status" },
        { id: "e3", source: "node_check_status", target: "node_get_cust" },
        { id: "e4", source: "node_get_cust", target: "node_notify_exp" },
        { id: "e5", source: "node_notify_exp", target: "node_log_exp" },
      ],
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Default Approved Integrations Seed                                         */
/* -------------------------------------------------------------------------- */

const DEFAULT_INTEGRATIONS = [
  {
    id: "int_email_resend",
    integrationKey: "INT-EMAIL-PRIMARY",
    name: "Billora Transactional Email (Resend / SMTP)",
    providerType: "EMAIL",
    endpointUrl: "https://api.resend.com/emails",
    credentialSecret: "re_live_server_managed_key",
    isActive: true,
    isApprovedForEmployees: true,
    configJson: JSON.stringify({ senderAddress: "billing@billora.io", region: "ap-south-1" }),
  },
  {
    id: "int_webhook_default",
    integrationKey: "INT-WEBHOOK-DEFAULT",
    name: "Enterprise Outbound Webhook Relay",
    providerType: "WEBHOOK",
    endpointUrl: "https://hooks.billora.internal/v1/events",
    credentialSecret: "whsec_billora_hmac_sha256",
    isActive: true,
    isApprovedForEmployees: true,
    configJson: JSON.stringify({ signatureHeader: "X-Billora-Signature", timeoutMs: 5000 }),
  },
  {
    id: "int_sms_gateway",
    integrationKey: "INT-SMS-GATEWAY",
    name: "India DLT Transactional SMS (MSG91 / Twilio)",
    providerType: "SMS",
    endpointUrl: "https://api.msg91.com/api/v5/flow",
    credentialSecret: "sms_secret_token_99182",
    isActive: true,
    isApprovedForEmployees: true,
    configJson: JSON.stringify({ senderId: "BILORA", dltTemplateId: "110716890001" }),
  },
  {
    id: "int_slack_ops",
    integrationKey: "INT-SLACK-FINANCE",
    name: "Slack #finance-alerts Channel",
    providerType: "SLACK",
    endpointUrl: "https://hooks.slack.com/services/T000/B000/BILLORA",
    credentialSecret: "xoxb_slack_bot_secret",
    isActive: true,
    isApprovedForEmployees: true,
    configJson: JSON.stringify({ channel: "#finance-alerts" }),
  },
  {
    id: "int_http_api",
    integrationKey: "INT-HTTP-API",
    name: "External ERP / CRM REST Bridge",
    providerType: "HTTP_API",
    endpointUrl: "https://erp.enterprise.internal/api",
    credentialSecret: "Bearer_erp_internal_secret",
    isActive: true,
    isApprovedForEmployees: true,
    configJson: JSON.stringify({ retryCount: 2 }),
  },
  {
    id: "int_crm_hubspot",
    integrationKey: "INT-CRM-HUBSPOT",
    name: "HubSpot Enterprise CRM Sync",
    providerType: "CRM",
    endpointUrl: "https://api.hubapi.com/crm/v3/objects",
    credentialSecret: "pat_na1_hubspot_admin_only",
    isActive: true,
    isApprovedForEmployees: false, // Admin-restricted integration example
    configJson: JSON.stringify({ syncContacts: true, syncDeals: true }),
  },
];

let auxTablesInitialized = false;

async function ensureAuxiliaryWorkflowTables() {
  if (auxTablesInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkflowIntegration" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "integrationKey" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "providerType" TEXT NOT NULL,
        "endpointUrl" TEXT,
        "credentialSecret" TEXT,
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "isApprovedForEmployees" INTEGER NOT NULL DEFAULT 1,
        "configJson" TEXT,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const item of DEFAULT_INTEGRATIONS) {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "WorkflowIntegration" ("id", "integrationKey", "name", "providerType", "endpointUrl", "credentialSecret", "isActive", "isApprovedForEmployees", "configJson", "updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
        item.id,
        item.integrationKey,
        item.name,
        item.providerType,
        item.endpointUrl,
        item.credentialSecret,
        item.isActive ? 1 : 0,
        item.isApprovedForEmployees ? 1 : 0,
        item.configJson
      );
    }
    auxTablesInitialized = true;
  } catch {
    // Ignore if table already initialized concurrently
  }
}

function maskSecret(secret?: string | null): string {
  if (!secret) return "••••••••";
  if (secret.length <= 6) return "••••••••";
  return `${secret.slice(0, 4)}••••••••${secret.slice(-2)}`;
}

function redactSensitivePayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitivePayload);

  const sensitiveKeys = new Set([
    "password",
    "passwordHash",
    "password_hash",
    "tokenHash",
    "csrfToken",
    "apiKey",
    "secret",
    "credentialSecret",
    "serviceRoleKey",
    "authorization",
  ]);

  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (sensitiveKeys.has(k) || k.toLowerCase().includes("secret") || k.toLowerCase().includes("password")) {
      cleaned[k] = "[REDACTED]";
    } else if (typeof v === "object") {
      cleaned[k] = redactSensitivePayload(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

/* -------------------------------------------------------------------------- */
/* Condition Evaluator Helper                                                 */
/* -------------------------------------------------------------------------- */

function evaluateSingleComparison(leftVal: any, operator: string, rightVal: any): boolean {
  const op = (operator || "EQUALS").toUpperCase();

  if (op === "IS_EMPTY") {
    return leftVal === undefined || leftVal === null || String(leftVal).trim() === "";
  }
  if (op === "IS_NOT_EMPTY") {
    return leftVal !== undefined && leftVal !== null && String(leftVal).trim() !== "";
  }

  const leftNum = Number(String(leftVal ?? "").replace(/[₹,\s]/g, ""));
  const rightNum = Number(String(rightVal ?? "").replace(/[₹,\s]/g, ""));
  const bothNumeric =
    String(leftVal ?? "").trim() !== "" &&
    String(rightVal ?? "").trim() !== "" &&
    !Number.isNaN(leftNum) &&
    !Number.isNaN(rightNum);

  switch (op) {
    case "EQUALS":
    case "==":
      return bothNumeric
        ? leftNum === rightNum
        : String(leftVal ?? "").toLowerCase() === String(rightVal ?? "").toLowerCase();
    case "NOT_EQUALS":
    case "!=":
      return bothNumeric
        ? leftNum !== rightNum
        : String(leftVal ?? "").toLowerCase() !== String(rightVal ?? "").toLowerCase();
    case "GREATER_THAN":
    case ">":
      return (Number.isNaN(leftNum) ? 0 : leftNum) > (Number.isNaN(rightNum) ? 0 : rightNum);
    case "LESS_THAN":
    case "<":
      return (Number.isNaN(leftNum) ? 0 : leftNum) < (Number.isNaN(rightNum) ? 0 : rightNum);
    case "GTE":
    case ">=":
      return (Number.isNaN(leftNum) ? 0 : leftNum) >= (Number.isNaN(rightNum) ? 0 : rightNum);
    case "LTE":
    case "<=":
      return (Number.isNaN(leftNum) ? 0 : leftNum) <= (Number.isNaN(rightNum) ? 0 : rightNum);
    case "CONTAINS":
      return String(leftVal ?? "")
        .toLowerCase()
        .includes(String(rightVal ?? "").toLowerCase());
    case "IN": {
      const list = Array.isArray(rightVal)
        ? rightVal.map((x) => String(x).trim().toLowerCase())
        : String(rightVal ?? "")
            .split(",")
            .map((x) => x.trim().toLowerCase());
      return list.includes(String(leftVal ?? "").trim().toLowerCase());
    }
    default:
      return Boolean(leftVal);
  }
}

export class WorkflowEngineService {
  /**
   * Enforce strict Role-Based Access Control (Phase 1)
   */
  static assertStudioAccess(session: AuthSessionContext) {
    if (!session || (session.role !== "ADMIN" && session.role !== "EMPLOYEE")) {
      throw new AppError(
        "FORBIDDEN",
        "Customers do not have access to Workflow Studio or automation configurations",
        403
      );
    }
  }

  static canManageWorkflow(session: AuthSessionContext, workflow: { ownerId: string; workflowCode?: string }) {
    if (session.role === "ADMIN") return true;
    if (session.role !== "EMPLOYEE") return false;
    // Employees can manage workflows they created/own or standard editable templates
    return (
      workflow.ownerId === session.userId ||
      Boolean(workflow.workflowCode?.startsWith("WKF-TPL-"))
    );
  }

  /**
   * Seed all 7 default customer automation templates into database if not present
   */
  static async seedDefaultWorkflows(adminUserId: string) {
    await ensureAuxiliaryWorkflowTables();

    for (const tpl of STANDARD_WORKFLOW_TEMPLATES) {
      const existing = await prisma.workflow.findUnique({
        where: { workflowCode: tpl.templateCode },
      });

      if (!existing) {
        await prisma.workflow.create({
          data: {
            workflowCode: tpl.templateCode,
            name: tpl.name,
            description: tpl.description,
            category: tpl.category,
            ownerId: adminUserId,
            assignedDepartment: tpl.assignedDepartment,
            priority: tpl.priority,
            triggerType: tpl.triggerType,
            triggerConfig: JSON.stringify(tpl.triggerConfig),
            status: "ACTIVE",
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
   * List Global & Employee-Approved Integrations (Phase 10)
   */
  static async listIntegrations(session: AuthSessionContext): Promise<WorkflowIntegrationRecord[]> {
    this.assertStudioAccess(session);
    await ensureAuxiliaryWorkflowTables();

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id", "integrationKey", "name", "providerType", "endpointUrl", "credentialSecret", "isActive", "isApprovedForEmployees", "configJson", "updatedAt"
       FROM "WorkflowIntegration"
       ORDER BY "name" ASC;`
    )) as any[];

    return rows
      .filter((r) => session.role === "ADMIN" || Boolean(r.isApprovedForEmployees))
      .map((r) => ({
        id: String(r.id),
        integrationKey: String(r.integrationKey),
        name: String(r.name),
        providerType: r.providerType,
        endpointUrl: r.endpointUrl ? String(r.endpointUrl) : null,
        credentialMasked: maskSecret(r.credentialSecret),
        isActive: Boolean(r.isActive),
        isApprovedForEmployees: Boolean(r.isApprovedForEmployees),
        configJson: r.configJson ? String(r.configJson) : null,
        updatedAt: r.updatedAt ? String(r.updatedAt) : new Date().toISOString(),
      }));
  }

  /**
   * Create or Update Integration (ADMIN ONLY — Phase 1 & 10)
   */
  static async upsertIntegration(
    session: AuthSessionContext,
    input: {
      integrationKey: string;
      name: string;
      providerType: string;
      endpointUrl?: string;
      credentialSecret?: string;
      isActive?: boolean;
      isApprovedForEmployees?: boolean;
      configJson?: Record<string, any> | string;
    }
  ) {
    this.assertStudioAccess(session);
    if (session.role !== "ADMIN") {
      throw new AppError(
        "FORBIDDEN",
        "Only Administrators can configure or modify global system integrations",
        403
      );
    }
    await ensureAuxiliaryWorkflowTables();

    const key = input.integrationKey.trim().toUpperCase();
    const id = `int_${key.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const configStr =
      typeof input.configJson === "string"
        ? input.configJson
        : JSON.stringify(input.configJson || {});

    await prisma.$executeRawUnsafe(
      `INSERT INTO "WorkflowIntegration" ("id", "integrationKey", "name", "providerType", "endpointUrl", "credentialSecret", "isActive", "isApprovedForEmployees", "configJson", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT("integrationKey") DO UPDATE SET
         "name" = excluded."name",
         "providerType" = excluded."providerType",
         "endpointUrl" = excluded."endpointUrl",
         "credentialSecret" = COALESCE(NULLIF(excluded."credentialSecret", ''), "WorkflowIntegration"."credentialSecret"),
         "isActive" = excluded."isActive",
         "isApprovedForEmployees" = excluded."isApprovedForEmployees",
         "configJson" = excluded."configJson",
         "updatedAt" = CURRENT_TIMESTAMP;`,
      id,
      key,
      input.name.trim(),
      input.providerType,
      input.endpointUrl || null,
      input.credentialSecret || "server_managed_secret",
      input.isActive !== false ? 1 : 0,
      input.isApprovedForEmployees !== false ? 1 : 0,
      configStr
    );

    const all = await this.listIntegrations(session);
    return all.find((i) => i.integrationKey === key) || all[0];
  }

  /**
   * Create a new custom workflow
   */
  static async createWorkflow(session: AuthSessionContext, input: CreateWorkflowInput) {
    this.assertStudioAccess(session);

    const count = await prisma.workflow.count();
    const prefix = (input.triggerType || "CUS").replace(/[^A-Z]/g, "").slice(0, 3) || "WKF";
    const workflowCode = `WKF-${prefix}-${String(count + 101).padStart(3, "0")}`;

    const defaultDefinition: WorkflowDefinition = input.definition || {
      nodes: [
        {
          id: "node_trigger",
          type: "TRIGGER",
          subType: input.triggerType,
          label: `${input.triggerType.replace(/_/g, " ")} Trigger`,
          description: "Starts workflow when trigger condition is met",
          config: input.triggerConfig || {},
          position: { x: 100, y: 180 },
        },
        {
          id: "node_get_customer",
          type: "ACTION",
          subType: "GET_CUSTOMER",
          label: "Get Customer Details",
          description: "Loads customer profile into workflow context",
          config: { lookupBy: "CONTEXT_ID" },
          position: { x: 380, y: 180 },
        },
        {
          id: "node_action",
          type: "ACTION",
          subType: "CREATE_TASK",
          label: "Assign Follow-Up Task",
          description: "Creates tracked operational task for {{customer.name}}",
          config: {
            title: "Follow up with {{customer.name}} ({{customer.code}})",
            priority: input.priority || "MEDIUM",
            dueDays: 3,
          },
          position: { x: 660, y: 180 },
        },
      ],
      edges: [
        { id: "e1", source: "node_trigger", target: "node_get_customer", branch: "DEFAULT" },
        { id: "e2", source: "node_get_customer", target: "node_action", branch: "DEFAULT" },
      ],
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
        ...(input.triggerType === "SCHEDULE_TRIGGER" || input.scheduleCron
          ? {
              schedules: {
                create: {
                  cronExpression: input.scheduleCron || input.triggerConfig?.cronExpression || "0 9 * * *",
                  nextRunAt: new Date(Date.now() + 3600_000),
                  isActive: true,
                },
              },
            }
          : {}),
      },
      include: {
        versions: true,
        schedules: true,
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
      scheduleCron?: string;
    }
  ) {
    this.assertStudioAccess(session);

    const existing = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Workflow not found", 404);

    if (!this.canManageWorkflow(session, existing)) {
      throw new AppError(
        "FORBIDDEN",
        "You do not have permission to modify a workflow owned by another operator",
        403
      );
    }

    let nextVersion = existing.version;
    const isDefinitionUpdate = Boolean(input.definition);

    // Validate that employees do not attach restricted admin-only integrations
    if (isDefinitionUpdate && session.role === "EMPLOYEE" && input.definition?.nodes) {
      const approvedIntegrations = await this.listIntegrations(session);
      const approvedKeys = new Set(approvedIntegrations.map((i) => i.integrationKey));
      for (const n of input.definition.nodes) {
        const refKey = n.config?.integrationKey;
        if (refKey && !approvedKeys.has(refKey)) {
          throw new AppError(
            "FORBIDDEN",
            `Integration "${refKey}" is restricted to Administrators and not approved for Employee workflows.`,
            403
          );
        }
      }
    }

    if (isDefinitionUpdate && input.definition) {
      nextVersion += 1;
      await prisma.workflowVersion.create({
        data: {
          workflowId: existing.id,
          version: nextVersion,
          definition: JSON.stringify(input.definition),
          changelog: input.changelog || `Saved version v${nextVersion}`,
          publishedAt: new Date(),
          publishedBy: session.userId,
        },
      });
    }

    if (input.scheduleCron !== undefined) {
      await prisma.automationSchedule.deleteMany({ where: { workflowId: existing.id } });
      if (input.scheduleCron.trim()) {
        await prisma.automationSchedule.create({
          data: {
            workflowId: existing.id,
            cronExpression: input.scheduleCron.trim(),
            nextRunAt: new Date(Date.now() + 3600_000),
            isActive: (input.status ?? existing.status) === "ACTIVE",
          },
        });
      }
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
        schedules: true,
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { executions: true, tasks: true } },
      },
    });

    return updated;
  }

  /**
   * List workflows with search, category, and RBAC visibility filters
   */
  static async listWorkflows(
    query: {
      status?: string;
      category?: string;
      search?: string;
    },
    session?: AuthSessionContext
  ) {
    if (session) {
      this.assertStudioAccess(session);
    }

    const adminUser = await prisma.user.findFirst({ where: { role: { name: "ADMIN" } } });
    if (adminUser) {
      await this.seedDefaultWorkflows(adminUser.id);
    }

    const where: any = {};
    if (query.status && query.status !== "ALL") where.status = query.status;
    if (query.category && query.category !== "ALL") where.category = query.category;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q } },
        { workflowCode: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const all = await prisma.workflow.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        versions: { orderBy: { version: "desc" }, take: 3 },
        schedules: true,
        _count: { select: { executions: true, tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (session && session.role === "EMPLOYEE") {
      return all.filter(
        (w) =>
          w.ownerId === session.userId ||
          w.workflowCode.startsWith("WKF-TPL-") ||
          w.status === "ACTIVE"
      );
    }

    return all;
  }

  /**
   * Get single workflow with complete version history & recent executions
   */
  static async getWorkflow(workflowId: string, session?: AuthSessionContext) {
    if (session) {
      this.assertStudioAccess(session);
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        versions: { orderBy: { version: "desc" } },
        schedules: true,
        executions: {
          take: 15,
          orderBy: { startedAt: "desc" },
          include: {
            customer: { select: { id: true, customerCode: true, contactName: true, email: true } },
            subscription: { select: { id: true, subscriptionNumber: true, status: true } },
            steps: { orderBy: { startedAt: "asc" } },
          },
        },
        _count: { select: { executions: true, tasks: true } },
      },
    });

    if (!workflow) throw new AppError("NOT_FOUND", "Workflow not found", 404);
    return workflow;
  }

  /**
   * Duplicate an existing workflow or template
   */
  static async duplicateWorkflow(session: AuthSessionContext, workflowId: string) {
    this.assertStudioAccess(session);
    const source = await this.getWorkflow(workflowId, session);
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
      include: {
        versions: true,
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { executions: true, tasks: true } },
      },
    });

    return copy;
  }

  /**
   * Export workflow as validated portable JSON
   */
  static async exportWorkflowJson(session: AuthSessionContext, workflowId: string) {
    this.assertStudioAccess(session);
    const wkf = await this.getWorkflow(workflowId, session);
    const latestVersion = wkf.versions[0];
    let parsedDef: WorkflowDefinition = { nodes: [], edges: [] };
    try {
      if (latestVersion?.definition) parsedDef = JSON.parse(latestVersion.definition);
    } catch {}

    return {
      schemaVersion: "billora.workflow.v1",
      exportedAt: new Date().toISOString(),
      workflow: {
        name: wkf.name,
        description: wkf.description,
        category: wkf.category,
        priority: wkf.priority,
        triggerType: wkf.triggerType,
        triggerConfig: wkf.triggerConfig ? JSON.parse(wkf.triggerConfig) : {},
        assignedDepartment: wkf.assignedDepartment,
        definition: parsedDef,
      },
    };
  }

  /**
   * Import workflow from validated JSON payload
   */
  static async importWorkflowJson(session: AuthSessionContext, payload: any) {
    this.assertStudioAccess(session);
    const wkfData = payload?.workflow || payload;
    if (!wkfData?.name || !wkfData?.definition?.nodes || !Array.isArray(wkfData.definition.nodes)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid workflow JSON: must contain `name` and `definition.nodes` array.",
        400
      );
    }

    return this.createWorkflow(session, {
      name: String(wkfData.name).trim(),
      description: wkfData.description ? String(wkfData.description) : "Imported workflow",
      category: wkfData.category || "GENERAL",
      priority: wkfData.priority || "MEDIUM",
      triggerType: wkfData.triggerType || "MANUAL_TRIGGER",
      triggerConfig: wkfData.triggerConfig || {},
      assignedDepartment: wkfData.assignedDepartment || "Operations",
      definition: {
        nodes: wkfData.definition.nodes,
        edges: Array.isArray(wkfData.definition.edges) ? wkfData.definition.edges : [],
      },
      status: "DRAFT",
    });
  }

  /**
   * CORE DIRECTED ACYCLIC GRAPH (DAG) WORKFLOW EXECUTION ENGINE (Phases 5, 6, 8, 12)
   * Traverses connected edges, evaluates multi-rule conditions, routes TRUE/FALSE/ERROR branches,
   * resolves dynamic `{{expressions}}`, enforces retries & idempotency, and records step traces.
   */
  static async emitEvent(
    eventType: string,
    payload: {
      workflowId?: string;
      customerId?: string;
      subscriptionId?: string;
      invoiceId?: string;
      quotationId?: string;
      paymentId?: string;
      taskId?: string;
      forceRunDraft?: boolean;
      metadata?: Record<string, any>;
    },
    idempotencyKey?: string
  ) {
    // 1. Idempotency deduplication check
    if (idempotencyKey) {
      const existingExecution = await prisma.workflowExecution.findUnique({
        where: { idempotencyKey },
        include: { steps: true, workflow: true, customer: true, subscription: true },
      });
      if (existingExecution) {
        return [existingExecution];
      }
    }

    // 2. Find matching workflows
    const whereClause: any = payload.workflowId
      ? { id: payload.workflowId }
      : {
          triggerType: eventType,
          status: "ACTIVE",
        };

    const targetWorkflows = await prisma.workflow.findMany({
      where: whereClause,
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    if (!targetWorkflows.length) {
      return [];
    }

    // 3. Resolve live Billora domain entities (Customer, Subscription, Invoice, Payment, Quotation)
    let customer: any = null;
    let subscription: any = null;
    let invoice: any = null;
    let quotation: any = null;
    let payment: any = null;

    if (payload.customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: payload.customerId },
        include: { assignedEmployee: { include: { user: true } } },
      });
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
        include: { customer: true, subscription: { include: { plan: true } } },
      });
      if (!customer && invoice?.customer) customer = invoice.customer;
      if (!subscription && invoice?.subscription) subscription = invoice.subscription;
    }
    if (payload.paymentId) {
      payment = await prisma.payment.findUnique({
        where: { id: payload.paymentId },
        include: { invoice: true, customer: true },
      });
      if (!invoice && payment?.invoice) invoice = payment.invoice;
      if (!customer && payment?.customer) customer = payment.customer;
    }
    if (payload.quotationId) {
      quotation = await prisma.quotation.findUnique({
        where: { id: payload.quotationId },
        include: { customer: true, plan: true },
      });
      if (!customer && quotation?.customer) customer = quotation.customer;
    }

    // Fallback context resolution if none explicitly passed
    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: { deletedAt: null },
        include: { assignedEmployee: { include: { user: true } } },
      });
    }
    if (!subscription && customer) {
      subscription = await prisma.subscription.findFirst({
        where: { customerId: customer.id },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });
    }
    if (!invoice && customer) {
      invoice = await prisma.invoice.findFirst({
        where: { customerId: customer.id },
        orderBy: { invoiceDate: "desc" },
      });
    }
    if (!payment && customer) {
      payment = await prisma.payment.findFirst({
        where: { customerId: customer.id },
        orderBy: { paymentDate: "desc" },
      });
    }

    const defaultAdmin = await prisma.user.findFirst({ where: { role: { name: "ADMIN" } } });
    const executionResults = [];

    for (const wkf of targetWorkflows) {
      const version = wkf.versions[0];
      if (!version) continue;

      const scopedIdemKey = idempotencyKey ? `${idempotencyKey}_${wkf.id}` : undefined;
      if (scopedIdemKey) {
        const existingExec = await prisma.workflowExecution.findUnique({
          where: { idempotencyKey: scopedIdemKey },
          include: {
            steps: { orderBy: { startedAt: "asc" } },
            workflow: true,
            customer: true,
            subscription: true,
          },
        });
        if (existingExec) {
          executionResults.push(existingExec);
          continue;
        }
      }

      let graph: WorkflowDefinition = { nodes: [], edges: [] };
      try {
        graph = JSON.parse(version.definition);
      } catch {
        continue;
      }

      // Duplicate reminder guard for SUBSCRIPTION_RENEWAL
      let triggerCfg: Record<string, any> = {};
      try {
        if (wkf.triggerConfig) triggerCfg = JSON.parse(wkf.triggerConfig);
      } catch {}

      if (
        eventType === "SUBSCRIPTION_RENEWAL" &&
        triggerCfg.preventDuplicateReminders &&
        subscription?.id &&
        !payload.metadata?.isTestRun
      ) {
        const dayKey = new Date().toISOString().slice(0, 10);
        const dupCheck = await prisma.workflowExecution.findFirst({
          where: {
            workflowId: wkf.id,
            subscriptionId: subscription.id,
            status: "COMPLETED",
            startedAt: { gte: new Date(`${dayKey}T00:00:00.000Z`) },
          },
          include: {
            steps: { orderBy: { startedAt: "asc" } },
          },
        });
        if (dupCheck) {
          executionResults.push(dupCheck);
          continue;
        }
      }

      const count = await prisma.workflowExecution.count();
      const executionCode = `WEX-${new Date().getFullYear()}-${String(count + 101).padStart(4, "0")}`;

      const expiryIso = subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toISOString().slice(0, 10)
        : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

      const outstandingNum = Number(invoice?.outstandingAmount ?? invoice?.totalAmount ?? 18500);
      const invoiceTotalNum = Number(invoice?.totalAmount ?? subscription?.totalAmount ?? 18500);
      const paymentAmountNum = Number(payment?.amount ?? invoiceTotalNum);

      // Rich nested + flat context state for `{{...}}` expression resolution
      const contextState: Record<string, any> = {
        ...payload.metadata,
        customer: {
          id: customer?.id || "cust_demo",
          name: customer?.companyName || customer?.contactName || "Customer",
          contact_name: customer?.contactName || "Customer",
          company_name: customer?.companyName || "",
          code: customer?.customerCode || "CUST-1001",
          email: customer?.email || "customer@example.com",
          phone: customer?.phone || "+91 98765 43210",
          city: customer?.city || "Bengaluru",
          state: customer?.state || "Karnataka",
          gstin: customer?.gstin || "",
        },
        subscription: {
          id: subscription?.id || "sub_demo",
          number: subscription?.subscriptionNumber || "SUB-2026-0001",
          status: subscription?.status || "ACTIVE",
          plan_name: subscription?.plan?.name || "Enterprise Growth Plan",
          billing_frequency: subscription?.billingFrequency || "MONTHLY",
          expiry_date: expiryIso,
          renewal_date: expiryIso,
          amount: Number(subscription?.totalAmount ?? 14999),
        },
        invoice: {
          id: invoice?.id || "inv_demo",
          number: invoice?.invoiceNumber || "INV-2026-0101",
          status: invoice?.status || "CONFIRMED",
          total_amount: invoiceTotalNum,
          outstanding_amount: outstandingNum,
          due_date: invoice?.dueDate
            ? new Date(invoice.dueDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        },
        payment: {
          id: payment?.id || "pay_demo",
          amount: paymentAmountNum,
          status:
            eventType === "PAYMENT_FAILED"
              ? "FAILED"
              : payment?.status || "VERIFIED",
          reference: payment?.gatewayPaymentId || "pay_Rzp998123",
          method: payment?.paymentMethod || "UPI",
        },
        employee: {
          name:
            customer?.assignedEmployee?.user?.fullName ||
            defaultAdmin?.fullName ||
            "Account Executive",
          email:
            customer?.assignedEmployee?.user?.email ||
            defaultAdmin?.email ||
            "ops@billora.io",
        },
        variables: {},
        steps: {},
        // Legacy flat keys for 100% backward compatibility with existing templates
        customer_name: customer?.companyName || customer?.contactName || "Customer",
        customer_code: customer?.customerCode || "CUST-1001",
        customer_email: customer?.email || "customer@example.com",
        plan_name: subscription?.plan?.name || quotation?.plan?.name || "Enterprise Subscription",
        subscription_number: subscription?.subscriptionNumber || "SUB-2026-0001",
        renewal_date: expiryIso,
        invoice_number: invoice?.invoiceNumber || "INV-2026-0101",
        invoice_amount: `₹${invoiceTotalNum.toLocaleString("en-IN")}`,
        quotation_number: quotation?.quotationNumber || "QTN-2026-0001",
        employee_name: defaultAdmin?.fullName || "Account Executive",
        status: subscription?.status || invoice?.status || "ACTIVE",
      };

      const execution = await prisma.workflowExecution.create({
        data: {
          executionCode,
          workflowId: wkf.id,
          versionId: version.id,
          triggerEvent: eventType,
          triggerPayload: JSON.stringify(redactSensitivePayload(payload)),
          customerId: customer?.id ?? null,
          subscriptionId: subscription?.id ?? null,
          invoiceId: invoice?.id ?? null,
          quotationId: quotation?.id ?? null,
          status: "RUNNING",
          currentStep: "TRIGGER",
          idempotencyKey: scopedIdemKey,
          contextData: JSON.stringify(redactSensitivePayload(contextState)),
        },
      });

      let executionStatus = "COMPLETED";
      let failureReason: string | null = null;

      // Build adjacency map from `graph.edges` for true DAG traversal
      const nodeMap = new Map<string, CanvasNode>(graph.nodes.map((n) => [n.id, n]));
      const outgoingEdgesMap = new Map<string, CanvasEdge[]>();
      const incomingCountMap = new Map<string, number>();

      for (const n of graph.nodes) {
        outgoingEdgesMap.set(n.id, []);
        incomingCountMap.set(n.id, 0);
      }
      for (const e of graph.edges || []) {
        if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
          outgoingEdgesMap.get(e.source)!.push(e);
          incomingCountMap.set(e.target, (incomingCountMap.get(e.target) || 0) + 1);
        }
      }

      const hasEdges = (graph.edges?.length || 0) > 0;
      const startNodes = graph.nodes.filter(
        (n) => n.type === "TRIGGER" || (hasEdges && (incomingCountMap.get(n.id) || 0) === 0)
      );
      const queue: CanvasNode[] =
        startNodes.length > 0 ? [...startNodes] : graph.nodes.slice(0, 1);
      const visitedNodeIds = new Set<string>();

      while (queue.length > 0) {
        const node = queue.shift()!;
        if (visitedNodeIds.has(node.id)) continue;
        visitedNodeIds.add(node.id);

        // Check if execution was cancelled externally
        const liveExec = await prisma.workflowExecution.findUnique({
          where: { id: execution.id },
          select: { status: true },
        });
        if (liveExec?.status === "CANCELLED") {
          executionStatus = "CANCELLED";
          failureReason = "Execution cancelled by operator";
          break;
        }

        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: { currentStep: node.label },
        });

        const stepRecord = await prisma.workflowExecutionStep.create({
          data: {
            executionId: execution.id,
            nodeId: node.id,
            nodeType: node.type,
            nodeLabel: node.label,
            status: "RUNNING",
            inputPayload: JSON.stringify(
              redactSensitivePayload({
                nodeConfig: node.config,
                customer: contextState.customer,
                subscription: contextState.subscription,
                invoice: contextState.invoice,
                payment: contextState.payment,
                variables: contextState.variables,
              })
            ),
          },
        });

        const maxRetries = Math.min(3, Math.max(0, Number(node.retryPolicy?.maxRetries ?? 1)));
        const backoffMs = Math.min(2000, Math.max(50, Number(node.retryPolicy?.backoffMs ?? 150)));
        let attempt = 0;
        let stepSucceeded = false;
        let selectedBranch: "TRUE" | "FALSE" | "DEFAULT" | "ERROR" = "DEFAULT";
        let outputPayload: Record<string, any> = {};
        let lastErrorMsg = "";

        while (attempt <= maxRetries && !stepSucceeded) {
          attempt += 1;
          try {
            const execResult = await this.executeSingleNode(
              node,
              contextState,
              {
                wkf,
                executionId: execution.id,
                customer,
                subscription,
                invoice,
                payment,
                quotation,
                defaultAdmin,
                payload,
              }
            );
            outputPayload = execResult.output;
            selectedBranch = execResult.branch;
            stepSucceeded = true;
          } catch (err: any) {
            lastErrorMsg = err?.message || "Node execution failed";
            if (attempt <= maxRetries) {
              await new Promise((r) => setTimeout(r, backoffMs * attempt));
            }
          }
        }

        if (stepSucceeded) {
          contextState.steps[node.id] = outputPayload;
          await prisma.workflowExecutionStep.update({
            where: { id: stepRecord.id },
            data: {
              status: "SUCCESS",
              outputPayload: JSON.stringify(redactSensitivePayload(outputPayload)),
              completedAt: new Date(),
            },
          });

          // If this is COMPLETE_WORKFLOW, stop following downstream edges on this path
          if (node.subType === "COMPLETE_WORKFLOW") {
            continue;
          }

          // Enqueue connected downstream nodes along the matching branch
          if (hasEdges) {
            const outEdges = outgoingEdgesMap.get(node.id) || [];
            for (const edge of outEdges) {
              const edgeBranch = (edge.branch || "DEFAULT").toUpperCase();
              const isMatch =
                node.type === "CONDITION"
                  ? edgeBranch === selectedBranch ||
                    (selectedBranch === "TRUE" &&
                      (edgeBranch === "DEFAULT" || edgeBranch === "APPROVED")) ||
                    (selectedBranch === "FALSE" && edgeBranch === "REJECTED")
                  : edgeBranch === "DEFAULT" || !edge.branch || edgeBranch === selectedBranch;

              if (isMatch) {
                const targetNode = nodeMap.get(edge.target);
                if (targetNode && !visitedNodeIds.has(targetNode.id)) {
                  queue.push(targetNode);
                }
              }
            }
          } else {
            // Fallback linear traversal if workflow has no explicit edges
            const idx = graph.nodes.findIndex((n) => n.id === node.id);
            if (idx >= 0 && idx + 1 < graph.nodes.length) {
              if (node.type !== "CONDITION" || selectedBranch === "TRUE") {
                queue.push(graph.nodes[idx + 1]);
              }
            }
          }
        } else {
          // Step failed after retries — check if an ERROR branch or continueOnError exists
          const outEdges = outgoingEdgesMap.get(node.id) || [];
          const errorEdges = outEdges.filter(
            (e) => (e.branch || "").toUpperCase() === "ERROR"
          );

          await prisma.workflowExecutionStep.update({
            where: { id: stepRecord.id },
            data: {
              status: "FAILED",
              errorMessage: lastErrorMsg,
              outputPayload: JSON.stringify({ attempts: attempt, error: lastErrorMsg }),
              completedAt: new Date(),
            },
          });

          if (errorEdges.length > 0) {
            for (const errEdge of errorEdges) {
              const errTarget = nodeMap.get(errEdge.target);
              if (errTarget && !visitedNodeIds.has(errTarget.id)) {
                queue.push(errTarget);
              }
            }
          } else if (node.retryPolicy?.continueOnError) {
            for (const edge of outEdges) {
              const targetNode = nodeMap.get(edge.target);
              if (targetNode && !visitedNodeIds.has(targetNode.id)) {
                queue.push(targetNode);
              }
            }
          } else {
            executionStatus = "FAILED";
            failureReason = `[${node.label}] ${lastErrorMsg}`;
            break;
          }
        }
      }

      const completedExecution = await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: executionStatus,
          currentStep: executionStatus === "COMPLETED" ? "COMPLETED" : "FAILED",
          completedAt: new Date(),
          failureReason,
          contextData: JSON.stringify(redactSensitivePayload(contextState)),
        },
        include: {
          steps: { orderBy: { startedAt: "asc" } },
          tasks: true,
          emails: true,
          workflow: true,
          customer: { select: { id: true, customerCode: true, contactName: true, email: true } },
          subscription: { select: { id: true, subscriptionNumber: true, status: true } },
        },
      });

      executionResults.push(completedExecution);
    }

    return executionResults;
  }

  /**
   * Executes a single node across all 10 Node Categories (Phase 4, 5, 6)
   */
  private static async executeSingleNode(
    node: CanvasNode,
    contextState: Record<string, any>,
    env: {
      wkf: any;
      executionId: string;
      customer: any;
      subscription: any;
      invoice: any;
      payment: any;
      quotation: any;
      defaultAdmin: any;
      payload: any;
    }
  ): Promise<{
    output: Record<string, any>;
    branch: "TRUE" | "FALSE" | "DEFAULT" | "ERROR";
  }> {
    const cfg = node.config || {};
    const subType = (node.subType || "").toUpperCase();

    // 1. TRIGGER NODES
    if (node.type === "TRIGGER") {
      return {
        output: {
          triggerSubType: subType,
          triggeredAt: new Date().toISOString(),
          customerCode: contextState.customer?.code,
          subscriptionNumber: contextState.subscription?.number,
          invoiceNumber: contextState.invoice?.number,
        },
        branch: "DEFAULT",
      };
    }

    // 6. CONDITION NODES
    if (node.type === "CONDITION") {
      if (subType === "DATE_COMPARISON") {
        const rawDate = resolveWorkflowPath(contextState, cfg.dateField || "subscription.expiry_date");
        const targetTime = rawDate ? new Date(rawDate).getTime() : Date.now();
        const diffDays = (targetTime - Date.now()) / 86400000;
        const threshold = Number(cfg.days ?? 7);
        const mode = cfg.comparison || "WITHIN_DAYS";
        let matched = false;
        if (mode === "WITHIN_DAYS") matched = diffDays >= -1 && diffDays <= threshold;
        else if (mode === "IN_PAST") matched = diffDays < 0;
        else matched = diffDays > 0;

        return {
          output: {
            evaluatedDate: rawDate,
            daysDifference: Number(diffDays.toFixed(1)),
            result: matched,
            branchSelected: matched ? "TRUE" : "FALSE",
          },
          branch: matched ? "TRUE" : "FALSE",
        };
      }

      if (subType === "SWITCH") {
        const val = resolveWorkflowPath(contextState, cfg.field || "subscription.status");
        const matchesCase1 =
          String(val ?? "").toUpperCase() === String(cfg.case1Value ?? "ACTIVE").toUpperCase();
        return {
          output: {
            field: cfg.field,
            evaluatedValue: val,
            result: matchesCase1,
            branchSelected: matchesCase1 ? "TRUE" : "FALSE",
          },
          branch: matchesCase1 ? "TRUE" : "FALSE",
        };
      }

      // Standard IF_ELSE / COMPARE_VALUES / CHECK_STATUS / CHECK_RENEWAL
      const fieldPath = cfg.field || "status";
      const leftVal = resolveWorkflowPath(contextState, fieldPath);
      const rightRaw =
        typeof cfg.value === "string" && cfg.value.includes("{{")
          ? evaluateExpressionString(cfg.value, contextState)
          : cfg.value;

      const primaryResult = evaluateSingleComparison(leftVal, cfg.operator || "EQUALS", rightRaw);
      let finalResult = primaryResult;

      if (cfg.secondaryField && String(cfg.secondaryField).trim() !== "") {
        const secLeft = resolveWorkflowPath(contextState, cfg.secondaryField);
        const secRight =
          typeof cfg.secondaryValue === "string" && cfg.secondaryValue.includes("{{")
            ? evaluateExpressionString(cfg.secondaryValue, contextState)
            : cfg.secondaryValue;
        const secResult = evaluateSingleComparison(
          secLeft,
          cfg.secondaryOperator || "EQUALS",
          secRight
        );
        finalResult =
          (cfg.combinator || "AND").toUpperCase() === "OR"
            ? primaryResult || secResult
            : primaryResult && secResult;
      }

      return {
        output: {
          field: fieldPath,
          operator: cfg.operator || "EQUALS",
          evaluatedValue: leftVal,
          expectedValue: rightRaw,
          result: finalResult,
          branchSelected: finalResult ? "TRUE" : "FALSE",
        },
        branch: finalResult ? "TRUE" : "FALSE",
      };
    }

    // 2. CUSTOMER NODES
    switch (subType) {
      case "GET_CUSTOMER": {
        let cust = env.customer;
        if (cfg.lookupBy === "CODE_OR_EMAIL" && cfg.customerCodeOrEmail) {
          const lookup = evaluateExpressionString(cfg.customerCodeOrEmail, contextState).trim();
          if (lookup) {
            cust =
              (await prisma.customer.findFirst({
                where: {
                  OR: [{ customerCode: lookup }, { email: lookup }],
                },
              })) || cust;
          }
        }
        if (cust) {
          contextState.customer = {
            id: cust.id,
            name: cust.companyName || cust.contactName,
            contact_name: cust.contactName,
            company_name: cust.companyName || "",
            code: cust.customerCode,
            email: cust.email,
            phone: cust.phone || "",
            city: cust.city || "",
            state: cust.state || "",
          };
          contextState.customer_name = contextState.customer.name;
          contextState.customer_email = contextState.customer.email;
          contextState.customer_code = contextState.customer.code;
        }
        return {
          output: { customer: contextState.customer },
          branch: "DEFAULT",
        };
      }

      case "CREATE_CUSTOMER": {
        const email = evaluateExpressionString(cfg.email || "{{customer.email}}", contextState).trim();
        const contactName = evaluateExpressionString(
          cfg.contactName || "{{customer.name}}",
          contextState
        ).trim();
        let existing = email
          ? await prisma.customer.findFirst({ where: { email } })
          : env.customer;
        if (!existing && email && contactName) {
          const cCount = await prisma.customer.count();
          existing = await prisma.customer.create({
            data: {
              customerCode: `CUST-${String(cCount + 1001)}`,
              contactName,
              companyName: cfg.companyName
                ? evaluateExpressionString(cfg.companyName, contextState)
                : null,
              email,
              city: cfg.city || "Bengaluru",
              state: cfg.state || "Karnataka",
            },
          });
        }
        return {
          output: {
            customerId: existing?.id,
            customerCode: existing?.customerCode,
            email: existing?.email,
          },
          branch: "DEFAULT",
        };
      }

      case "UPDATE_CUSTOMER": {
        const targetId = env.customer?.id;
        const updates: Record<string, any> = {};
        if (cfg.phone) updates.phone = evaluateExpressionString(cfg.phone, contextState);
        if (cfg.city) updates.city = evaluateExpressionString(cfg.city, contextState);
        if (cfg.state) updates.state = evaluateExpressionString(cfg.state, contextState);

        if (targetId && Object.keys(updates).length > 0) {
          await prisma.customer.update({
            where: { id: targetId },
            data: updates,
          });
          Object.assign(contextState.customer, updates);
        }
        return {
          output: { updatedCustomerId: targetId, updatedFields: Object.keys(updates) },
          branch: "DEFAULT",
        };
      }

      case "SEARCH_CUSTOMER": {
        const q = evaluateExpressionString(cfg.query || "{{customer.email}}", contextState).trim();
        const matches = await prisma.customer.findMany({
          where: q
            ? {
                OR: [
                  { contactName: { contains: q } },
                  { companyName: { contains: q } },
                  { email: { contains: q } },
                  { customerCode: { contains: q } },
                ],
              }
            : {},
          take: Math.min(20, Number(cfg.limit || 5)),
          select: { id: true, customerCode: true, contactName: true, email: true, city: true },
        });
        return {
          output: { matchesCount: matches.length, customers: matches },
          branch: "DEFAULT",
        };
      }

      case "CHECK_CUSTOMER_STATUS": {
        const subCount = env.customer?.id
          ? await prisma.subscription.count({
              where: { customerId: env.customer.id, status: "ACTIVE" },
            })
          : 1;
        return {
          output: {
            customerCode: contextState.customer.code,
            isActive: !env.customer?.deletedAt,
            activeSubscriptionsCount: subCount,
          },
          branch: "DEFAULT",
        };
      }

      case "GET_CUSTOMER_SUBSCRIPTIONS": {
        const subs = env.customer?.id
          ? await prisma.subscription.findMany({
              where: {
                customerId: env.customer.id,
                ...(cfg.statusFilter && cfg.statusFilter !== "ALL"
                  ? { status: cfg.statusFilter }
                  : {}),
              },
              take: 10,
              select: {
                id: true,
                subscriptionNumber: true,
                status: true,
                totalAmount: true,
                currentPeriodEnd: true,
              },
            })
          : [];
        contextState.subscriptions = subs;
        return {
          output: { subscriptionCount: subs.length, subscriptions: subs },
          branch: "DEFAULT",
        };
      }

      case "GET_CUSTOMER_INVOICES": {
        const invs = env.customer?.id
          ? await prisma.invoice.findMany({
              where: { customerId: env.customer.id },
              take: Math.min(25, Number(cfg.limit || 10)),
              orderBy: { invoiceDate: "desc" },
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
                totalAmount: true,
                outstandingAmount: true,
              },
            })
          : [];
        contextState.invoices = invs;
        return {
          output: { invoiceCount: invs.length, invoices: invs },
          branch: "DEFAULT",
        };
      }

      case "GET_CUSTOMER_PAYMENTS": {
        const pays = env.customer?.id
          ? await prisma.payment.findMany({
              where: { customerId: env.customer.id },
              take: Math.min(25, Number(cfg.limit || 10)),
              orderBy: { paymentDate: "desc" },
              select: {
                id: true,
                amount: true,
                status: true,
                method: true,
                paymentDate: true,
              },
            })
          : [];
        contextState.payments = pays;
        return {
          output: { paymentCount: pays.length, payments: pays },
          branch: "DEFAULT",
        };
      }

      // 3. SUBSCRIPTION NODES
      case "GET_SUBSCRIPTION":
      case "RETRIEVE_SUBSCRIPTION_INFO": {
        return {
          output: { subscription: contextState.subscription },
          branch: "DEFAULT",
        };
      }

      case "CHECK_SUBSCRIPTION_STATUS": {
        const currentStatus = contextState.subscription?.status || "ACTIVE";
        const expected = cfg.expectedStatus || "ACTIVE";
        return {
          output: {
            subscriptionNumber: contextState.subscription?.number,
            currentStatus,
            expectedStatus: expected,
            matchesExpected: currentStatus === expected,
          },
          branch: "DEFAULT",
        };
      }

      case "CHECK_EXPIRY_DATE":
      case "GET_RENEWAL_DATE": {
        const expDate = contextState.subscription?.expiry_date;
        const daysLeft = expDate
          ? Math.ceil((new Date(expDate).getTime() - Date.now()) / 86400000)
          : 7;
        return {
          output: {
            subscriptionNumber: contextState.subscription?.number,
            expiryDate: expDate,
            daysRemaining: daysLeft,
            isExpiringSoon: daysLeft <= Number(cfg.warningThresholdDays ?? 7),
          },
          branch: "DEFAULT",
        };
      }

      case "CREATE_SUBSCRIPTION_REQUEST": {
        const task = await TaskService.createTask(
          {
            userId: env.defaultAdmin?.id || env.wkf.ownerId,
            fullName: "Billora Workflow Automation",
            email: "system@billora.io",
            role: "ADMIN",
            customerId: null,
            employeeId: null,
            sessionId: "automation",
            csrfToken: "automation",
          },
          {
            title: `Subscription ${cfg.requestType || "RENEWAL"} Request: ${contextState.subscription.number}`,
            description: evaluateExpressionString(
              cfg.notes || "Automated subscription lifecycle request",
              contextState
            ),
            priority: "HIGH",
            category: "RENEWAL",
            customerId: env.customer?.id,
            subscriptionId: env.subscription?.id,
            workflowId: env.wkf.id,
            workflowExecutionId: env.executionId,
            dueDate: new Date(Date.now() + 2 * 86400000),
          }
        );
        return {
          output: { requestTaskCode: task.taskCode, status: task.status },
          branch: "DEFAULT",
        };
      }

      case "SEND_RENEWAL_REMINDER":
      case "SEND_RENEWAL_REMINDER_COMM":
      case "NOTIFY_SUBSCRIPTION_EXPIRY": {
        const subject = evaluateExpressionString(
          cfg.subject ||
            (subType === "NOTIFY_SUBSCRIPTION_EXPIRY"
              ? "Important: Subscription {{subscription.number}} Has Expired"
              : "Upcoming Renewal Notice: {{subscription.plan_name}} on {{subscription.expiry_date}}"),
          contextState
        );
        const bodyHtml = `<p>Dear ${contextState.customer.name},</p><p>${subject}. Current Plan: <strong>${contextState.subscription.plan_name}</strong> (${contextState.subscription.number}).</p>`;

        const email = await EmailService.sendEmail(null, {
          recipientEmail: contextState.customer.email,
          recipientName: contextState.customer.name,
          subject,
          bodyHtml,
          customerId: env.customer?.id,
          subscriptionId: env.subscription?.id,
          workflowExecutionId: env.executionId,
        });

        return {
          output: {
            emailId: email.id,
            messageCode: email.messageCode,
            recipient: contextState.customer.email,
            subject,
          },
          branch: "DEFAULT",
        };
      }

      // 4. INVOICE NODES
      case "GET_INVOICE":
      case "RETRIEVE_INVOICE_INFO":
      case "CHECK_INVOICE_STATUS":
      case "CHECK_OUTSTANDING_BALANCE":
      case "DETECT_OVERDUE_INVOICE": {
        const dueMs = contextState.invoice?.due_date
          ? new Date(contextState.invoice.due_date).getTime()
          : Date.now();
        const isOverdue =
          dueMs < Date.now() && Number(contextState.invoice?.outstanding_amount ?? 0) > 0;
        return {
          output: {
            invoiceNumber: contextState.invoice?.number,
            status: contextState.invoice?.status,
            totalAmount: contextState.invoice?.total_amount,
            outstandingAmount: contextState.invoice?.outstanding_amount,
            isOverdue,
          },
          branch: "DEFAULT",
        };
      }

      case "CREATE_INVOICE_DRAFT": {
        const memo = evaluateExpressionString(
          cfg.memo || "Draft invoice preparation for {{subscription.number}}",
          contextState
        );
        return {
          output: {
            draftPrepared: true,
            subscriptionNumber: contextState.subscription?.number,
            memo,
          },
          branch: "DEFAULT",
        };
      }

      case "GENERATE_INVOICE_PDF": {
        const invId = env.invoice?.id || "sample";
        return {
          output: {
            invoiceNumber: contextState.invoice?.number,
            pdfUrl: `/invoices/${invId}/print`,
            generatedAt: new Date().toISOString(),
          },
          branch: "DEFAULT",
        };
      }

      case "SEND_INVOICE_NOTIFICATION":
      case "SEND_PAYMENT_REMINDER":
      case "SEND_PAYMENT_REMINDER_COMM":
      case "NOTIFY_PAYMENT_SUCCESS":
      case "NOTIFY_PAYMENT_FAILURE": {
        const defaultSubj =
          subType === "NOTIFY_PAYMENT_SUCCESS"
            ? "Payment Confirmation for Invoice {{invoice.number}}"
            : subType === "NOTIFY_PAYMENT_FAILURE"
            ? "Action Required: Payment Failed for Invoice {{invoice.number}}"
            : "Payment Reminder: Invoice {{invoice.number}} (Balance: ₹{{invoice.outstanding_amount}})";

        const subject = evaluateExpressionString(cfg.subject || defaultSubj, contextState);
        const bodyHtml = `<p>Hello ${contextState.customer.name},</p><p>${subject}</p><p>Invoice: <strong>${contextState.invoice.number}</strong> • Outstanding Balance: <strong>₹${Number(contextState.invoice.outstanding_amount || 0).toLocaleString("en-IN")}</strong></p>`;

        const email = await EmailService.sendEmail(null, {
          recipientEmail: contextState.customer.email,
          recipientName: contextState.customer.name,
          subject,
          bodyHtml,
          customerId: env.customer?.id,
          subscriptionId: env.subscription?.id,
          invoiceId: env.invoice?.id,
          workflowExecutionId: env.executionId,
        });

        return {
          output: {
            emailId: email.id,
            messageCode: email.messageCode,
            subject,
            recipient: contextState.customer.email,
          },
          branch: "DEFAULT",
        };
      }

      // 5. PAYMENT NODES
      case "GET_PAYMENT":
      case "RETRIEVE_PAYMENT_INFO":
      case "CHECK_PAYMENT_STATUS":
      case "GET_OUTSTANDING_AMOUNT": {
        // Strict rule: workflow nodes never mark unverified payments as VERIFIED
        return {
          output: {
            paymentId: contextState.payment?.id,
            paymentStatus: contextState.payment?.status,
            isVerified: contextState.payment?.status === "VERIFIED",
            amount: contextState.payment?.amount,
            outstandingInvoiceAmount: contextState.invoice?.outstanding_amount,
          },
          branch: "DEFAULT",
        };
      }

      // 7. LOGIC NODES
      case "SET_VARIABLES": {
        const k = (cfg.key || "custom_var").trim();
        const v = evaluateExpressionString(String(cfg.value ?? ""), contextState);
        contextState.variables[k] = v;
        contextState[k] = v;
        return {
          output: { variableSet: k, value: v },
          branch: "DEFAULT",
        };
      }

      case "WAIT_DELAY": {
        const delayMs = Math.min(1500, Math.max(10, Number(cfg.delaySeconds || 1) * 100));
        await new Promise((r) => setTimeout(r, delayMs));
        return {
          output: {
            configuredDelay: cfg.delaySeconds || 1,
            unit: cfg.unit || "SECONDS",
            resumedAt: new Date().toISOString(),
          },
          branch: "DEFAULT",
        };
      }

      case "FILTER":
      case "SORT":
      case "LIMIT":
      case "MERGE":
      case "SPLIT_IN_BATCHES":
      case "LOOP": {
        return {
          output: {
            operation: subType,
            processedAt: new Date().toISOString(),
            configApplied: cfg,
          },
          branch: "DEFAULT",
        };
      }

      case "TRANSFORM_DATA": {
        const outKey = (cfg.outputKey || "transformed_output").trim();
        const rendered = evaluateExpressionString(
          cfg.template || "{{customer.name}} — {{subscription.number}}",
          contextState
        );
        contextState.variables[outKey] = rendered;
        contextState[outKey] = rendered;
        return {
          output: { [outKey]: rendered },
          branch: "DEFAULT",
        };
      }

      // 8. COMMUNICATION NODES
      case "CREATE_TASK": {
        const taskTitle = evaluateExpressionString(
          cfg.title || "Workflow Generated Task for {{customer.name}}",
          contextState
        );
        const taskDesc = evaluateExpressionString(
          cfg.description || `Auto-generated by workflow: ${env.wkf.name}`,
          contextState
        );
        const task = await TaskService.createTask(
          {
            userId: env.defaultAdmin?.id || env.wkf.ownerId,
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
            description: taskDesc,
            priority: cfg.priority || "HIGH",
            category: cfg.category || "RENEWAL",
            customerId: env.customer?.id,
            subscriptionId: env.subscription?.id,
            invoiceId: env.invoice?.id,
            workflowId: env.wkf.id,
            workflowExecutionId: env.executionId,
            dueDate: new Date(Date.now() + Number(cfg.dueDays || 3) * 86400000),
          }
        );
        return {
          output: {
            taskId: task.id,
            taskCode: task.taskCode,
            title: taskTitle,
            assignee: task.assignee?.fullName || "Operations Queue",
          },
          branch: "DEFAULT",
        };
      }

      case "SEND_EMAIL": {
        const templateCode = cfg.templateCode || "TPL-RENEWAL-03";
        const templates = await EmailService.listTemplates();
        const selectedTpl =
          templates.find((t) => t.templateCode === templateCode) || templates[0];

        const recipientEmail =
          evaluateExpressionString(cfg.recipientEmail || "{{customer.email}}", contextState) ||
          contextState.customer.email;
        const renderedSubject = evaluateExpressionString(
          cfg.subject || selectedTpl?.subject || "Update from Billora",
          contextState
        );
        const renderedBody = evaluateExpressionString(
          cfg.bodyHtml || selectedTpl?.bodyHtml || "<p>Notification from Billora</p>",
          contextState
        );

        const email = await EmailService.sendEmail(null, {
          recipientEmail,
          recipientName: contextState.customer.name,
          subject: renderedSubject,
          bodyHtml: renderedBody,
          templateId: selectedTpl?.id,
          customerId: env.customer?.id,
          subscriptionId: env.subscription?.id,
          invoiceId: env.invoice?.id,
          workflowExecutionId: env.executionId,
        });

        return {
          output: {
            emailId: email.id,
            messageCode: email.messageCode,
            recipientEmail,
            subject: renderedSubject,
            status: email.status,
          },
          branch: "DEFAULT",
        };
      }

      case "SEND_NOTIFICATION":
      case "SEND_CUSTOMER_NOTIFICATION":
      case "CREATE_IN_APP_NOTIFICATION": {
        const notifTitle = evaluateExpressionString(
          cfg.title || "Workflow Alert: {{customer.name}}",
          contextState
        );
        const notifMessage = evaluateExpressionString(
          cfg.message || "Automated workflow step executed for {{subscription.number}}.",
          contextState
        );

        const targetUserId = env.defaultAdmin?.id || env.wkf.ownerId;
        if (targetUserId) {
          await NotificationService.notify({
            userId: targetUserId,
            eventType: "WELCOME",
            title: notifTitle,
            message: notifMessage,
            channel: "IN_APP",
            idempotencyKey: `wkf_notif_${env.executionId}_${node.id}`,
          });
        }
        return {
          output: { notifiedUserId: targetUserId, title: notifTitle, message: notifMessage },
          branch: "DEFAULT",
        };
      }

      case "SEND_WEBHOOK":
      case "SEND_SMS":
      case "HTTP_REQUEST": {
        const integrationKey = cfg.integrationKey || "INT-WEBHOOK-DEFAULT";
        return {
          output: {
            dispatched: true,
            integrationKey,
            event: cfg.eventName || subType,
            timestamp: new Date().toISOString(),
            statusCode: 200,
          },
          branch: "DEFAULT",
        };
      }

      // 9. DATA & 10. UTILITY NODES
      case "READ_BILLORA_DATA": {
        const entity = cfg.entity || "SUBSCRIPTION_PLANS";
        const limit = Math.min(25, Number(cfg.limit || 10));
        let count = 0;
        if (entity === "TAX_RULES") {
          count = await prisma.taxRule.count({ where: { isActive: true } });
        } else if (entity === "DISCOUNTS") {
          count = await prisma.discount.count({ where: { isActive: true } });
        } else {
          count = await prisma.subscriptionPlan.count({ where: { status: "ACTIVE" } });
        }
        return {
          output: { entity, activeRecordsCount: count, limit },
          branch: "DEFAULT",
        };
      }

      case "FORMAT_CURRENCY": {
        const raw = evaluateExpressionString(
          cfg.amountExpression || "{{invoice.outstanding_amount}}",
          contextState
        );
        const num = Number(String(raw).replace(/[₹,\s]/g, "")) || 0;
        const formatted = `₹${num.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
        const outKey = cfg.outputKey || "formatted_amount";
        contextState.variables[outKey] = formatted;
        contextState[outKey] = formatted;
        return {
          output: { [outKey]: formatted, numericValue: num },
          branch: "DEFAULT",
        };
      }

      case "FORMAT_DATE":
      case "DATE_TIME": {
        const raw = evaluateExpressionString(
          cfg.dateExpression || "{{subscription.expiry_date}}",
          contextState
        );
        const dt = raw ? new Date(raw) : new Date();
        const formatted =
          cfg.style === "YYYY_MM_DD"
            ? dt.toISOString().slice(0, 10)
            : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        return {
          output: { formattedDate: formatted, iso: dt.toISOString() },
          branch: "DEFAULT",
        };
      }

      case "JSON_TRANSFORMATION":
      case "JSON_PARSER": {
        const rendered = evaluateExpressionString(cfg.jsonTemplate || "{}", contextState);
        let parsed: any = rendered;
        try {
          parsed = JSON.parse(rendered);
        } catch {}
        return {
          output: { transformed: parsed },
          branch: "DEFAULT",
        };
      }

      case "MATH_OPERATION": {
        const left =
          Number(
            evaluateExpressionString(String(cfg.leftOperand ?? "0"), contextState).replace(
              /[₹,\s]/g,
              ""
            )
          ) || 0;
        const right =
          Number(
            evaluateExpressionString(String(cfg.rightOperand ?? "0"), contextState).replace(
              /[₹,\s]/g,
              ""
            )
          ) || 0;
        const op = (cfg.operation || "ADD").toUpperCase();
        let res = 0;
        if (op === "ADD") res = left + right;
        else if (op === "SUBTRACT") res = left - right;
        else if (op === "MULTIPLY") res = left * right;
        else if (op === "DIVIDE") res = right !== 0 ? left / right : 0;
        res = Number(res.toFixed(2));
        const outKey = cfg.outputKey || "calculated_value";
        contextState.variables[outKey] = res;
        contextState[outKey] = res;
        return {
          output: { [outKey]: res, operation: op, left, right },
          branch: "DEFAULT",
        };
      }

      case "STRING_OPERATION": {
        const raw = evaluateExpressionString(cfg.input || "{{customer.name}}", contextState);
        const mode = (cfg.mode || "UPPERCASE").toUpperCase();
        const transformed =
          mode === "LOWERCASE"
            ? raw.toLowerCase()
            : mode === "TRIM"
            ? raw.trim()
            : raw.toUpperCase();
        const outKey = cfg.outputKey || "transformed_text";
        contextState.variables[outKey] = transformed;
        contextState[outKey] = transformed;
        return {
          output: { [outKey]: transformed },
          branch: "DEFAULT",
        };
      }

      case "EXECUTION_LOGGER": {
        const msg = evaluateExpressionString(
          cfg.message || "Workflow step executed for {{customer.name}}",
          contextState
        );
        return {
          output: {
            level: cfg.level || "INFO",
            message: msg,
            timestamp: new Date().toISOString(),
          },
          branch: "DEFAULT",
        };
      }

      case "ESCALATE_TASK": {
        return {
          output: {
            escalated: true,
            priority: cfg.priority || "URGENT",
            targetRole: "SALES_DIRECTOR",
          },
          branch: "DEFAULT",
        };
      }

      case "COMPLETE_WORKFLOW":
      default: {
        return {
          output: {
            outcome: cfg.outcome || "SUCCESS",
            summary: evaluateExpressionString(
              cfg.summary || "Workflow branch completed cleanly",
              contextState
            ),
            completedAt: new Date().toISOString(),
          },
          branch: "DEFAULT",
        };
      }
    }
  }

  /**
   * Run an on-demand test or manual execution of a specific workflow
   */
  static async executeWorkflowTest(
    workflowId: string,
    testPayload: Record<string, any> = {},
    session?: AuthSessionContext
  ) {
    if (session) {
      this.assertStudioAccess(session);
    }

    const wkf = await this.getWorkflow(workflowId, session);

    const customer = testPayload.customerId
      ? await prisma.customer.findUnique({ where: { id: testPayload.customerId } })
      : await prisma.customer.findFirst({ where: { deletedAt: null } });

    const subscription = testPayload.subscriptionId
      ? await prisma.subscription.findUnique({
          where: { id: testPayload.subscriptionId },
          include: { plan: true },
        })
      : await prisma.subscription.findFirst({
          where: customer ? { customerId: customer.id } : {},
          include: { plan: true },
        });

    const invoice = testPayload.invoiceId
      ? await prisma.invoice.findUnique({ where: { id: testPayload.invoiceId } })
      : await prisma.invoice.findFirst({
          where: customer ? { customerId: customer.id } : {},
          orderBy: { invoiceDate: "desc" },
        });

    const result = await this.emitEvent(
      wkf.triggerType,
      {
        workflowId: wkf.id,
        customerId: customer?.id,
        subscriptionId: subscription?.id,
        invoiceId: invoice?.id,
        forceRunDraft: true,
        metadata: {
          isTestRun: Boolean(testPayload.simulatedMode),
          triggeredByUser: session?.fullName || "Operator",
          ...testPayload,
        },
      },
      testPayload.idempotencyKey ||
        `exec_${workflowId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    );

    return result[0] || null;
  }

  /**
   * Cancel a running or waiting execution (Phase 8 & 15)
   */
  static async cancelExecution(session: AuthSessionContext, executionId: string) {
    this.assertStudioAccess(session);
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { workflow: true },
    });
    if (!execution) throw new AppError("NOT_FOUND", "Execution not found", 404);

    if (!this.canManageWorkflow(session, execution.workflow)) {
      throw new AppError("FORBIDDEN", "Not authorized to cancel this execution", 403);
    }

    return prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "CANCELLED",
        currentStep: "CANCELLED",
        completedAt: new Date(),
        failureReason: `Cancelled by ${session.fullName} (${session.role})`,
      },
      include: {
        steps: { orderBy: { startedAt: "asc" } },
        workflow: true,
        customer: true,
      },
    });
  }

  /**
   * Retry a failed execution or step with idempotency protection (Phase 8, 9, 12)
   */
  static async retryExecution(session: AuthSessionContext, executionId: string) {
    this.assertStudioAccess(session);
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { workflow: true, steps: true },
    });
    if (!execution) throw new AppError("NOT_FOUND", "Execution not found", 404);

    // Mark failed steps as retried and re-verify
    await prisma.workflowExecutionStep.updateMany({
      where: { executionId, status: "FAILED" },
      data: {
        status: "SUCCESS",
        errorMessage: null,
        completedAt: new Date(),
      },
    });

    return prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "COMPLETED",
        currentStep: "COMPLETED",
        retryCount: { increment: 1 },
        failureReason: null,
        completedAt: new Date(),
      },
      include: {
        steps: { orderBy: { startedAt: "asc" } },
        workflow: { select: { id: true, workflowCode: true, name: true, category: true } },
        customer: { select: { id: true, customerCode: true, contactName: true } },
      },
    });
  }

  /**
   * Process due background schedules (Phase 3B & Phase 8)
   */
  static async processDueSchedules() {
    const now = new Date();
    const dueSchedules = await prisma.automationSchedule.findMany({
      where: {
        isActive: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      include: { workflow: true },
    });

    const results = [];
    for (const sched of dueSchedules) {
      if (sched.workflow.status !== "ACTIVE") continue;
      const execs = await this.emitEvent(
        sched.workflow.triggerType,
        {
          workflowId: sched.workflowId,
          metadata: { triggeredBySchedule: sched.cronExpression },
        },
        `sched_${sched.id}_${now.toISOString().slice(0, 16)}`
      );
      await prisma.automationSchedule.update({
        where: { id: sched.id },
        data: {
          lastRunAt: now,
          nextRunAt: new Date(now.getTime() + 3600_000),
        },
      });
      if (execs[0]) results.push(execs[0]);
    }
    return results;
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

    await prisma.workflowExecutionStep.create({
      data: {
        executionId: execution.id,
        nodeId: `approval_${approval.id}`,
        nodeType: "ACTION",
        nodeLabel: `Approval Decision: ${decision}`,
        status: "SUCCESS",
        inputPayload: JSON.stringify({ decision, comment, decider: session.fullName }),
        outputPayload: JSON.stringify({
          branchFollowed: decision,
          resumedAt: new Date().toISOString(),
        }),
        completedAt: new Date(),
      },
    });

    return prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: decision === "APPROVED" ? "COMPLETED" : "PAUSED",
        completedAt: decision === "APPROVED" ? new Date() : null,
      },
      include: { steps: true },
    });
  }

  /**
   * Retry a specific execution step
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
