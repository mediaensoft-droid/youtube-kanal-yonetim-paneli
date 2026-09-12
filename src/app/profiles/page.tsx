import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { listMembers } from "@/lib/db/members";
import { getUserById } from "@/lib/db/users";
import { ProfilePicker, type ProfileTile } from "./ProfilePicker";

export const dynamic = "force-dynamic";

// Shown right after the Google sign-in (and from the nav): pick who is using the panel.
export default async function ProfilesPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");

  const [members, owner] = await Promise.all([listMembers(actor.workspaceId), getUserById(actor.workspaceId)]);
  const profiles: ProfileTile[] = members
    .filter((m) => m.status === "active")
    .map((m) => ({
      id: m.id,
      displayName: m.displayName,
      username: m.username,
      role: m.role,
      image: m.username === null ? (owner?.image ?? null) : null,
    }));

  return (
    <div className="animate-fade-in-up mx-auto max-w-5xl py-6">
      <h1 className="text-center text-2xl font-semibold text-ink">Paneli kim kullanıyor?</h1>
      <p className="mt-2 mb-8 text-center text-sm text-ink-muted">
        Profilini seç; personel profilleri şifre ister. Hesap sahibi profili Google oturumunla devam eder.
      </p>
      <ProfilePicker profiles={profiles} currentMemberId={actor.memberId} currentIsOwner={actor.isOwner} />
    </div>
  );
}
