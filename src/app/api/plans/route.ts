import { toNumber2 } from "@/lib/money";
import { getOrSetServerCache, invalidateServerCacheByPrefix } from "@/server/cache/query-cache";
import { prisma } from "@/server/db/client";
import { AppError, apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { CatalogService } from "@/server/services/catalog.service";
import fs from "fs";
import { NextRequest } from "next/server";
import path from "path";

function getPlanImages(): Record<string, string> {
  try {
    const file = path.join(process.cwd(), "public", "uploads", "plan-images.json");
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch {}
  return {};
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const formatted = await getOrSetServerCache("catalog:plans:all", 60_000, async () => {
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

      const planImages = getPlanImages();

      return plans.map((p) => ({
        ...p,
        basePrice: toNumber2(p.basePrice),
        imageUrl: planImages[p.id] ?? null,
      }));
    });

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
    invalidateServerCacheByPrefix("catalog:plans");
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
    if (!id) {
      throw new AppError("VALIDATION_ERROR", "Subscription plan ID is required", 400);
    }
    const plan = await CatalogService.updateSubscriptionPlan(session, id, rest);
    invalidateServerCacheByPrefix("catalog:plans");
    return apiSuccess(plan);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new AppError("VALIDATION_ERROR", "Subscription plan ID is required", 400);
    }
    const result = await CatalogService.deleteSubscriptionPlan(session, id);
    invalidateServerCacheByPrefix("catalog:plans");
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
