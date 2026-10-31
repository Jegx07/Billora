import { apiSuccess, handleApiError, AppError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { AiAssistantService } from "@/server/services/ai-assistant.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Invalid JSON request body", 400);
    }

    if (!body || typeof body !== "object") {
      throw new AppError("VALIDATION_ERROR", "Request body must be a JSON object", 400);
    }

    if (body.question === undefined || body.question === null) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Question is required. Please ask a business intelligence question.",
        400
      );
    }

    if (typeof body.question !== "string") {
      throw new AppError("VALIDATION_ERROR", "Question must be a string", 400);
    }

    const trimmed = body.question.trim();
    if (trimmed.length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Question cannot be empty. Please enter a financial or operational query.",
        400
      );
    }

    if (trimmed.length > 1000) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Question exceeds maximum length of 1,000 characters (received ${trimmed.length} characters). Please shorten your query.`,
        400
      );
    }

    const answer = await AiAssistantService.answerQuery(session, trimmed);
    return apiSuccess(answer);
  } catch (error) {
    return handleApiError(error);
  }
}
