import "server-only";
import { getUserById } from "@/lib/db/users";
import { getSubscriptionByUserId } from "@/lib/db/subscriptions";

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
