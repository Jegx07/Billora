import { calculateVariantUnitPrice, toNumber2 } from "@/lib/money";
import { getOrSetServerCache } from "@/server/cache/query-cache";
import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { CatalogService } from "@/server/services/catalog.service";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const search = (searchParams.get("search") || "").trim();

    const cacheKey = `catalog:products:${status}:${search}`;
    const enriched = await getOrSetServerCache(cacheKey, 60_000, async () => {
      const products = await prisma.product.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search } },
                  { productCode: { contains: search } },
                  { description: { contains: search } },
                ],
              }
            : {}),
        },
        include: {
          variants: {
            orderBy: { additionalPrice: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return products.map((p) => ({
        ...p,
        salesPrice: toNumber2(p.salesPrice),
        costPrice: toNumber2(p.costPrice),
        variants: p.variants.map((v) => ({
          ...v,
          additionalPrice: toNumber2(v.additionalPrice),
          finalUnitPrice: toNumber2(calculateVariantUnitPrice(p.salesPrice, v.additionalPrice)),
        })),
      }));
    });

    return apiSuccess(enriched);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const product = await CatalogService.createProduct(session, body);
    return apiSuccess(product, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN"]);
    const body = await req.json();
    const { id, ...updateData } = body;
    const updated = await CatalogService.updateProduct(session, id, updateData);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
