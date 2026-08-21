import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId, auth } from "@/lib/auth";
import { billingCheckoutSchema } from "@/lib/validation";
import { initializeSubscriptionCheckoutForm, IyzicoApiError } from "@/lib/iyzico";
import { getIyzicoPricingPlanEnvVarName } from "@/lib/plans";
import { updateSubscription } from "@/lib/db/subscriptions";

export const dynamic = "force-dynamic";

// iyzico expects gsmNumber in +90XXXXXXXXXX (E.164-style) form, not a bare local number.
function normalizeGsmNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("90") ? digits.slice(2) : digits.replace(/^0/, "");
  return `+90${local}`;
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const session = await auth();
  const email = session?.user?.email;
  if (!email) return errorResponse(400, "Hesabınızda e-posta bulunamadı.");

  const json = await req.json().catch(() => null);
  const parsed = billingCheckoutSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }
  const { plan, name, surname, gsmNumber, identityNumber, address, city, zipCode } = parsed.data;

  const pricingPlanReferenceCode = process.env[getIyzicoPricingPlanEnvVarName(plan)];
  if (!pricingPlanReferenceCode) {
    return errorResponse(500, `${getIyzicoPricingPlanEnvVarName(plan)} tanımlı değil.`);
  }

  const origin = req.nextUrl.origin;

  try {
    // Record the chosen plan before initiating checkout so the callback (which only flips
    // status to "active") doesn't need to smuggle the plan through iyzico's redirect.
    await updateSubscription(userId, { plan });

    const result = await initializeSubscriptionCheckoutForm({
      pricingPlanReferenceCode,
      callbackUrl: `${origin}/api/billing/callback`,
      conversationId: String(userId),
      customer: {
        name,
        surname,
        email,
        gsmNumber: normalizeGsmNumber(gsmNumber),
        identityNumber,
        billingAddress: {
          contactName: `${name} ${surname}`,
          address,
          city,
          country: "Turkey",
          zipCode,
        },
      },
    });
    return okResponse(result);
  } catch (err) {
    if (err instanceof IyzicoApiError) {
      return errorResponse(502, err.message);
    }
    return errorResponse(500, "Beklenmeyen bir hata oluştu.");
  }
}
