import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { retrieveSubscriptionCheckoutForm, type CheckoutFormResult } from "@/lib/iyzico";
import { updateSubscription } from "@/lib/db/subscriptions";

export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// iyzico's checkoutform/complete call (made client-side by the widget) can return before the
// subscription is fully settled on their side — an immediate retrieve can still report the form
// as not-yet-completed. Retry briefly rather than treating that as a hard failure.
async function retrieveWithRetry(token: string): Promise<CheckoutFormResult> {
  let last: CheckoutFormResult | undefined;
  for (const delayMs of [0, 700, 1500, 2500]) {
    if (delayMs) await sleep(delayMs);
    last = await retrieveSubscriptionCheckoutForm(token);
    if (last.status === "success" && last.subscriptionReferenceCode) return last;
  }
  return last!;
}

// iyzico redirects the customer's browser here (POSTing `token`) after the hosted checkout
// form is submitted. This is a cross-site POST from iyzico's own domain, so the SameSite=Lax
// session cookie is NOT sent along with it — we can't rely on getSessionUserId() here. Instead
// we identify the user via `conversationId`, which we set to the userId when initializing the
// checkout form (see /api/billing/checkout) and iyzico echoes back on every response. The
// session lookup is kept only as a defensive fallback.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const formData = await req.formData().catch(() => null);
  const token = formData?.get("token");

  if (typeof token !== "string" || !token) {
    return NextResponse.redirect(`${origin}/billing?status=error`);
  }

  try {
    const result = await retrieveWithRetry(token);
    const userId = Number(result.conversationId) || (await getSessionUserId());
    console.error("[billing/callback] retrieve result", JSON.stringify(result), "userId", userId);

    if (userId && result.status === "success" && result.subscriptionReferenceCode) {
      await updateSubscription(userId, {
        status: "active",
        iyzicoSubscriptionRef: result.subscriptionReferenceCode,
        iyzicoCustomerRef: result.customerReferenceCode ?? null,
      });
      return NextResponse.redirect(`${origin}/billing?status=success`);
    }
  } catch (err) {
    console.error("[billing/callback] error", err);
  }

  return NextResponse.redirect(`${origin}/billing?status=error`);
}
