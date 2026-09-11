import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/authz";
import { getUserById } from "@/lib/db/users";
import { getSubscriptionByUserId } from "@/lib/db/subscriptions";
import { ProfileClient } from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const actor = await requirePageRole("billing.view");
  const userId = actor.workspaceId;

  const [user, subscription] = await Promise.all([
    getUserById(userId),
    getSubscriptionByUserId(userId),
  ]);
  if (!user) redirect("/sign-in");

  return <ProfileClient user={user} subscription={subscription ?? null} />;
}
