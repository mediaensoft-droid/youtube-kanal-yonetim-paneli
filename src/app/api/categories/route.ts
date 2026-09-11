import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { requirePermission, isResponse } from "@/lib/authz";
import { createCategorySchema } from "@/lib/validation";
import { listCategories, createCategory } from "@/lib/db/categories";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");
  return okResponse(await listCategories(userId));
}

export async function POST(req: NextRequest) {
  const actor = await requirePermission("taxonomy.write");
  if (isResponse(actor)) return actor;
  const userId = actor.workspaceId;

  const json = await req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  try {
    const category = await createCategory(userId, parsed.data);
    await logActivity(
      { workspaceId: userId, memberId: actor.memberId },
      {
        action: "category.create",
        entityType: "category",
        entityId: category.id,
        entityName: category.name,
      }
    );
    return okResponse(category, 201);
  } catch {
    return errorResponse(409, "Bu isimde bir kategori zaten var.");
  }
}
