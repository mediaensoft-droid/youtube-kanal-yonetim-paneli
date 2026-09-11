import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { updateCategorySchema } from "@/lib/validation";
import { getCategoryById, updateCategory, deleteCategory } from "@/lib/db/categories";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("taxonomy.write");
  if (isResponse(actor)) return actor;
  const userId = actor.workspaceId;

  const { id } = await params;
  const categoryId = Number(id);
  const existing = await getCategoryById(userId, categoryId);
  if (!existing) return errorResponse(404, "Kategori bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  try {
    const category = await updateCategory(userId, categoryId, parsed.data);
    await logActivity(
      { workspaceId: userId, memberId: actor.memberId },
      {
        action: "category.update",
        entityType: "category",
        entityId: category.id,
        entityName: category.name,
      }
    );
    return okResponse(category);
  } catch {
    return errorResponse(409, "Bu isimde bir kategori zaten var.");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("taxonomy.write");
  if (isResponse(actor)) return actor;
  const userId = actor.workspaceId;

  const { id } = await params;
  const categoryId = Number(id);
  const existing = await getCategoryById(userId, categoryId);
  if (!existing) return errorResponse(404, "Kategori bulunamadı");

  await deleteCategory(userId, categoryId);

  await logActivity(
    { workspaceId: userId, memberId: actor.memberId },
    {
      action: "category.delete",
      entityType: "category",
      entityId: categoryId,
      entityName: existing.name,
    }
  );

  return new Response(null, { status: 204 });
}
