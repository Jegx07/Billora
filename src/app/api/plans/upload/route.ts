import { AppError, apiSuccess, handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import fs from "fs";
import { NextRequest } from "next/server";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, ["ADMIN"]);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new AppError("VALIDATION_ERROR", "No image file provided", 400);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid file type. Only JPEG, PNG, WebP, SVG, and GIF are supported.",
        400
      );
    }

    // Limit to 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new AppError("VALIDATION_ERROR", "Image size must not exceed 5MB", 400);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "plans");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Sanitize filename
    const ext = path.extname(file.name) || ".png";
    const baseName = path
      .basename(file.name, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();
    const uniqueName = `plan_${Date.now()}_${baseName}${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/plans/${uniqueName}`;

    return apiSuccess({ url: publicUrl }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
