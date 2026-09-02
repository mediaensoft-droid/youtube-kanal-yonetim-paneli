import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getUserById } from "@/lib/db/users";
import { getSubscriptionByUserId } from "@/lib/db/subscriptions";
import { ProfileClient } from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [user, subscription] = await Promise.all([
    getUserById(userId),
    getSubscriptionByUserId(userId),
  ]);
  if (!user) redirect("/sign-in");

  return <ProfileClient user={user} subscription={subscription ?? null} />;
}
