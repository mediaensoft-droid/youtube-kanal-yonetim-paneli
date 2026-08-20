import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId, auth } from "@/lib/auth";
import { billingCheckoutSchema } from "@/lib/validation";
import { initializeSubscriptionCheckoutForm, IyzicoApiError } from "@/lib/iyzico";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const session = await auth();
  const email = session?.user?.email;
  if (!email) return errorResponse(400, "Hesabınızda e-posta bulunamadı.");

  const pricingPlanReferenceCode = process.env.IYZICO_PRICING_PLAN_REF_CODE;
  if (!pricingPlanReferenceCode) {
    return errorResponse(500, "IYZICO_PRICING_PLAN_REF_CODE tanımlı değil.");
  }

  const json = await req.json().catch(() => null);
  const parsed = billingCheckoutSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }
  const { name, surname, gsmNumber, identityNumber, address, city, zipCode } = parsed.data;

  const origin = req.nextUrl.origin;

  try {
    const result = await initializeSubscriptionCheckoutForm({
      pricingPlanReferenceCode,
      callbackUrl: `${origin}/api/billing/callback`,
      conversationId: String(userId),
      customer: {
        name,
        surname,
        email,
        gsmNumber,
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
