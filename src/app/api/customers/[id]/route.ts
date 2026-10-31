import { prisma } from "@/server/db/client";
import { apiSuccess, handleApiError } from "@/server/errors";
import { assertCustomerAccess, requireAuth } from "@/server/middlewares/auth";
import { AuthService } from "@/server/services/auth.service";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const customer = await AuthService.getCustomerById(session, id);
    return apiSuccess(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    assertCustomerAccess(session, id);

    const body = await req.json();
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
        ...(body.companyName !== undefined ? { companyName: body.companyName } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.gstin !== undefined ? { gstin: body.gstin } : {}),
        ...(body.billingAddress !== undefined ? { billingAddress: body.billingAddress } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.state !== undefined ? { state: body.state } : {}),
        ...(body.postalCode !== undefined ? { postalCode: body.postalCode } : {}),
      },
    });
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
