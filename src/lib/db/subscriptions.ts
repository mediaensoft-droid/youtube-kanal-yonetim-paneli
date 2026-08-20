import "server-only";
import { all, get, run } from "@/lib/db";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Subscription {
  id: number;
  userId: number;
  plan: string;
  status: SubscriptionStatus;
  iyzicoSubscriptionRef: string | null;
  iyzicoCustomerRef: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getSubscriptionByUserId(userId: number): Promise<Subscription | undefined> {
  return get<Subscription>(`SELECT * FROM subscriptions WHERE userId = ?`, [userId]);
}

export async function getSubscriptionByIyzicoRef(
  iyzicoSubscriptionRef: string
): Promise<Subscription | undefined> {
  return get<Subscription>(`SELECT * FROM subscriptions WHERE iyzicoSubscriptionRef = ?`, [
    iyzicoSubscriptionRef,
  ]);
}

/** Idempotent: a user has at most one subscription row (UNIQUE userId). No-ops if one already exists. */
export async function ensureTrialSubscription(
  userId: number,
  trialDays = 7
): Promise<Subscription> {
  const existing = await getSubscriptionByUserId(userId);
  if (existing) return existing;

  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
  await run(
    `INSERT INTO subscriptions (userId, plan, status, trialEndsAt) VALUES (?, 'pro', 'trialing', ?)
     ON CONFLICT(userId) DO NOTHING`,
    [userId, trialEndsAt]
  );
  return (await getSubscriptionByUserId(userId))!;
}

export interface SubscriptionUpdate {
  status?: SubscriptionStatus;
  iyzicoSubscriptionRef?: string | null;
  iyzicoCustomerRef?: string | null;
  currentPeriodEnd?: string | null;
}

export async function updateSubscription(
  userId: number,
  input: SubscriptionUpdate
): Promise<Subscription> {
  await ensureTrialSubscription(userId);
  const existing = (await getSubscriptionByUserId(userId))!;

  const status = input.status ?? existing.status;
  const iyzicoSubscriptionRef =
    input.iyzicoSubscriptionRef !== undefined
      ? input.iyzicoSubscriptionRef
      : existing.iyzicoSubscriptionRef;
  const iyzicoCustomerRef =
    input.iyzicoCustomerRef !== undefined ? input.iyzicoCustomerRef : existing.iyzicoCustomerRef;
  const currentPeriodEnd =
    input.currentPeriodEnd !== undefined ? input.currentPeriodEnd : existing.currentPeriodEnd;

  await run(
    `UPDATE subscriptions
       SET status = ?, iyzicoSubscriptionRef = ?, iyzicoCustomerRef = ?, currentPeriodEnd = ?,
           updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE userId = ?`,
    [status, iyzicoSubscriptionRef, iyzicoCustomerRef, currentPeriodEnd, userId]
  );
  return (await getSubscriptionByUserId(userId))!;
}

export async function updateSubscriptionByIyzicoRef(
  iyzicoSubscriptionRef: string,
  input: SubscriptionUpdate
): Promise<Subscription | undefined> {
  const existing = await getSubscriptionByIyzicoRef(iyzicoSubscriptionRef);
  if (!existing) return undefined;
  return updateSubscription(existing.userId, input);
}

export async function listAllSubscriptions(): Promise<Subscription[]> {
  return all<Subscription>(`SELECT * FROM subscriptions ORDER BY userId ASC`);
}
