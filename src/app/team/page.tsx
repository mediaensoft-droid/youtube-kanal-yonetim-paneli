import { requirePageRole } from "@/lib/authz";
import { listMembers } from "@/lib/db/members";
import { TeamClient } from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const actor = await requirePageRole("team.manage");
  const members = await listMembers(actor.workspaceId);

  return <TeamClient initialMembers={members} />;
}
