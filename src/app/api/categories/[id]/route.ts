import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { updateCategorySchema } from "@/lib/validation";
import { getCategoryById, updateCategory, deleteCategory } from "@/lib/db/categories";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const categoryId = Number(id);
  const existing = await getCategoryById(categoryId);
  if (!existing) return errorResponse(404, "Kategori bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  try {
    const category = await updateCategory(categoryId, parsed.data);
    return okResponse(category);
  } catch {
    return errorResponse(409, "Bu isimde bir kategori zaten var.");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const categoryId = Number(id);
  const existing = await getCategoryById(categoryId);
  if (!existing) return errorResponse(404, "Kategori bulunamadı");

  await deleteCategory(categoryId);
  return new Response(null, { status: 204 });
}
