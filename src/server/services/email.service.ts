import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { AuthSessionContext } from "@/server/middlewares/auth";

export interface SendEmailInput {
  senderId?: string;
  senderEmail?: string;
  recipientEmail: string;
  recipientName?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  bodyHtml: string;
  templateId?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  workflowExecutionId?: string;
  scheduledFor?: Date | string;
  metadata?: Record<string, any>;
}

export interface DefaultTemplateSeed {
  templateCode: string;
  name: string;
  category: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplateSeed[] = [
  {
    templateCode: "TPL-WELCOME-01",
    name: "Customer Welcome & Platform Onboarding",
    category: "ONBOARDING",
    subject: "Welcome to Billora, {{customer_name}}!",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #4F46E5; margin-bottom: 16px;">Welcome to Billora!</h2>
  <p>Dear {{customer_name}},</p>
  <p>Thank you for partnering with Billora. Your account has been provisioned and is ready for subscription management and automated billing.</p>
  <p>Your dedicated account executive is <strong>{{employee_name}}</strong>. If you require any onboarding assistance, feel free to reply directly to this email.</p>
  <div style="margin: 24px 0; padding: 16px; background: #F1F5F9; border-radius: 8px;">
    <p style="margin: 0; font-size: 13px; color: #475569;">Customer Account Code: <strong>{{customer_code}}</strong></p>
    <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">Email: <strong>{{customer_email}}</strong></p>
  </div>
  <p style="color: #64748B; font-size: 12px; margin-top: 32px;">Billora Cloud Platform • Automated Revenue Operations</p>
</div>`,
    variables: ["customer_name", "customer_code", "customer_email", "employee_name"],
  },
  {
    templateCode: "TPL-ACTIVATION-02",
    name: "Subscription Activation Notice",
    category: "BILLING",
    subject: "Your Subscription to {{plan_name}} is Active",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #10B981; margin-bottom: 16px;">Subscription Activated</h2>
  <p>Hello {{customer_name}},</p>
  <p>Your subscription for <strong>{{plan_name}}</strong> has been confirmed and is now active.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #64748B;">Plan:</td><td style="font-weight: 600;">{{plan_name}}</td></tr>
    <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #64748B;">Cadence Amount:</td><td style="font-weight: 600;">{{invoice_amount}}</td></tr>
    <tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px 0; color: #64748B;">Renewal Date:</td><td style="font-weight: 600;">{{renewal_date}}</td></tr>
  </table>
  <p>You can manage your subscription and invoice history through the Customer Portal.</p>
</div>`,
    variables: ["customer_name", "plan_name", "invoice_amount", "renewal_date"],
  },
  {
    templateCode: "TPL-RENEWAL-03",
    name: "Upcoming Subscription Renewal Reminder (7 Days)",
    category: "RENEWAL",
    subject: "Upcoming Renewal Notice: {{plan_name}} on {{renewal_date}}",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #4F46E5; margin-bottom: 16px;">Subscription Renewal Notice</h2>
  <p>Dear {{customer_name}},</p>
  <p>This is a courtesy notification that your subscription for <strong>{{plan_name}}</strong> is scheduled to renew on <strong>{{renewal_date}}</strong>.</p>
  <div style="background: #EEF2FF; border-left: 4px solid #4F46E5; padding: 16px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 14px;">Scheduled Renewal Amount: <strong>{{invoice_amount}}</strong></p>
    <p style="margin: 4px 0 0; font-size: 13px; color: #4338CA;">Automated recurring billing will process on {{renewal_date}}.</p>
  </div>
  <p>If you wish to review contract terms, adjust licenses, or speak with your account team, please contact <strong>{{employee_name}}</strong> prior to the renewal date.</p>
  <p style="color: #64748B; font-size: 12px; margin-top: 24px;">Thank you for your ongoing partnership with Billora.</p>
</div>`,
    variables: ["customer_name", "plan_name", "renewal_date", "invoice_amount", "employee_name"],
  },
  {
    templateCode: "TPL-PAY-FAIL-04",
    name: "Payment Failure Notice & Auto-Recovery",
    category: "BILLING",
    subject: "Action Required: Payment Processing Failed for Invoice {{invoice_number}}",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #EF4444; margin-bottom: 16px;">Payment Unsuccessful</h2>
  <p>Dear {{customer_name}},</p>
  <p>We were unable to process payment for Invoice <strong>{{invoice_number}}</strong> in the amount of <strong>{{invoice_amount}}</strong>.</p>
  <p>To ensure uninterrupted service access for your subscription ({{plan_name}}), please update your payment method or retry the transaction using the secure link below:</p>
  <div style="margin: 24px 0; text-align: center;">
    <a href="{{payment_link}}" style="background: #4F46E5; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Pay {{invoice_amount}} Now</a>
  </div>
  <p style="font-size: 13px; color: #64748B;">Our billing engine will automatically retry the card on file in 48 hours.</p>
</div>`,
    variables: ["customer_name", "invoice_number", "invoice_amount", "plan_name", "payment_link"],
  },
  {
    templateCode: "TPL-PAY-CONFIRM-05",
    name: "Payment Confirmation & Tax Receipt",
    category: "BILLING",
    subject: "Payment Confirmed: Receipt for Invoice {{invoice_number}}",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #10B981; margin-bottom: 16px;">Payment Received — Thank You</h2>
  <p>Dear {{customer_name}},</p>
  <p>We have successfully processed your payment of <strong>{{invoice_amount}}</strong> for Invoice <strong>{{invoice_number}}</strong>.</p>
  <div style="background: #F1F5F9; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-size: 13px;">Transaction Reference: <strong>{{transaction_reference}}</strong></p>
    <p style="margin: 4px 0 0; font-size: 13px;">Date: <strong>{{payment_date}}</strong></p>
  </div>
  <p>Your subscription is fully paid through the current billing period.</p>
</div>`,
    variables: ["customer_name", "invoice_number", "invoice_amount", "transaction_reference", "payment_date"],
  },
  {
    templateCode: "TPL-INVOICE-06",
    name: "Invoice Delivery (Tax Compliant)",
    category: "BILLING",
    subject: "Billora Tax Invoice {{invoice_number}} for {{plan_name}}",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #4F46E5; margin-bottom: 16px;">Tax Invoice Issued</h2>
  <p>Dear {{customer_name}},</p>
  <p>Please find attached the official GST-compliant tax invoice <strong>{{invoice_number}}</strong> for your subscription.</p>
  <p>Invoice Total: <strong>{{invoice_amount}}</strong> • Due Date: <strong>{{payment_due_date}}</strong></p>
</div>`,
    variables: ["customer_name", "invoice_number", "invoice_amount", "payment_due_date", "plan_name"],
  },
  {
    templateCode: "TPL-OVERDUE-07",
    name: "Overdue Invoice Notice & Escalation",
    category: "COLLECTIONS",
    subject: "Overdue Reminder: Invoice {{invoice_number}} is Past Due",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #F59E0B; margin-bottom: 16px;">Invoice Payment Past Due</h2>
  <p>Dear {{customer_name}},</p>
  <p>Our records indicate that Invoice <strong>{{invoice_number}}</strong> for <strong>{{invoice_amount}}</strong> was due on <strong>{{payment_due_date}}</strong> and remains unpaid.</p>
  <p>Please remit payment promptly to avoid interruption of platform services.</p>
</div>`,
    variables: ["customer_name", "invoice_number", "invoice_amount", "payment_due_date"],
  },
  {
    templateCode: "TPL-QUOTE-FOLLOW-08",
    name: "Quotation Follow-Up & Sales Engagement",
    category: "SALES",
    subject: "Following up on Quotation {{quotation_number}} for {{plan_name}}",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #4F46E5; margin-bottom: 16px;">Quotation Follow-up</h2>
  <p>Hi {{customer_name}},</p>
  <p>I wanted to follow up regarding Quotation <strong>{{quotation_number}}</strong> prepared for your team for <strong>{{plan_name}}</strong>.</p>
  <p>Let me know if you have any questions on pricing or enterprise provisions.</p>
  <p>Best regards,<br/><strong>{{employee_name}}</strong></p>
</div>`,
    variables: ["customer_name", "quotation_number", "plan_name", "employee_name"],
  },
  {
    templateCode: "TPL-CANCEL-09",
    name: "Subscription Cancellation Confirmation",
    category: "RETENTION",
    subject: "Cancellation Confirmation for {{plan_name}}",
    bodyHtml: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <h2 style="color: #475569; margin-bottom: 16px;">Subscription Cancellation Notice</h2>
  <p>Dear {{customer_name}},</p>
  <p>Your subscription for <strong>{{plan_name}}</strong> has been cancelled effective {{cancellation_date}}.</p>
  <p>We are sorry to see you go. If you ever wish to reactivate your services, our team will be delighted to welcome you back.</p>
</div>`,
    variables: ["customer_name", "plan_name", "cancellation_date"],
  },
];

export class EmailService {
  /**
   * Automatically seed standard templates if not present in database
   */
  static async seedDefaultTemplates() {
    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      await prisma.emailTemplate.upsert({
        where: { templateCode: tpl.templateCode },
        create: {
          templateCode: tpl.templateCode,
          name: tpl.name,
          category: tpl.category,
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml.trim(),
          variables: JSON.stringify(tpl.variables),
          isSystem: true,
        },
        update: {
          name: tpl.name,
          category: tpl.category,
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml.trim(),
          variables: JSON.stringify(tpl.variables),
        },
      });
    }
  }

  /**
   * Render dynamic fields into template html or subject
   */
  static renderTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
      const val = context[key];
      return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
    });
  }

  /**
   * Send or queue an email with full audit tracking & provider message IDs
   */
  static async sendEmail(session: AuthSessionContext | null, input: SendEmailInput) {
    const count = await prisma.emailMessage.count();
    const messageCode = `EML-${new Date().getFullYear()}-${String(count + 101).padStart(4, "0")}`;

    const isScheduled = Boolean(input.scheduledFor && new Date(input.scheduledFor) > new Date());
    const initialStatus = isScheduled ? "SCHEDULED" : "DELIVERED"; // In development/simulated delivery, immediately marks delivered

    const providerMessageId = `msg_resend_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const email = await prisma.emailMessage.create({
      data: {
        messageCode,
        templateId: input.templateId ?? null,
        senderId: input.senderId ?? session?.userId ?? null,
        senderEmail: input.senderEmail || session?.email || "billing@billora.io",
        recipientEmail: input.recipientEmail.trim().toLowerCase(),
        recipientName: input.recipientName ?? null,
        cc: input.cc ?? null,
        bcc: input.bcc ?? null,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        customerId: input.customerId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        invoiceId: input.invoiceId ?? null,
        workflowExecutionId: input.workflowExecutionId ?? null,
        status: initialStatus,
        providerMessageId,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        sentAt: isScheduled ? null : new Date(),
        deliveredAt: isScheduled ? null : new Date(),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        events: {
          create: [
            {
              event: isScheduled ? "SCHEDULED" : "DELIVERED",
              providerPayload: JSON.stringify({
                provider: "Resend",
                providerMessageId,
                recipient: input.recipientEmail,
                timestamp: new Date().toISOString(),
              }),
            },
          ],
        },
      },
      include: {
        template: true,
        events: true,
        customer: true,
      },
    });

    return email;
  }

  /**
   * List emails with filtering and pagination
   */
  static async listEmails(query: {
    status?: string;
    customerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status && query.status !== "ALL") {
      where.status = query.status;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      where.OR = [
        { messageCode: { contains: q } },
        { recipientEmail: { contains: q } },
        { subject: { contains: q } },
        { recipientName: { contains: q } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.emailMessage.count({ where }),
      prisma.emailMessage.findMany({
        where,
        include: {
          template: true,
          customer: { select: { id: true, customerCode: true, contactName: true, companyName: true } },
          events: { orderBy: { timestamp: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
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
   * List email templates
   */
  static async listTemplates(category?: string) {
    await this.seedDefaultTemplates();
    return prisma.emailTemplate.findMany({
      where: category && category !== "ALL" ? { category } : {},
      orderBy: { templateCode: "asc" },
    });
  }

  /**
   * Record webhook delivery event
   */
  static async processDeliveryWebhook(providerMessageId: string, event: string, payload: any) {
    const message = await prisma.emailMessage.findFirst({
      where: { providerMessageId },
    });
    if (!message) return null;

    const updated = await prisma.emailMessage.update({
      where: { id: message.id },
      data: {
        status: event.toUpperCase(),
        deliveredAt: event.toUpperCase() === "DELIVERED" ? new Date() : message.deliveredAt,
        events: {
          create: {
            event: event.toUpperCase(),
            providerPayload: JSON.stringify(payload),
          },
        },
      },
    });

    return updated;
  }
}
