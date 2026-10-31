/**
 * BILLORA WORKFLOW STUDIO — COMPREHENSIVE NODE LIBRARY & EXPRESSION CATALOG
 * Shared metadata between the Visual Canvas Builder and the Backend Execution Engine.
 */

export type NodeMainType = "TRIGGER" | "CONDITION" | "ACTION";

export type NodeCategoryKey =
  | "TRIGGERS"
  | "CUSTOMER"
  | "SUBSCRIPTION"
  | "INVOICE"
  | "PAYMENT"
  | "CONDITIONS"
  | "LOGIC"
  | "COMMUNICATION"
  | "DATA"
  | "UTILITY";

export interface NodePortDefinition {
  id: string;
  label: string;
  branch?: "TRUE" | "FALSE" | "DEFAULT" | "ERROR" | "APPROVED" | "REJECTED" | "CASE_1" | "CASE_2";
  color?: string;
}

export interface NodeFieldSchema {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "boolean" | "json" | "expression";
  placeholder?: string;
  options?: { label: string; value: string }[];
  defaultValue?: any;
  required?: boolean;
  hint?: string;
}

export interface NodeCatalogEntry {
  subType: string;
  type: NodeMainType;
  category: NodeCategoryKey;
  label: string;
  description: string;
  iconName: string;
  colorClass: string;
  badgeClass: string;
  defaultConfig: Record<string, any>;
  fields: NodeFieldSchema[];
  outputs: NodePortDefinition[];
  sampleOutput: Record<string, any>;
  adminOnly?: boolean;
}

export const WORKFLOW_EXPRESSION_VARIABLES = [
  { token: "{{customer.name}}", description: "Customer contact or company name" },
  { token: "{{customer.email}}", description: "Customer primary email address" },
  { token: "{{customer.code}}", description: "Unique customer code (e.g. CUST-1001)" },
  { token: "{{customer.phone}}", description: "Customer phone number" },
  { token: "{{customer.city}}", description: "Customer billing city" },
  { token: "{{customer.state}}", description: "Customer GST state" },
  { token: "{{subscription.number}}", description: "Subscription number (e.g. SUB-2026-0001)" },
  { token: "{{subscription.status}}", description: "Subscription lifecycle status" },
  { token: "{{subscription.expiry_date}}", description: "Subscription current period end / renewal date" },
  { token: "{{subscription.plan_name}}", description: "Active subscription plan name" },
  { token: "{{subscription.amount}}", description: "Subscription recurring total in INR" },
  { token: "{{invoice.number}}", description: "Invoice number (e.g. INV-2026-0001)" },
  { token: "{{invoice.status}}", description: "Invoice status (CONFIRMED, PAID, OVERDUE)" },
  { token: "{{invoice.total_amount}}", description: "Invoice total amount (INR)" },
  { token: "{{invoice.outstanding_amount}}", description: "Invoice unpaid balance (INR)" },
  { token: "{{invoice.due_date}}", description: "Invoice payment due date" },
  { token: "{{payment.amount}}", description: "Payment transaction amount (INR)" },
  { token: "{{payment.status}}", description: "Payment verification status (VERIFIED, FAILED)" },
  { token: "{{payment.reference}}", description: "Payment gateway transaction reference" },
  { token: "{{employee.name}}", description: "Assigned account executive name" },
];

export const NODE_CATEGORY_META: {
  key: NodeCategoryKey;
  label: string;
  description: string;
}[] = [
  { key: "TRIGGERS", label: "1. Trigger Nodes", description: "Events, schedules & webhooks that start a workflow" },
  { key: "CUSTOMER", label: "2. Customer Nodes", description: "Retrieve, search, create & update customer records" },
  { key: "SUBSCRIPTION", label: "3. Subscription Nodes", description: "Inspect subscriptions, expiry dates & renewal reminders" },
  { key: "INVOICE", label: "4. Invoice Nodes", description: "Check balances, detect overdue invoices & generate PDFs" },
  { key: "PAYMENT", label: "5. Payment Nodes", description: "Verify payment status, balances & dunning reminders" },
  { key: "CONDITIONS", label: "6. Condition Nodes", description: "IF/ELSE, Switch & multi-rule branching evaluations" },
  { key: "LOGIC", label: "7. Logic Nodes", description: "Merge, filter, sort, limit, loop, delay & variables" },
  { key: "COMMUNICATION", label: "8. Communication Nodes", description: "Email, in-app alerts, webhooks, SMS & employee tasks" },
  { key: "DATA", label: "9. Data Nodes", description: "Read/update permitted Billora data & format values" },
  { key: "UTILITY", label: "10. Utility Nodes", description: "Date/time, math, string, JSON, HTTP & error handling" },
];

