import { toNumber2 } from "@/lib/money";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { DiscountService } from "@/server/services/discount.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const discounts = await prisma.discount.findMany({
      include: {
        products: { include: { product: true } },
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(
      discounts.map((d) => ({
        ...d,
        value: toNumber2(d.value),
        minPurchaseAmount: toNumber2(d.minPurchaseAmount),
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
    const discount = await DiscountService.createDiscount(session, body);
    return apiSuccess(discount, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const { id, isActive } = body;
    const updated = await prisma.discount.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
