import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { verifySubscriptionWebhookSignature } from "@/lib/iyzico";
import { updateSubscriptionByIyzicoRef } from "@/lib/db/subscriptions";

export const dynamic = "force-dynamic";

interface SubscriptionWebhookPayload {
  iyziEventType?: string;
  eventType?: string;
  subscriptionReferenceCode?: string;
  orderReferenceCode?: string;
  customerReferenceCode?: string;
}

// Server-to-server notification from iyzico for subscription events (payment succeeded/failed,
// canceled). Not session-authenticated — verified via the X-IYZ-SIGNATURE-V3 HMAC header instead,
// the same pattern used by the CRON_SECRET-gated cron endpoint for its own non-session caller.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-iyz-signature-v3");
  const body = (await req.json().catch(() => null)) as SubscriptionWebhookPayload | null;
  if (!body || !signature) return errorResponse(400, "Geçersiz istek");

  const eventType = body.iyziEventType ?? body.eventType ?? "";
  const subscriptionReferenceCode = body.subscriptionReferenceCode ?? "";
  const orderReferenceCode = body.orderReferenceCode ?? "";
  const customerReferenceCode = body.customerReferenceCode ?? "";

  const isValid = verifySubscriptionWebhookSignature({
    eventType,
    subscriptionReferenceCode,
    orderReferenceCode,
    customerReferenceCode,
    signature,
  });
  if (!isValid) return errorResponse(401, "Geçersiz imza");

  if (!subscriptionReferenceCode) return okResponse({ received: true });

  if (eventType === "subscription.order.success") {
    await updateSubscriptionByIyzicoRef(subscriptionReferenceCode, { status: "active" });
  } else if (eventType === "subscription.order.failure") {
    await updateSubscriptionByIyzicoRef(subscriptionReferenceCode, { status: "past_due" });
  }

  return okResponse({ received: true });
}
