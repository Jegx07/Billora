import { toNumber2 } from "@/lib/money";
import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { QuotationService } from "@/server/services/quotation.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await req.json();
    const preview = await QuotationService.computePricingPreview({
      lines: body.lines || [],
      discountCode: body.discountCode || null,
    });

    return apiSuccess({
      subtotal: toNumber2(preview.subtotal),
      discountId: preview.discountId,
      discountCode: preview.discountCode,
      discountAmount: toNumber2(preview.discountAmount),
      taxAmount: toNumber2(preview.taxAmount),
      totalAmount: toNumber2(preview.totalAmount),
      lines: preview.lines.map((l) => ({
        ...l,
        baseUnitPrice: toNumber2(l.baseUnitPrice),
        variantPriceDelta: toNumber2(l.variantPriceDelta),
        unitPrice: toNumber2(l.unitPrice),
        taxRateSnapshot: toNumber2(l.taxRateSnapshot),
        lineSubtotal: toNumber2(l.lineSubtotal),
        lineDiscountAmount: toNumber2(l.lineDiscountAmount),
        lineTaxAmount: toNumber2(l.lineTaxAmount),
        lineTotal: toNumber2(l.lineTotal),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
