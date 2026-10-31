import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { CatalogService } from "@/server/services/catalog.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const plans = await prisma.subscriptionPlan.findMany({
      include: {
        planProducts: {
          include: { product: { include: { variants: true } } },
        },
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = plans.map((p) => ({
      ...p,
      basePrice: toNumber2(p.basePrice),
    }));

    return apiSuccess(formatted);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const plan = await CatalogService.createSubscriptionPlan(session, body);
    return apiSuccess(plan, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const { id, ...rest } = body;
    const plan = await CatalogService.updateSubscriptionPlan(session, id, rest);
    return apiSuccess(plan);
  } catch (error) {
    return handleApiError(error);
  }
}
