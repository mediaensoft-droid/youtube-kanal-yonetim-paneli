import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { retrieveSubscriptionCheckoutForm } from "@/lib/iyzico";
import { updateSubscription } from "@/lib/db/subscriptions";

export const dynamic = "force-dynamic";

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
    const result = await retrieveSubscriptionCheckoutForm(token);
    const userId = Number(result.conversationId) || (await getSessionUserId());

    if (userId && result.status === "success" && result.subscriptionReferenceCode) {
      await updateSubscription(userId, {
        status: "active",
        iyzicoSubscriptionRef: result.subscriptionReferenceCode,
        iyzicoCustomerRef: result.customerReferenceCode ?? null,
      });
      return NextResponse.redirect(`${origin}/billing?status=success`);
    }
  } catch {
    // fall through to error redirect below
  }

  return NextResponse.redirect(`${origin}/billing?status=error`);
}
