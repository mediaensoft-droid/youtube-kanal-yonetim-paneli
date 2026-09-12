import { okResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { listAllFolders } from "@/lib/db/files";

export const dynamic = "force-dynamic";

/** Flat `{id, name, parentId}[]` of every folder in the workspace — feeds the "move to" picker. */
export async function GET() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const folders = await listAllFolders(actor.workspaceId);
  return okResponse(folders);
}
