import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { retrieveSubscriptionCheckoutForm } from "@/lib/iyzico";
import { updateSubscription } from "@/lib/db/subscriptions";

export const dynamic = "force-dynamic";

// iyzico redirects the customer's browser here (POSTing `token`) after the hosted checkout
// form is submitted. We look up the real result server-side rather than trusting the redirect.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const formData = await req.formData().catch(() => null);
  const token = formData?.get("token");

  if (typeof token !== "string" || !token) {
    return NextResponse.redirect(`${origin}/billing?status=error`);
  }

  const userId = await getSessionUserId();

  try {
    const result = await retrieveSubscriptionCheckoutForm(token);
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
