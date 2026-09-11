import { requirePageRole } from "@/lib/authz";
import { listMembers } from "@/lib/db/members";
import { ActivityClient } from "./ActivityClient";

export const dynamic = "force-dynamic";

export default async function TeamActivityPage() {
  const actor = await requirePageRole("team.manage");
  const members = await listMembers(actor.workspaceId);

  return <ActivityClient members={members} />;
}
