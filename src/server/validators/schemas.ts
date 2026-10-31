import { z } from "zod";

/**
 * Password complexity validator per Section 5 of SPEC.md:
 * - More than 8 characters (min 9 chars)
 * - At least one uppercase character
 * - At least one lowercase character
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(9, "Password must contain more than 8 characters (at least 9 characters)")
  .regex(/[A-Z]/, "Password must contain at least one uppercase character")
  .regex(/[a-z]/, "Password must contain at least one lowercase character")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const registerCustomerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required"),
    email: z.string().trim().email("Valid email address is required").toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
    companyName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    gstin: z.string().trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Valid email address is required").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Valid email address is required").toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Reset token is required"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Valid email address is required").toLowerCase(),
  password: passwordSchema,
  department: z.string().trim().min(2, "Department is required"),
  designation: z.string().trim().min(2, "Designation is required"),
  phone: z.string().trim().optional(),
});

export const createCustomerSchema = z.object({
  contactName: z.string().trim().min(2, "Contact name is required"),
  companyName: z.string().trim().optional(),
  email: z.string().trim().email("Valid email is required").toLowerCase(),
  phone: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
  billingAddress: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  assignedEmployeeId: z.string().optional().nullable(),
  password: passwordSchema.optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is required"),
  productType: z.enum(["SAAS", "SERVICE", "LICENSE", "ADDON", "HARDWARE"]).default("SAAS"),
  salesPrice: z.coerce.number().min(0, "Sales price must be non-negative"),
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export const variantSchema = z.object({
  name: z.string().trim().min(1, "Variant name is required"),
  sku: z.string().trim().min(2, "SKU is required"),
  additionalPrice: z.coerce.number().min(0, "Additional price must be non-negative"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const taxRuleSchema = z.object({
  name: z.string().trim().min(2, "Tax name is required"),
  taxType: z.string().trim().min(2, "Tax type is required").default("GST"),
  percentage: z.coerce.number().min(0).max(100, "Tax percentage must be between 0 and 100"),
  applicability: z.string().default("ALL"),
  effectiveFrom: z.string().or(z.date()),
  effectiveUntil: z.string().or(z.date()).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const subscriptionPlanSchema = z.object({
  name: z.string().trim().min(2, "Plan name is required"),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, "Base price must be non-negative"),
  billingFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  minQuantity: z.coerce.number().int().min(1).default(1),
  availableFrom: z.string().or(z.date()).optional().nullable(),
  availableUntil: z.string().or(z.date()).optional().nullable(),
  autoCloseDays: z.coerce.number().int().min(1).optional().nullable(),
  allowEarlyCancel: z.boolean().default(true),
  allowPause: z.boolean().default(true),
  allowRenewal: z.boolean().default(true),
  defaultTermMonths: z.coerce.number().int().min(1).default(12),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  imageUrl: z.string().optional().nullable(),
  productIds: z.array(z.string()).optional(),
});

export const discountSchema = z.object({
  code: z.string().trim().min(2, "Discount code is required").toUpperCase(),
  name: z.string().trim().min(2, "Discount name is required"),
  discountType: z.enum(["FIXED", "PERCENTAGE"]),
  value: z.coerce.number().positive("Discount value must be greater than 0"),
  minPurchaseAmount: z.coerce.number().min(0).default(0),
  minQuantity: z.coerce.number().int().min(1).default(1),
  applicableToAll: z.boolean().default(true),
  productIds: z.array(z.string()).optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  maxUsageCount: z.coerce.number().int().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const quotationLineInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  variantId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  taxRuleId: z.string().optional().nullable(),
  description: z.string().optional(),
});

export const createQuotationSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  planId: z.string().min(1, "Subscription plan is required"),
  templateId: z.string().optional().nullable(),
  discountCode: z.string().optional().nullable(),
  validityDays: z.coerce.number().int().min(1).default(15),
  notes: z.string().optional(),
  lines: z.array(quotationLineInputSchema).min(1, "At least one product line is required"),
});

export const createSubscriptionSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  planId: z.string().min(1, "Subscription plan is required"),
  startDate: z.string().or(z.date()).optional(),
  paymentTermsDays: z.coerce.number().int().min(0).default(7),
  discountCode: z.string().optional().nullable(),
  lines: z.array(quotationLineInputSchema).min(1, "At least one product line is required"),
  activateImmediately: z.boolean().default(false),
});

export const subscriptionTransitionSchema = z.object({
  action: z.enum(["CONFIRM", "ACTIVATE", "PAUSE", "RESUME", "RENEW", "CANCEL", "CLOSE", "EXPIRE"]),
  reason: z.string().optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.coerce.number().positive("Payment amount must be greater than zero"),
  method: z.enum(["UPI", "BANK_TRANSFER", "CREDIT_CARD", "DEBIT_CARD", "CASH", "RAZORPAY", "OTHER"]),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
  paymentDate: z.string().or(z.date()).optional(),
});

export const refundPaymentSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  refundAmount: z.coerce.number().positive("Refund amount must be positive"),
  reason: z.string().min(2, "Refund reason is required"),
});
