import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const templates = await prisma.quotationTemplate.findMany({
      where: { isActive: true },
      include: {
        plan: true,
        taxRule: true,
        lines: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json();
    const template = await prisma.quotationTemplate.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        planId: body.planId,
        validityDays: Number(body.validityDays ?? 15),
        taxRuleId: body.taxRuleId || null,
        isActive: true,
        lines: {
          create: (body.lines || []).map((l: { productId: string; variantId?: string; defaultQuantity?: number }) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            defaultQuantity: Number(l.defaultQuantity ?? 1),
          })),
        },
      },
      include: { plan: true, taxRule: true, lines: true },
    });
    return apiSuccess(template, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
