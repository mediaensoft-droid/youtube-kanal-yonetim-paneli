import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { createCategorySchema } from "@/lib/validation";
import { listCategories, createCategory } from "@/lib/db/categories";

export const dynamic = "force-dynamic";

export async function GET() {
  return okResponse(await listCategories());
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  try {
    const category = await createCategory(parsed.data);
    return okResponse(category, 201);
  } catch {
    return errorResponse(409, "Bu isimde bir kategori zaten var.");
  }
}
