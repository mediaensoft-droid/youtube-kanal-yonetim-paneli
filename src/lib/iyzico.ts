import "server-only";
import crypto from "node:crypto";

// iyzico Subscription API (v2). The official `iyzipay` npm SDK predates this API and does not
// support it, so requests are built and signed by hand here per iyzico's documented IYZWSv2 scheme:
// https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth
const BASE_URL =
  process.env.IYZICO_BASE_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://api.iyzipay.com"
    : "https://sandbox-api.iyzipay.com");

export class IyzicoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "IyzicoApiError";
  }
}

function buildAuthorizationHeader(uriPath: string, requestBody: string) {
  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error("IYZICO_API_KEY / IYZICO_SECRET_KEY tanımlı değil.");
  }

  const randomKey = `${Date.now()}${crypto.randomBytes(8).toString("hex")}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(randomKey + uriPath + requestBody)
    .digest("hex");
  const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  const base64Authorization = Buffer.from(authorizationString).toString("base64");

  return { authorization: `IYZWSv2 ${base64Authorization}`, randomKey };
}

async function iyzicoRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const requestBody = body ? JSON.stringify(body) : "";
  const { authorization, randomKey } = buildAuthorizationHeader(path, requestBody);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: authorization,
      "x-iyzi-rnd": randomKey,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? requestBody : undefined,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status === "failure") {
    throw new IyzicoApiError(json?.errorMessage ?? `iyzico isteği başarısız (HTTP ${res.status})`, res.status, json);
  }
  return json as T;
}

export interface IyzicoCustomer {
  name: string;
  surname: string;
  email: string;
  gsmNumber: string;
  identityNumber: string;
  billingAddress: {
    contactName: string;
    address: string;
    city: string;
    country: string;
    zipCode?: string;
  };
}

export interface CheckoutFormInitializeResult {
  token: string;
  checkoutFormContent: string;
  tokenExpireTime: number;
}

export async function initializeSubscriptionCheckoutForm(params: {
  pricingPlanReferenceCode: string;
  callbackUrl: string;
  customer: IyzicoCustomer;
  conversationId?: string;
}): Promise<CheckoutFormInitializeResult> {
  return iyzicoRequest<CheckoutFormInitializeResult>("POST", "/v2/subscription/checkoutform/initialize", {
    locale: "tr",
    pricingPlanReferenceCode: params.pricingPlanReferenceCode,
    subscriptionInitialStatus: "ACTIVE",
    callbackUrl: params.callbackUrl,
    customer: params.customer,
    conversationId: params.conversationId,
  });
}

export interface CheckoutFormResult {
  status: string;
  conversationId?: string;
  data?: {
    referenceCode?: string;
    parentReferenceCode?: string;
    customerReferenceCode?: string;
    subscriptionStatus?: string;
    pricingPlanReferenceCode?: string;
  };
}

export async function retrieveSubscriptionCheckoutForm(token: string): Promise<CheckoutFormResult> {
  return iyzicoRequest<CheckoutFormResult>("GET", `/v2/subscription/checkoutform/${token}`);
}

export interface IyzicoSubscription {
  referenceCode: string;
  subscriptionStatus: string;
  pricingPlanReferenceCode: string;
  customerReferenceCode: string;
}

export async function getSubscription(referenceCode: string): Promise<IyzicoSubscription> {
  return iyzicoRequest<IyzicoSubscription>("GET", `/v2/subscription/subscriptions/${referenceCode}`);
}

export async function cancelSubscription(referenceCode: string): Promise<void> {
  await iyzicoRequest("POST", `/v2/subscription/subscriptions/${referenceCode}/cancel`);
}

/**
 * Verifies the X-IYZ-SIGNATURE-V3 header on incoming subscription webhooks.
 * https://docs.iyzico.com/en/advanced/webhook
 */
export function verifySubscriptionWebhookSignature(params: {
  eventType: string;
  subscriptionReferenceCode: string;
  orderReferenceCode: string;
  customerReferenceCode: string;
  signature: string;
}): boolean {
  const merchantId = process.env.IYZICO_MERCHANT_ID;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  if (!merchantId || !secretKey) return false;

  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(
      merchantId +
        secretKey +
        params.eventType +
        params.subscriptionReferenceCode +
        params.orderReferenceCode +
        params.customerReferenceCode
    )
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
  } catch {
    return false;
  }
}
