import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { CatalogService } from "@/server/services/catalog.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const taxes = await prisma.taxRule.findMany({
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(
      taxes.map((t) => ({
        ...t,
        percentage: toNumber2(t.percentage),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const tax = await CatalogService.createTaxRule(session, body);
    return apiSuccess(tax, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const { id, ...rest } = body;
    const tax = await CatalogService.updateTaxRule(session, id, rest);
    return apiSuccess(tax);
  } catch (error) {
    return handleApiError(error);
  }
}
