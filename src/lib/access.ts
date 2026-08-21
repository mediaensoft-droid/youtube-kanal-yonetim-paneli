import "server-only";
import { getUserById } from "@/lib/db/users";
import { getSubscriptionByUserId } from "@/lib/db/subscriptions";
import { getPlan, type PlanId } from "@/lib/plans";

/**
 * Whether a user may perform quota-consuming actions (adding/refreshing channels).
 * Read-only access (viewing existing channels) is never gated on this — only checked
 * at the specific write endpoints that consume YouTube API quota.
 */
export async function hasActiveAccess(userId: number): Promise<boolean> {
  const user = await getUserById(userId);
  if (user && process.env.OWNER_EMAIL && user.email === process.env.OWNER_EMAIL) {
    return true;
  }

  const sub = await getSubscriptionByUserId(userId);
  if (!sub) return false;

  const now = Date.now();
  if (sub.status === "trialing") {
    return !sub.trialEndsAt || new Date(sub.trialEndsAt).getTime() > now;
  }
  if (sub.status === "active") {
    return !sub.currentPeriodEnd || new Date(sub.currentPeriodEnd).getTime() > now;
  }
  return false;
}

/**
 * Max channels the user may have. `null` means unlimited. Owner account and lapsed/no
 * subscription are handled by hasActiveAccess() already; this only decides the cap while access
 * is granted, so a lapsed user (limit 0 here) never reaches this without failing that check first.
 */
export async function getChannelLimit(userId: number): Promise<number | null> {
  const user = await getUserById(userId);
  if (user && process.env.OWNER_EMAIL && user.email === process.env.OWNER_EMAIL) {
    return null;
  }

  const sub = await getSubscriptionByUserId(userId);
  if (!sub) return 0;

  if (sub.status === "trialing") {
    return getPlan("free").channelLimit;
  }
  if (sub.status === "active") {
    const planId = (["standart", "pro", "ultra"] as PlanId[]).includes(sub.plan as PlanId)
      ? (sub.plan as PlanId)
      : "standart";
    return getPlan(planId).channelLimit;
  }
  return 0;
}
