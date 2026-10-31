import { apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { AiAssistantService } from "@/server/services/ai-assistant.service";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req, ["ADMIN", "EMPLOYEE"]);
    const body = await req.json();
    const answer = await AiAssistantService.answerQuery(
      session,
      String(body.question || "What is our MRR?")
    );
    return apiSuccess(answer);
  } catch (error) {
    return handleApiError(error);
  }
}
