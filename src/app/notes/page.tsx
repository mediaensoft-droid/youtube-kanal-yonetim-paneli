import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { listNotes } from "@/lib/db/notes";
import { listMembers } from "@/lib/db/members";
import { NotesClient } from "./NotesClient";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");

  const isOwner = actor.role === "yonetici";

  const [notes, members] = await Promise.all([
    listNotes(actor.workspaceId, actor.memberId),
    isOwner ? listMembers(actor.workspaceId) : Promise.resolve([]),
  ]);

  // The owner can read staff notes, but never another owner's (there is only ever one owner per
  // workspace anyway) — filter here so the client never even sees a "yonetici" option to pick.
  const staffMembers = members.filter((member) => member.role !== "yonetici");

  return (
    <NotesClient
      initialNotes={notes}
      members={staffMembers.map((member) => ({ id: member.id, displayName: member.displayName }))}
      currentMemberId={actor.memberId}
      isOwner={isOwner}
    />
  );
}
