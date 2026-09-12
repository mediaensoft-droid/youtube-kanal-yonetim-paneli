import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listMembers, getMemberPasswordHash } from "@/lib/db/members";
import { getUserById } from "@/lib/db/users";
import { ProfilePicker, type ProfileTile } from "./ProfilePicker";

export const dynamic = "force-dynamic";

// Shown right after the Google sign-in (and from the nav): pick who is using the panel.
export default async function ProfilesPage() {
  // Uses the raw session on purpose: a locked owner must still reach this page to unlock.
  const session = await auth();
  if (!session?.user?.id || !session.member) redirect("/sign-in");
  const actor = { workspaceId: Number(session.user.id), memberId: session.member.id, isOwner: session.member.isOwner, unlocked: session.member.unlocked };

  const [members, owner] = await Promise.all([listMembers(actor.workspaceId), getUserById(actor.workspaceId)]);
  const ownerRow = members.find((m) => m.username === null);
  const ownerHasPassword = ownerRow ? Boolean(await getMemberPasswordHash(ownerRow.id)) : false;
  const profiles: ProfileTile[] = members
    .filter((m) => m.status === "active")
    .map((m) => ({
      id: m.id,
      displayName: m.displayName,
      username: m.username,
      role: m.role,
      image: m.username === null ? (owner?.image ?? null) : m.image,
    }));

  return (
    <div className="animate-fade-in-up mx-auto max-w-5xl py-6">
      <h1 className="text-center text-2xl font-semibold text-ink">Paneli kim kullanıyor?</h1>
      <p className="mt-2 mb-8 text-center text-sm text-ink-muted">
        Profilini seç; her profil kendi şifresini ister.
      </p>
      <ProfilePicker
        profiles={profiles}
        currentMemberId={actor.memberId}
        currentIsOwner={actor.isOwner}
        ownerLocked={actor.isOwner && !actor.unlocked}
        ownerHasPassword={ownerHasPassword}
      />
    </div>
  );
}
