import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { listFolderContents } from "@/lib/db/files";
import { can } from "@/lib/roles";
import { FilesClient } from "./FilesClient";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");

  const contents = await listFolderContents(actor.workspaceId, null);

  return (
    <FilesClient
      initialFolders={contents.folders}
      initialFiles={contents.files}
      initialBreadcrumb={contents.breadcrumb}
      canWrite={can(actor.role, "files.write")}
      canDelete={can(actor.role, "files.delete")}
    />
  );
}