export const WORKFLOW_NODE_CATALOG: NodeCatalogEntry[] = [
  /* ======================================================================== */
  /* 1. TRIGGER NODES                                                         */
  /* ======================================================================== */
  {
    subType: "MANUAL_TRIGGER",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Manual Trigger",
    description: "Run workflow on-demand by an Administrator or Employee.",
    iconName: "Play",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { allowEmployeeExecution: true, defaultNote: "Manual execution" },
    fields: [
      { key: "defaultNote", label: "Execution Note", type: "text", defaultValue: "Manual run from Studio" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { triggeredBy: "MANUAL", timestamp: "2026-10-31T10:00:00Z" },
  },
  {
    subType: "SCHEDULE_TRIGGER",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Schedule Trigger",
    description: "Run automatically on an interval, cron schedule, or specific date/timezone.",
    iconName: "Clock",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: {
      frequency: "DAILY",
      cronExpression: "0 9 * * *",
      timezone: "Asia/Kolkata",
      specificDate: "",
    },
    fields: [
      {
        key: "frequency",
        label: "Schedule Interval",
        type: "select",
        options: [
          { label: "Every Minute", value: "EVERY_MINUTE" },
          { label: "Hourly", value: "HOURLY" },
          { label: "Daily (09:00 IST)", value: "DAILY" },
          { label: "Weekly (Monday 09:00 IST)", value: "WEEKLY" },
          { label: "Monthly (1st of Month)", value: "MONTHLY" },
          { label: "Custom Cron Expression", value: "CUSTOM" },
          { label: "Specific Date / One-Time", value: "SPECIFIC_DATE" },
        ],
      },
      { key: "cronExpression", label: "Cron Expression", type: "text", placeholder: "0 9 * * *" },
      {
        key: "timezone",
        label: "Timezone",
        type: "select",
        options: [
          { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
          { label: "UTC", value: "UTC" },
          { label: "America/New_York (EST)", value: "America/New_York" },
          { label: "Europe/London (GMT)", value: "Europe/London" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { schedule: "DAILY", cron: "0 9 * * *", timezone: "Asia/Kolkata" },
  },
  {
    subType: "WEBHOOK_TRIGGER",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Webhook Trigger",
    description: "Start workflow when an external HTTP POST webhook event is received.",
    iconName: "Webhook",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { webhookPath: "/api/workflows/webhook/incoming", requireSignature: true },
    fields: [
      { key: "webhookPath", label: "Webhook Endpoint Path", type: "text" },
      { key: "requireSignature", label: "Verify HMAC Signature", type: "boolean" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { webhookEvent: "external.event", verified: true },
  },
  {
    subType: "CUSTOMER_CREATED",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Customer Created",
    description: "Triggers automatically when a new customer registers or is provisioned.",
    iconName: "UserPlus",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { sourceFilter: "ALL" },
    fields: [
      {
        key: "sourceFilter",
        label: "Registration Source",
        type: "select",
        options: [
          { label: "All Sources (Web & Admin)", value: "ALL" },
          { label: "Self-Service Portal Registration", value: "PORTAL" },
          { label: "Admin / Employee Created", value: "INTERNAL" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "CUSTOMER_CREATED", customer: { name: "Acme Corp", email: "billing@acmecorp.in" } },
  },
  {
    subType: "SUBSCRIPTION_CREATED",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Subscription Created",
    description: "Triggers when a new subscription contract is created or activated.",
    iconName: "Repeat",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { billingFrequency: "ALL" },
    fields: [
      {
        key: "billingFrequency",
        label: "Billing Frequency Filter",
        type: "select",
        options: [
          { label: "All Frequencies", value: "ALL" },
          { label: "Monthly", value: "MONTHLY" },
          { label: "Yearly", value: "YEARLY" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "SUBSCRIPTION_CREATED", subscription: { number: "SUB-2026-0001", status: "ACTIVE" } },
  },
  {
    subType: "SUBSCRIPTION_RENEWAL",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Subscription Expiring",
    description: "Triggers when an active subscription is approaching its renewal/expiry date.",
    iconName: "CalendarClock",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { daysBeforeRenewal: 7, preventDuplicateReminders: true },
    fields: [
      {
        key: "daysBeforeRenewal",
        label: "Days Before Expiry",
        type: "select",
        options: [
          { label: "7 Days Before Expiry", value: "7" },
          { label: "3 Days Before Expiry", value: "3" },
          { label: "1 Day Before Expiry", value: "1" },
          { label: "14 Days Before Expiry", value: "14" },
        ],
      },
      { key: "preventDuplicateReminders", label: "Prevent Duplicate Reminders", type: "boolean", defaultValue: true },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "SUBSCRIPTION_RENEWAL", daysRemaining: 7 },
  },
  {
    subType: "SUBSCRIPTION_EXPIRED",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Subscription Expired",
    description: "Triggers when a subscription passes its end date or transitions to EXPIRED.",
    iconName: "AlertTriangle",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { gracePeriodDays: 0 },
    fields: [{ key: "gracePeriodDays", label: "Grace Period (Days)", type: "number", defaultValue: 0 }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "SUBSCRIPTION_EXPIRED", status: "EXPIRED" },
  },
  {
    subType: "INVOICE_GENERATED",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Invoice Generated",
    description: "Triggers when the recurring billing engine or an operator generates an invoice.",
    iconName: "Receipt",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { minAmount: 0 },
    fields: [{ key: "minAmount", label: "Minimum Invoice Amount (INR)", type: "number", defaultValue: 0 }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "INVOICE_GENERATED", invoice: { number: "INV-2026-0101", total_amount: 14999 } },
  },
  {
    subType: "INVOICE_OVERDUE",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Invoice Overdue",
    description: "Triggers when a confirmed invoice passes its due date with an unpaid balance.",
    iconName: "AlertCircle",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { daysOverdue: 1, minOutstanding: 1 },
    fields: [
      { key: "daysOverdue", label: "Days Past Due Date", type: "number", defaultValue: 1 },
      { key: "minOutstanding", label: "Minimum Outstanding (INR)", type: "number", defaultValue: 1 },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "INVOICE_OVERDUE", invoice: { outstanding_amount: 18500, status: "OVERDUE" } },
  },
  {
    subType: "PAYMENT_SUCCESS",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Payment Received",
    description: "Triggers when a verified customer payment is recorded against an invoice.",
    iconName: "CheckCircle2",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { requireVerified: true },
    fields: [{ key: "requireVerified", label: "Require VERIFIED Status", type: "boolean", defaultValue: true }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "PAYMENT_SUCCESS", payment: { status: "VERIFIED", amount: 18500 } },
  },
  {
    subType: "PAYMENT_FAILED",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Payment Failed",
    description: "Triggers immediately when a payment attempt fails or is declined.",
    iconName: "XCircle",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: { autoDunning: true },
    fields: [{ key: "autoDunning", label: "Enable Auto-Dunning Context", type: "boolean", defaultValue: true }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "PAYMENT_FAILED", payment: { status: "FAILED", failureReason: "Insufficient funds" } },
  },
  {
    subType: "QUOTATION_CONFIRMED",
    type: "TRIGGER",
    category: "TRIGGERS",
    label: "Quotation Confirmed",
    description: "Triggers when a commercial quotation is accepted and confirmed.",
    iconName: "FileCheck",
    colorClass: "border-l-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { event: "QUOTATION_CONFIRMED", quotation: { number: "QTN-2026-0042" } },
  },

  /* ======================================================================== */
  /* 2. CUSTOMER NODES                                                        */
  /* ======================================================================== */
  {
    subType: "GET_CUSTOMER",
    type: "ACTION",
    category: "CUSTOMER",
    label: "Get Customer",
    description: "Retrieve complete customer profile, GSTIN, address, and assigned employee.",
    iconName: "User",
    colorClass: "border-l-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    defaultConfig: { lookupBy: "CONTEXT_ID", customerCodeOrEmail: "{{customer.code}}" },
    fields: [
      {
        key: "lookupBy",
        label: "Lookup Strategy",
        type: "select",
        options: [
          { label: "Current Trigger Customer", value: "CONTEXT_ID" },
          { label: "By Customer Code / Email", value: "CODE_OR_EMAIL" },
        ],
      },
      { key: "customerCodeOrEmail", label: "Customer Code or Email", type: "expression", placeholder: "{{customer.email}}" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { customer: { id: "cust_1", code: "CUST-1001", name: "TechNova India Pvt Ltd", email: "finance@technova.in" } },
  },
  {
    subType: "CREATE_CUSTOMER",
    type: "ACTION",
    category: "CUSTOMER",
    label: "Create Customer",
    description: "Create a new customer record in Billora if not already registered.",
    iconName: "UserPlus",
    colorClass: "border-l-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    defaultConfig: {
      contactName: "{{customer.name}}",
      companyName: "",
      email: "{{customer.email}}",
      city: "Bengaluru",
      state: "Karnataka",
    },
    fields: [
      { key: "contactName", label: "Contact Name", type: "expression", required: true },
      { key: "companyName", label: "Company Name", type: "expression" },
      { key: "email", label: "Email Address", type: "expression", required: true },
      { key: "city", label: "City", type: "text" },
      { key: "state", label: "State", type: "text" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { createdCustomer: { customerCode: "CUST-1502", status: "ACTIVE" } },
  },
  {
    subType: "UPDATE_CUSTOMER",
    type: "ACTION",
    category: "CUSTOMER",
    label: "Update Customer",
    description: "Update permitted customer profile fields (city, state, phone, notes).",
    iconName: "UserCog",
    colorClass: "border-l-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    defaultConfig: { city: "", state: "", phone: "" },
    fields: [
      { key: "phone", label: "Phone Number", type: "expression" },
      { key: "city", label: "City", type: "expression" },
      { key: "state", label: "State", type: "expression" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { updated: true, fieldsUpdated: ["phone", "city"] },
  },
  {
    subType: "SEARCH_CUSTOMER",
    type: "ACTION",
    category: "CUSTOMER",
    label: "Search Customer",
    description: "Search customers by company name, email domain, city, or GST state.",
    iconName: "Search",
    colorClass: "border-l-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    defaultConfig: { query: "{{customer.email}}", limit: 5 },
    fields: [
      { key: "query", label: "Search Query", type: "expression" },
      { key: "limit", label: "Max Results", type: "number", defaultValue: 5 },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { matchesCount: 1, customers: [{ customerCode: "CUST-1001" }] },
  },
  {
    subType: "CHECK_CUSTOMER_STATUS",
    type: "ACTION",
    category: "CUSTOMER",
    label: "Check Customer Status",
    description: "Evaluate whether customer account is active, has active contracts, or is deleted.",
    iconName: "ShieldCheck",
    colorClass: "border-l-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { isActiveCustomer: true, activeSubscriptionsCount: 2 },
  },
  {
    subType: "GET_CUSTOMER_SUBSCRIPTIONS",
    type: "ACTION",
    category: "CUSTOMER",
    label: "Get Customer Subscriptions",
    description: "Load all subscriptions belonging to the current customer.",
    iconName: "Layers",
    colorClass: "border-l-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    defaultConfig: { statusFilter: "ALL" },
    fields: [
      {
        key: "statusFilter",
        label: "Subscription Status",
        type: "select",
        options: [
          { label: "All Statuses", value: "ALL" },
          { label: "ACTIVE Only", value: "ACTIVE" },
          { label: "PAUSED / EXPIRED", value: "PAUSED" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { subscriptionCount: 2, totalRecurringInr: 24999 },
  },
  {
    subType: "GET_CUSTOMER_INVOICES",
    type: "ACTION",
    category: "CUSTOMER",
    label: "Get Customer Invoices",
    description: "Retrieve customer's recent invoices and unpaid balances.",
    iconName: "Receipt",
    colorClass: "border-l-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    defaultConfig: { limit: 10 },
    fields: [{ key: "limit", label: "Max Invoices", type: "number", defaultValue: 10 }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { invoiceCount: 4, totalOutstandingInr: 18500 },
  },
  {
    subType: "GET_CUSTOMER_PAYMENTS",
    type: "ACTION",
    category: "CUSTOMER",
    label: "Get Customer Payment History",
    description: "Retrieve verified and failed payment ledger entries for the customer.",
    iconName: "CreditCard",
    colorClass: "border-l-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    defaultConfig: { limit: 10 },
    fields: [{ key: "limit", label: "Max Payments", type: "number", defaultValue: 10 }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { paymentCount: 5, totalVerifiedPaidInr: 74000 },
  },

  /* ======================================================================== */
  /* 3. SUBSCRIPTION NODES                                                    */
  /* ======================================================================== */
  {
    subType: "GET_SUBSCRIPTION",
    type: "ACTION",
    category: "SUBSCRIPTION",
    label: "Get Subscription",
    description: "Retrieve subscription contract, plan details, line items, and billing dates.",
    iconName: "Repeat",
    colorClass: "border-l-violet-500",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    defaultConfig: { subscriptionNumber: "{{subscription.number}}" },
    fields: [{ key: "subscriptionNumber", label: "Subscription Number", type: "expression" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { subscription: { number: "SUB-2026-0001", status: "ACTIVE", amount: 14999 } },
  },
  {
    subType: "CHECK_SUBSCRIPTION_STATUS",
    type: "ACTION",
    category: "SUBSCRIPTION",
    label: "Check Subscription Status",
    description: "Inspect current subscription lifecycle state (ACTIVE, PAUSED, CANCELLED, EXPIRED).",
    iconName: "Activity",
    colorClass: "border-l-violet-500",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    defaultConfig: { expectedStatus: "ACTIVE" },
    fields: [
      {
        key: "expectedStatus",
        label: "Expected Status",
        type: "select",
        options: [
          { label: "ACTIVE", value: "ACTIVE" },
          { label: "PAUSED", value: "PAUSED" },
          { label: "CANCELLED", value: "CANCELLED" },
          { label: "EXPIRED", value: "EXPIRED" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { status: "ACTIVE", matchesExpected: true },
  },
  {
    subType: "CHECK_EXPIRY_DATE",
    type: "ACTION",
    category: "SUBSCRIPTION",
    label: "Check Expiry Date",
    description: "Calculate exact days remaining until subscription period end / expiry.",
    iconName: "Calendar",
    colorClass: "border-l-violet-500",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    defaultConfig: { warningThresholdDays: 7 },
    fields: [{ key: "warningThresholdDays", label: "Warning Threshold (Days)", type: "number", defaultValue: 7 }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { expiryDate: "2026-11-07", daysUntilExpiry: 7, isExpiringSoon: true },
  },
  {
    subType: "GET_RENEWAL_DATE",
    type: "ACTION",
    category: "SUBSCRIPTION",
    label: "Get Renewal Date",
    description: "Resolve next billing date and anchor day for the subscription.",
    iconName: "CalendarClock",
    colorClass: "border-l-violet-500",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { nextBillingDate: "2026-11-07", billingFrequency: "MONTHLY" },
  },
  {
    subType: "CREATE_SUBSCRIPTION_REQUEST",
    type: "ACTION",
    category: "SUBSCRIPTION",
    label: "Create Subscription Request",
    description: "Create a compliant renewal or upgrade task/request without bypassing lifecycle rules.",
    iconName: "FilePlus",
    colorClass: "border-l-violet-500",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    defaultConfig: { requestType: "RENEWAL", notes: "Automated renewal request for {{subscription.number}}" },
    fields: [
      {
        key: "requestType",
        label: "Request Type",
        type: "select",
        options: [
          { label: "Renewal Request", value: "RENEWAL" },
          { label: "Plan Upgrade Review", value: "UPGRADE" },
        ],
      },
      { key: "notes", label: "Request Notes", type: "expression" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { requestCreated: true, taskCode: "TSK-2026-205" },
  },
  {
    subType: "SEND_RENEWAL_REMINDER",
    type: "ACTION",
    category: "SUBSCRIPTION",
    label: "Send Renewal Reminder",
    description: "Send idempotent subscription renewal reminder email to customer.",
    iconName: "Bell",
    colorClass: "border-l-violet-500",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    defaultConfig: {
      reminderWindow: "7_DAYS",
      subject: "Upcoming Renewal Notice: {{subscription.plan_name}} ({{subscription.number}})",
    },
    fields: [
      {
        key: "reminderWindow",
        label: "Reminder Schedule Window",
        type: "select",
        options: [
          { label: "7 Days Before Expiry", value: "7_DAYS" },
          { label: "3 Days Before Expiry", value: "3_DAYS" },
          { label: "1 Day Before Expiry", value: "1_DAY" },
        ],
      },
      { key: "subject", label: "Email Subject", type: "expression" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { reminderSent: true, window: "7_DAYS", deduplicated: false },
  },
  {
    subType: "NOTIFY_SUBSCRIPTION_EXPIRY",
    type: "ACTION",
    category: "SUBSCRIPTION",
    label: "Notify Subscription Expiry",
    description: "Send formal expiration notice to customer and alert assigned account executive.",
    iconName: "AlertTriangle",
    colorClass: "border-l-violet-500",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    defaultConfig: { subject: "Important: Subscription {{subscription.number}} Has Expired" },
    fields: [{ key: "subject", label: "Expiry Notice Subject", type: "expression" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { expiryNoticeDispatched: true },
  },

  /* ======================================================================== */
  /* 4. INVOICE NODES                                                         */
  /* ======================================================================== */
  {
    subType: "GET_INVOICE",
    type: "ACTION",
    category: "INVOICE",
    label: "Get Invoice",
    description: "Retrieve invoice header, GST breakdown, paid amount, and outstanding balance.",
    iconName: "Receipt",
    colorClass: "border-l-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    defaultConfig: { invoiceNumber: "{{invoice.number}}" },
    fields: [{ key: "invoiceNumber", label: "Invoice Number", type: "expression" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { invoice: { number: "INV-2026-0101", status: "CONFIRMED", outstanding_amount: 18500 } },
  },
  {
    subType: "CREATE_INVOICE_DRAFT",
    type: "ACTION",
    category: "INVOICE",
    label: "Create Invoice Draft",
    description: "Log an idempotent draft billing follow-up or proforma task for the subscription.",
    iconName: "FileSpreadsheet",
    colorClass: "border-l-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    defaultConfig: { memo: "Automated draft billing review for {{subscription.number}}" },
    fields: [{ key: "memo", label: "Draft Invoice Memo", type: "expression" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { draftPrepared: true, subscriptionNumber: "SUB-2026-0001" },
  },
  {
    subType: "CHECK_INVOICE_STATUS",
    type: "ACTION",
    category: "INVOICE",
    label: "Check Invoice Status",
    description: "Verify whether the invoice is DRAFT, CONFIRMED, PAID, or CANCELLED.",
    iconName: "CheckSquare",
    colorClass: "border-l-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { status: "CONFIRMED", isPaid: false },
  },
  {
    subType: "CHECK_OUTSTANDING_BALANCE",
    type: "ACTION",
    category: "INVOICE",
    label: "Check Outstanding Balance",
    description: "Inspect unpaid balance on the invoice and expose `invoice.outstanding_amount`.",
    iconName: "DollarSign",
    colorClass: "border-l-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { outstandingAmount: 18500, hasUnpaidBalance: true },
  },
  {
    subType: "DETECT_OVERDUE_INVOICE",
    type: "ACTION",
    category: "INVOICE",
    label: "Detect Overdue Invoice",
    description: "Check if invoice due date has passed with `outstandingAmount > 0`.",
    iconName: "AlertCircle",
    colorClass: "border-l-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { isOverdue: true, daysPastDue: 5, outstandingAmount: 18500 },
  },
  {
    subType: "SEND_INVOICE_NOTIFICATION",
    type: "ACTION",
    category: "INVOICE",
    label: "Send Invoice Notification",
    description: "Dispatch GST invoice summary email and portal link to customer.",
    iconName: "Mail",
    colorClass: "border-l-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    defaultConfig: { subject: "Tax Invoice {{invoice.number}} from Billora" },
    fields: [{ key: "subject", label: "Email Subject", type: "expression" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { invoiceNotificationSent: true },
  },
  {
    subType: "GENERATE_INVOICE_PDF",
    type: "ACTION",
    category: "INVOICE",
    label: "Generate Invoice PDF",
    description: "Generate printable GST tax invoice document URL for the customer.",
    iconName: "FileText",
    colorClass: "border-l-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { pdfUrl: "/invoices/inv_1/print", generated: true },
  },

  /* ======================================================================== */
  /* 5. PAYMENT NODES                                                         */
  /* ======================================================================== */
  {
    subType: "GET_PAYMENT",
    type: "ACTION",
    category: "PAYMENT",
    label: "Get Payment",
    description: "Retrieve latest payment transaction record, gateway reference, and status.",
    iconName: "CreditCard",
    colorClass: "border-l-teal-500",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { payment: { status: "VERIFIED", amount: 18500, method: "UPI" } },
  },
  {
    subType: "CHECK_PAYMENT_STATUS",
    type: "ACTION",
    category: "PAYMENT",
    label: "Check Payment Status",
    description: "Verify payment cryptographic/ledger status (never marks unverified payments as paid).",
    iconName: "ShieldCheck",
    colorClass: "border-l-teal-500",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { paymentStatus: "VERIFIED", isVerified: true },
  },
  {
    subType: "GET_OUTSTANDING_AMOUNT",
    type: "ACTION",
    category: "PAYMENT",
    label: "Get Outstanding Amount",
    description: "Calculate remaining unpaid invoice balance after verified payments.",
    iconName: "Calculator",
    colorClass: "border-l-teal-500",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    defaultConfig: {},
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { outstandingAmount: 0, currency: "INR" },
  },
  {
    subType: "SEND_PAYMENT_REMINDER",
    type: "ACTION",
    category: "PAYMENT",
    label: "Send Payment Reminder",
    description: "Send overdue or upcoming payment reminder email to customer.",
    iconName: "Mail",
    colorClass: "border-l-teal-500",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    defaultConfig: {
      subject: "Payment Reminder: Invoice {{invoice.number}} (Balance: ₹{{invoice.outstanding_amount}})",
    },
    fields: [{ key: "subject", label: "Reminder Subject", type: "expression" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { paymentReminderSent: true },
  },
  {
    subType: "NOTIFY_PAYMENT_SUCCESS",
    type: "ACTION",
    category: "PAYMENT",
    label: "Notify Payment Success",
    description: "Send official payment receipt confirmation for a VERIFIED payment.",
    iconName: "CheckCircle2",
    colorClass: "border-l-teal-500",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    defaultConfig: {
      subject: "Payment Received for Invoice {{invoice.number}} — Thank You!",
    },
    fields: [{ key: "subject", label: "Receipt Email Subject", type: "expression" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { receiptDispatched: true },
  },
  {
    subType: "NOTIFY_PAYMENT_FAILURE",
    type: "ACTION",
    category: "PAYMENT",
    label: "Notify Payment Failure",
    description: "Alert customer of payment failure and provide retry instructions.",
    iconName: "AlertTriangle",
    colorClass: "border-l-teal-500",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    defaultConfig: {
      subject: "Action Required: Payment Failed for Invoice {{invoice.number}}",
    },
    fields: [{ key: "subject", label: "Failure Notice Subject", type: "expression" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { failureNoticeSent: true },
  },

  /* ======================================================================== */
  /* 6. CONDITION NODES                                                       */
  /* ======================================================================== */
  {
    subType: "IF_ELSE",
    type: "CONDITION",
    category: "CONDITIONS",
    label: "IF / ELSE Condition",
    description: "Evaluate one or more rules (AND/OR) and route execution along TRUE or FALSE branch.",
    iconName: "GitBranch",
    colorClass: "border-l-indigo-500",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    defaultConfig: {
      combinator: "AND",
      field: "invoice.outstanding_amount",
      operator: "GREATER_THAN",
      value: "0",
      secondaryField: "",
      secondaryOperator: "EQUALS",
      secondaryValue: "",
    },
    fields: [
      {
        key: "combinator",
        label: "Rule Combinator",
        type: "select",
        options: [
          { label: "Match ALL Rules (AND)", value: "AND" },
          { label: "Match ANY Rule (OR)", value: "OR" },
        ],
      },
      { key: "field", label: "Left Operand / Field Path", type: "expression", placeholder: "invoice.outstanding_amount" },
      {
        key: "operator",
        label: "Comparison Operator",
        type: "select",
        options: [
          { label: "Equals (==)", value: "EQUALS" },
          { label: "Not Equals (!=)", value: "NOT_EQUALS" },
          { label: "Greater Than (>)", value: "GREATER_THAN" },
          { label: "Less Than (<)", value: "LESS_THAN" },
          { label: "Greater or Equal (>=)", value: "GTE" },
          { label: "Less or Equal (<=)", value: "LTE" },
          { label: "Contains", value: "CONTAINS" },
          { label: "In List (comma-separated)", value: "IN" },
          { label: "Is Empty", value: "IS_EMPTY" },
          { label: "Is Not Empty", value: "IS_NOT_EMPTY" },
        ],
      },
      { key: "value", label: "Right Operand / Target Value", type: "expression", placeholder: "0" },
      { key: "secondaryField", label: "2nd Rule Field (Optional)", type: "expression", placeholder: "subscription.status" },
      {
        key: "secondaryOperator",
        label: "2nd Rule Operator",
        type: "select",
        options: [
          { label: "Equals (==)", value: "EQUALS" },
          { label: "Not Equals (!=)", value: "NOT_EQUALS" },
          { label: "Greater Than (>)", value: "GREATER_THAN" },
          { label: "Less Than (<)", value: "LESS_THAN" },
          { label: "Contains", value: "CONTAINS" },
        ],
      },
      { key: "secondaryValue", label: "2nd Rule Value", type: "expression", placeholder: "ACTIVE" },
    ],
    outputs: [
      { id: "true", label: "TRUE (Yes)", branch: "TRUE", color: "#10B981" },
      { id: "false", label: "FALSE (No)", branch: "FALSE", color: "#EF4444" },
    ],
    sampleOutput: { result: true, branchSelected: "TRUE" },
  },
  {
    subType: "SWITCH",
    type: "CONDITION",
    category: "CONDITIONS",
    label: "Switch Router",
    description: "Route execution across multiple branches based on a field value.",
    iconName: "GitFork",
    colorClass: "border-l-indigo-500",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    defaultConfig: {
      field: "subscription.status",
      case1Value: "ACTIVE",
      case2Value: "EXPIRED",
    },
    fields: [
      { key: "field", label: "Switch Expression / Field", type: "expression", placeholder: "subscription.status" },
      { key: "case1Value", label: "Branch TRUE Match Value", type: "text", defaultValue: "ACTIVE" },
      { key: "case2Value", label: "Branch FALSE Match Value", type: "text", defaultValue: "EXPIRED" },
    ],
    outputs: [
      { id: "true", label: "Case 1 (TRUE)", branch: "TRUE", color: "#10B981" },
      { id: "false", label: "Case 2 / Fallback (FALSE)", branch: "FALSE", color: "#F59E0B" },
    ],
    sampleOutput: { matchedBranch: "TRUE", evaluatedValue: "ACTIVE" },
  },
  {
    subType: "COMPARE_VALUES",
    type: "CONDITION",
    category: "CONDITIONS",
    label: "Compare Values",
    description: "Compare two dynamic expressions (`GREATER_THAN`, `LESS_THAN`, `EQUALS`, `CONTAINS`).",
    iconName: "Scale",
    colorClass: "border-l-indigo-500",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    defaultConfig: { field: "status", operator: "EQUALS", value: "ACTIVE" },
    fields: [
      { key: "field", label: "Field / Expression", type: "expression" },
      {
        key: "operator",
        label: "Operator",
        type: "select",
        options: [
          { label: "Equals", value: "EQUALS" },
          { label: "Greater Than", value: "GREATER_THAN" },
          { label: "Less Than", value: "LESS_THAN" },
          { label: "Contains", value: "CONTAINS" },
          { label: "Is Empty", value: "IS_EMPTY" },
          { label: "Is Not Empty", value: "IS_NOT_EMPTY" },
        ],
      },
      { key: "value", label: "Target Value", type: "expression" },
    ],
    outputs: [
      { id: "true", label: "TRUE", branch: "TRUE", color: "#10B981" },
      { id: "false", label: "FALSE", branch: "FALSE", color: "#EF4444" },
    ],
    sampleOutput: { result: true },
  },
  {
    subType: "DATE_COMPARISON",
    type: "CONDITION",
    category: "CONDITIONS",
    label: "Date Comparison",
    description: "Compare a date field against today or another timestamp.",
    iconName: "Calendar",
    colorClass: "border-l-indigo-500",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    defaultConfig: { dateField: "subscription.expiry_date", comparison: "WITHIN_DAYS", days: 7 },
    fields: [
      { key: "dateField", label: "Date Field", type: "expression", defaultValue: "subscription.expiry_date" },
      {
        key: "comparison",
        label: "Date Condition",
        type: "select",
        options: [
          { label: "Is Within Next N Days", value: "WITHIN_DAYS" },
          { label: "Is In The Past (Expired/Overdue)", value: "IN_PAST" },
          { label: "Is In The Future", value: "IN_FUTURE" },
        ],
      },
      { key: "days", label: "Days Threshold", type: "number", defaultValue: 7 },
    ],
    outputs: [
      { id: "true", label: "TRUE", branch: "TRUE", color: "#10B981" },
      { id: "false", label: "FALSE", branch: "FALSE", color: "#EF4444" },
    ],
    sampleOutput: { result: true, daysDifference: 5 },
  },

  /* ======================================================================== */
  /* 7. LOGIC NODES                                                           */
  /* ======================================================================== */
  {
    subType: "SET_VARIABLES",
    type: "ACTION",
    category: "LOGIC",
    label: "Set Variables",
    description: "Define or override workflow context variables for downstream nodes.",
    iconName: "Variable",
    colorClass: "border-l-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    defaultConfig: { key: "escalation_level", value: "TIER_1" },
    fields: [
      { key: "key", label: "Variable Name", type: "text", placeholder: "escalation_level" },
      { key: "value", label: "Variable Value / Expression", type: "expression", placeholder: "TIER_1" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { variablesSet: { escalation_level: "TIER_1" } },
  },
  {
    subType: "WAIT_DELAY",
    type: "ACTION",
    category: "LOGIC",
    label: "Wait / Delay",
    description: "Pause execution for a configured duration before continuing to next node.",
    iconName: "Timer",
    colorClass: "border-l-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    defaultConfig: { delaySeconds: 1, unit: "SECONDS" },
    fields: [
      { key: "delaySeconds", label: "Delay Duration", type: "number", defaultValue: 1 },
      {
        key: "unit",
        label: "Time Unit",
        type: "select",
        options: [
          { label: "Seconds", value: "SECONDS" },
          { label: "Minutes (Simulated in Test)", value: "MINUTES" },
          { label: "Hours (Scheduled Checkpoint)", value: "HOURS" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { waitedMs: 1000, resumedAt: "2026-10-31T10:00:01Z" },
  },
  {
    subType: "FILTER",
    type: "ACTION",
    category: "LOGIC",
    label: "Filter Collection",
    description: "Filter array items in workflow state by a property condition.",
    iconName: "Filter",
    colorClass: "border-l-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    defaultConfig: { sourceArray: "invoices", filterKey: "status", filterValue: "CONFIRMED" },
    fields: [
      { key: "sourceArray", label: "Collection Name", type: "text", defaultValue: "invoices" },
      { key: "filterKey", label: "Property Key", type: "text", defaultValue: "status" },
      { key: "filterValue", label: "Expected Value", type: "text", defaultValue: "CONFIRMED" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { filteredCount: 2 },
  },
  {
    subType: "SORT",
    type: "ACTION",
    category: "LOGIC",
    label: "Sort Items",
    description: "Sort collection items ascending or descending by field.",
    iconName: "ArrowUpDown",
    colorClass: "border-l-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    defaultConfig: { sortBy: "totalAmount", direction: "DESC" },
    fields: [
      { key: "sortBy", label: "Sort Field", type: "text", defaultValue: "totalAmount" },
      {
        key: "direction",
        label: "Direction",
        type: "select",
        options: [
          { label: "Descending", value: "DESC" },
          { label: "Ascending", value: "ASC" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { sorted: true, direction: "DESC" },
  },
  {
    subType: "LIMIT",
    type: "ACTION",
    category: "LOGIC",
    label: "Limit Items",
    description: "Cap the maximum number of items passed to downstream nodes.",
    iconName: "Minimize2",
    colorClass: "border-l-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    defaultConfig: { maxItems: 5 },
    fields: [{ key: "maxItems", label: "Maximum Items", type: "number", defaultValue: 5 }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { limitApplied: 5 },
  },
  {
    subType: "MERGE",
    type: "ACTION",
    category: "LOGIC",
    label: "Merge Branches",
    description: "Combine outputs from multiple upstream branches into unified context.",
    iconName: "GitMerge",
    colorClass: "border-l-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    defaultConfig: { mode: "COMBINE_ALL" },
    fields: [],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { merged: true },
  },
  {
    subType: "SPLIT_IN_BATCHES",
    type: "ACTION",
    category: "LOGIC",
    label: "Split in Batches / Loop",
    description: "Process records in controlled batch sizes to prevent rate limits.",
    iconName: "Layers",
    colorClass: "border-l-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    defaultConfig: { batchSize: 10 },
    fields: [{ key: "batchSize", label: "Batch Size", type: "number", defaultValue: 10 }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { batchSize: 10, batchesProcessed: 1 },
  },
  {
    subType: "TRANSFORM_DATA",
    type: "ACTION",
    category: "LOGIC",
    label: "Transform Data",
    description: "Map and enrich context fields using dynamic template expressions.",
    iconName: "Sparkles",
    colorClass: "border-l-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    defaultConfig: {
      outputKey: "summary_line",
      template: "{{customer.name}} ({{customer.code}}) — {{subscription.number}}",
    },
    fields: [
      { key: "outputKey", label: "Output Field Key", type: "text", defaultValue: "summary_line" },
      { key: "template", label: "Transformation Expression", type: "expression" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { summary_line: "Acme Corp (CUST-1001) — SUB-2026-0001" },
  },

  /* ======================================================================== */
  /* 8. COMMUNICATION NODES                                                   */
  /* ======================================================================== */
  {
    subType: "SEND_EMAIL",
    type: "ACTION",
    category: "COMMUNICATION",
    label: "Send Email",
    description: "Dispatch transactional HTML email via Billora Email Centre (idempotent).",
    iconName: "Mail",
    colorClass: "border-l-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    defaultConfig: {
      templateCode: "TPL-WELCOME-01",
      recipientEmail: "{{customer.email}}",
      subject: "Update from Billora regarding {{subscription.number}}",
      bodyHtml: "<p>Hello {{customer.name}},</p><p>Here is an update regarding your subscription <strong>{{subscription.number}}</strong>.</p>",
    },
    fields: [
      { key: "recipientEmail", label: "Recipient Email", type: "expression", defaultValue: "{{customer.email}}" },
      { key: "templateCode", label: "Template Code", type: "text", defaultValue: "TPL-WELCOME-01" },
      { key: "subject", label: "Email Subject", type: "expression" },
      { key: "bodyHtml", label: "Custom Body HTML", type: "textarea" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { emailId: "eml_1", messageCode: "EML-2026-101", status: "DELIVERED" },
  },
  {
    subType: "SEND_NOTIFICATION",
    type: "ACTION",
    category: "COMMUNICATION",
    label: "Create In-App Notification",
    description: "Create real-time notification in Billora notification center for staff or customer.",
    iconName: "Bell",
    colorClass: "border-l-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    defaultConfig: {
      targetAudience: "ADMIN_AND_OWNER",
      title: "Workflow Alert: {{customer.name}}",
      message: "Automated action executed for {{subscription.number}}.",
    },
    fields: [
      {
        key: "targetAudience",
        label: "Notification Recipient",
        type: "select",
        options: [
          { label: "Workflow Owner & Admins", value: "ADMIN_AND_OWNER" },
          { label: "Assigned Employee", value: "ASSIGNED_EMPLOYEE" },
          { label: "Customer Portal User", value: "CUSTOMER" },
        ],
      },
      { key: "title", label: "Notification Title", type: "expression" },
      { key: "message", label: "Notification Message", type: "expression" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { notified: true, title: "Workflow Alert" },
  },
  {
    subType: "CREATE_TASK",
    type: "ACTION",
    category: "COMMUNICATION",
    label: "Assign Employee Task",
    description: "Create a tracked operational task in Billora My Tasks for an employee.",
    iconName: "CheckSquare",
    colorClass: "border-l-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    defaultConfig: {
      title: "Follow up with {{customer.name}} on {{subscription.number}}",
      priority: "HIGH",
      category: "RENEWAL",
      dueDays: 3,
      description: "Automated task generated by Workflow Studio.",
    },
    fields: [
      { key: "title", label: "Task Title", type: "expression", required: true },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: [
          { label: "LOW", value: "LOW" },
          { label: "MEDIUM", value: "MEDIUM" },
          { label: "HIGH", value: "HIGH" },
          { label: "URGENT", value: "URGENT" },
        ],
      },
      { key: "dueDays", label: "Due In (Days)", type: "number", defaultValue: 3 },
      { key: "description", label: "Task Instructions", type: "textarea" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { taskCode: "TSK-2026-105", status: "ASSIGNED" },
  },
  {
    subType: "SEND_WEBHOOK",
    type: "ACTION",
    category: "COMMUNICATION",
    label: "Send Webhook",
    description: "Dispatch signed JSON payload to an approved webhook integration endpoint.",
    iconName: "Send",
    colorClass: "border-l-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    defaultConfig: {
      integrationKey: "INT-WEBHOOK-DEFAULT",
      eventName: "billora.workflow.event",
    },
    fields: [
      { key: "integrationKey", label: "Approved Integration Reference", type: "text", defaultValue: "INT-WEBHOOK-DEFAULT" },
      { key: "eventName", label: "Webhook Event Name", type: "text", defaultValue: "billora.workflow.event" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { webhookDelivered: true, statusCode: 200 },
  },
  {
    subType: "SEND_SMS",
    type: "ACTION",
    category: "COMMUNICATION",
    label: "Send SMS Alert",
    description: "Send transactional SMS via approved SMS gateway integration.",
    iconName: "Smartphone",
    colorClass: "border-l-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    defaultConfig: {
      integrationKey: "INT-SMS-GATEWAY",
      toPhone: "{{customer.phone}}",
      message: "Billora Alert: Subscription {{subscription.number}} requires your attention.",
    },
    fields: [
      { key: "integrationKey", label: "SMS Integration Reference", type: "text", defaultValue: "INT-SMS-GATEWAY" },
      { key: "toPhone", label: "Recipient Phone", type: "expression", defaultValue: "{{customer.phone}}" },
      { key: "message", label: "SMS Text (Max 160 chars)", type: "expression" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { smsDispatched: true, integration: "INT-SMS-GATEWAY" },
  },

  /* ======================================================================== */
  /* 9. DATA NODES                                                            */
  /* ======================================================================== */
  {
    subType: "READ_BILLORA_DATA",
    type: "ACTION",
    category: "DATA",
    label: "Read Billora Data",
    description: "Query permitted Billora records (Plans, Tax Rules, Discounts) respecting RBAC.",
    iconName: "Database",
    colorClass: "border-l-cyan-500",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    defaultConfig: { entity: "SUBSCRIPTION_PLANS", limit: 10 },
    fields: [
      {
        key: "entity",
        label: "Data Entity",
        type: "select",
        options: [
          { label: "Active Subscription Plans", value: "SUBSCRIPTION_PLANS" },
          { label: "Active Tax Rules", value: "TAX_RULES" },
          { label: "Active Discounts", value: "DISCOUNTS" },
        ],
      },
      { key: "limit", label: "Row Limit", type: "number", defaultValue: 10 },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { entity: "SUBSCRIPTION_PLANS", recordsLoaded: 5 },
  },
  {
    subType: "FORMAT_CURRENCY",
    type: "ACTION",
    category: "DATA",
    label: "Format Currency (INR)",
    description: "Format numeric values into standard Indian Rupee (`₹1,23,456.00`) notation.",
    iconName: "IndianRupee",
    colorClass: "border-l-cyan-500",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    defaultConfig: { amountExpression: "{{invoice.outstanding_amount}}", outputKey: "formatted_amount" },
    fields: [
      { key: "amountExpression", label: "Amount Expression", type: "expression", defaultValue: "{{invoice.outstanding_amount}}" },
      { key: "outputKey", label: "Save to Context Key", type: "text", defaultValue: "formatted_amount" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { formatted_amount: "₹18,500.00" },
  },
  {
    subType: "FORMAT_DATE",
    type: "ACTION",
    category: "DATA",
    label: "Format Date",
    description: "Format ISO date strings into human-readable Indian locale dates.",
    iconName: "Calendar",
    colorClass: "border-l-cyan-500",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    defaultConfig: { dateExpression: "{{subscription.expiry_date}}", style: "DD_MMM_YYYY" },
    fields: [
      { key: "dateExpression", label: "Date Expression", type: "expression", defaultValue: "{{subscription.expiry_date}}" },
      {
        key: "style",
        label: "Date Format",
        type: "select",
        options: [
          { label: "31 Oct 2026 (en-IN)", value: "DD_MMM_YYYY" },
          { label: "2026-10-31 (ISO Date)", value: "YYYY_MM_DD" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { formattedDate: "07 Nov 2026" },
  },
  {
    subType: "JSON_TRANSFORMATION",
    type: "ACTION",
    category: "DATA",
    label: "JSON Transformation",
    description: "Construct a structured JSON payload from workflow context variables.",
    iconName: "FileCode",
    colorClass: "border-l-cyan-500",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    defaultConfig: {
      jsonTemplate: '{"customer":"{{customer.name}}","subscription":"{{subscription.number}}","status":"{{subscription.status}}"}',
    },
    fields: [{ key: "jsonTemplate", label: "JSON Template", type: "textarea" }],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { customer: "Acme Corp", subscription: "SUB-2026-0001", status: "ACTIVE" },
  },

  /* ======================================================================== */
  /* 10. UTILITY NODES                                                        */
  /* ======================================================================== */
  {
    subType: "HTTP_REQUEST",
    type: "ACTION",
    category: "UTILITY",
    label: "HTTP Request",
    description: "Make an outbound HTTP GET/POST request using an approved server credential reference.",
    iconName: "Globe",
    colorClass: "border-l-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    defaultConfig: {
      method: "POST",
      integrationKey: "INT-HTTP-API",
      endpointPath: "/v1/events",
    },
    fields: [
      {
        key: "method",
        label: "HTTP Method",
        type: "select",
        options: [
          { label: "POST", value: "POST" },
          { label: "GET", value: "GET" },
        ],
      },
      { key: "integrationKey", label: "Approved Integration Reference", type: "text", defaultValue: "INT-HTTP-API" },
      { key: "endpointPath", label: "Endpoint Path", type: "text", defaultValue: "/v1/events" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { status: 200, ok: true },
  },
  {
    subType: "MATH_OPERATION",
    type: "ACTION",
    category: "UTILITY",
    label: "Mathematical Operation",
    description: "Perform exact decimal arithmetic (Add, Subtract, Multiply, Divide, Percentage).",
    iconName: "Calculator",
    colorClass: "border-l-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    defaultConfig: {
      leftOperand: "{{invoice.outstanding_amount}}",
      operation: "MULTIPLY",
      rightOperand: "0.18",
      outputKey: "calculated_value",
    },
    fields: [
      { key: "leftOperand", label: "Left Value / Expression", type: "expression" },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { label: "Add (+)", value: "ADD" },
          { label: "Subtract (-)", value: "SUBTRACT" },
          { label: "Multiply (*)", value: "MULTIPLY" },
          { label: "Divide (/)", value: "DIVIDE" },
        ],
      },
      { key: "rightOperand", label: "Right Value / Expression", type: "expression" },
      { key: "outputKey", label: "Save Result To Key", type: "text", defaultValue: "calculated_value" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { calculated_value: 3330 },
  },
  {
    subType: "STRING_OPERATION",
    type: "ACTION",
    category: "UTILITY",
    label: "String Operation",
    description: "Transform text (UPPERCASE, lowercase, trim, replace, substring).",
    iconName: "Type",
    colorClass: "border-l-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    defaultConfig: { input: "{{customer.name}}", mode: "UPPERCASE", outputKey: "transformed_text" },
    fields: [
      { key: "input", label: "Input Text / Expression", type: "expression" },
      {
        key: "mode",
        label: "String Operation",
        type: "select",
        options: [
          { label: "UPPERCASE", value: "UPPERCASE" },
          { label: "lowercase", value: "LOWERCASE" },
          { label: "Trim Whitespace", value: "TRIM" },
        ],
      },
      { key: "outputKey", label: "Save To Key", type: "text", defaultValue: "transformed_text" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { transformed_text: "ACME CORP" },
  },
  {
    subType: "ERROR_HANDLER",
    type: "ACTION",
    category: "UTILITY",
    label: "Error Handler & Fallback",
    description: "Catch upstream node errors, record diagnostic context, and notify administrator.",
    iconName: "ShieldAlert",
    colorClass: "border-l-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    defaultConfig: { fallbackAction: "NOTIFY_ADMIN", suppressFailure: false },
    fields: [
      {
        key: "fallbackAction",
        label: "Recovery Policy",
        type: "select",
        options: [
          { label: "Notify Admin & Record Failure", value: "NOTIFY_ADMIN" },
          { label: "Create Escalation Task", value: "CREATE_RECOVERY_TASK" },
        ],
      },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { errorHandlerArmed: true },
  },
  {
    subType: "EXECUTION_LOGGER",
    type: "ACTION",
    category: "UTILITY",
    label: "Execution Logger",
    description: "Write a structured audit/execution log entry with resolved dynamic variables.",
    iconName: "Terminal",
    colorClass: "border-l-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    defaultConfig: {
      level: "INFO",
      message: "Executed workflow step for {{customer.name}} ({{subscription.number}})",
    },
    fields: [
      {
        key: "level",
        label: "Log Level",
        type: "select",
        options: [
          { label: "INFO", value: "INFO" },
          { label: "WARN", value: "WARN" },
          { label: "ERROR", value: "ERROR" },
        ],
      },
      { key: "message", label: "Log Message Template", type: "expression" },
    ],
    outputs: [{ id: "out", label: "Next", branch: "DEFAULT" }],
    sampleOutput: { logged: true, level: "INFO" },
  },
  {
    subType: "COMPLETE_WORKFLOW",
    type: "ACTION",
    category: "UTILITY",
    label: "Complete / Stop Workflow",
    description: "Explicitly terminate the current branch and record final execution outcome.",
    iconName: "CheckCircle2",
    colorClass: "border-l-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    defaultConfig: { outcome: "SUCCESS", summary: "Workflow branch completed cleanly" },
    fields: [
      {
        key: "outcome",
        label: "Completion Outcome",
        type: "select",
        options: [
          { label: "SUCCESS (Completed)", value: "SUCCESS" },
          { label: "STOPPED (Filtered / No-Op)", value: "STOPPED" },
        ],
      },
      { key: "summary", label: "Completion Summary", type: "expression" },
    ],
    outputs: [],
    sampleOutput: { outcome: "SUCCESS", completed: true },
  },
];

export function getNodeCatalogEntry(subType: string): NodeCatalogEntry | undefined {
  return WORKFLOW_NODE_CATALOG.find((n) => n.subType === subType);
}

/**
 * Safely resolves nested & flat `{{expression}}` tokens against the workflow execution context.
 * Supports both dot notation (`{{customer.name}}`, `{{invoice.outstanding_amount}}`)
 * and flat snake_case notation (`{{customer_name}}`, `{{invoice_amount}}`).
 * Never exposes sensitive credentials or password hashes.
 */
const FORBIDDEN_CONTEXT_KEYS = new Set([
  "passwordHash",
  "password_hash",
  "tokenHash",
  "csrfToken",
  "serviceRoleKey",
  "secretKey",
  "apiKey",
]);

export function resolveWorkflowPath(context: Record<string, any>, rawPath: string): any {
  const path = rawPath.trim().replace(/^\{\{|\}\}$/g, "").trim();
  if (!path) return undefined;

  if (FORBIDDEN_CONTEXT_KEYS.has(path)) return "[REDACTED]";

  // Direct key lookup first
  if (Object.prototype.hasOwnProperty.call(context, path)) {
    return context[path];
  }

  // Dot-notation traversal
  const parts = path.split(".");
  let current: any = context;
  for (const part of parts) {
    if (FORBIDDEN_CONTEXT_KEYS.has(part)) return "[REDACTED]";
    if (current === null || current === undefined || typeof current !== "object") {
      current = undefined;
      break;
    }
    current = current[part];
  }
  if (current !== undefined) return current;

  // Fallback mapping between dot-notation and snake_case
  const snakeFallback = path.replace(/\./g, "_");
  if (Object.prototype.hasOwnProperty.call(context, snakeFallback)) {
    return context[snakeFallback];
  }

  return undefined;
}

export function evaluateExpressionString(template: string | undefined | null, context: Record<string, any>): string {
  if (!template) return "";
  return String(template).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, exprPath) => {
    const resolved = resolveWorkflowPath(context, exprPath);
    if (resolved === undefined || resolved === null) return "";
    if (typeof resolved === "object") return JSON.stringify(resolved);
    return String(resolved);
  });
}
