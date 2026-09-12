import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { getMemberById } from "@/lib/db/members";
import { ROLE_LABELS } from "@/lib/roles";
import { AccountClient } from "./AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");
  if (actor.isOwner) redirect("/profile");

  const member = await getMemberById(actor.memberId);
  if (!member) redirect("/sign-in");

  return (
    <AccountClient
      displayName={member.displayName}
      username={member.username ?? ""}
      roleLabel={ROLE_LABELS[member.role]}
      image={member.image}
    />
  );
}
