import { getSupabaseConfigStatus } from "@/lib/supabase/config";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { StorageService } from "@/server/services/storage.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const supabaseStatus = getSupabaseConfigStatus();

    const [
      rolesCount,
      usersCount,
      customersCount,
      employeesCount,
      productsCount,
      plansCount,
      quotationsCount,
      subscriptionsCount,
      invoicesCount,
      paymentsCount,
    ] = await Promise.all([
      prisma.role.count(),
      prisma.user.count(),
      prisma.customer.count(),
      prisma.employee.count(),
      prisma.product.count(),
      prisma.subscriptionPlan.count(),
      prisma.quotation.count(),
      prisma.subscription.count(),
      prisma.invoice.count(),
      prisma.payment.count(),
    ]);

    return apiSuccess({
      authenticatedAs: {
        userId: session.userId,
        email: session.email,
        role: session.role,
      },
      supabase: {
        ...supabaseStatus,
        rlsMigrationFile:
          "supabase/migrations/20261031000001_billora_centralized_schema_and_rls.sql",
        storageBuckets: StorageService.BUCKETS,
      },
      centralizedDatabaseCounts: {
        roles: rolesCount,
        users: usersCount,
        customers: customersCount,
        employees: employeesCount,
        products: productsCount,
        subscriptionPlans: plansCount,
        quotations: quotationsCount,
        subscriptions: subscriptionsCount,
        invoices: invoicesCount,
        payments: paymentsCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
