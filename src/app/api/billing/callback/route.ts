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
    if (last.status === "success" && last.data?.referenceCode) return last;
  }
  return last!;
}

// iyzico redirects the customer's browser here (POSTing `token`) after the hosted checkout
// form is submitted. `conversationId` (set to the userId at initialize time) is preferred for
// identifying the user, falling back to the session cookie — in practice iyzico's response
// hasn't echoed conversationId back on this endpoint, so the session fallback is what actually
// resolves the user; kept as a fallback in case that changes.
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

    if (userId && result.status === "success" && result.data?.referenceCode) {
      await updateSubscription(userId, {
        status: "active",
        iyzicoSubscriptionRef: result.data.referenceCode,
        iyzicoCustomerRef: result.data.customerReferenceCode ?? null,
      });
      return NextResponse.redirect(`${origin}/billing?status=success`);
    }
    console.error("[billing/callback] did not resolve to success", JSON.stringify(result), "userId", userId);
  } catch (err) {
    console.error("[billing/callback] error", err);
  }

  return NextResponse.redirect(`${origin}/billing?status=error`);
}
