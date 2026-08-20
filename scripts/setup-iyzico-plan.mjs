// One-time setup: creates the iyzico subscription product + monthly pricing plan and prints
// the pricing plan reference code to put into IYZICO_PRICING_PLAN_REF_CODE.
//
// Usage:
//   IYZICO_API_KEY=... IYZICO_SECRET_KEY=... IYZICO_BASE_URL=https://sandbox-api.iyzipay.com \
//     node scripts/setup-iyzico-plan.mjs
//
// Run once against sandbox while testing, then once again against production
// (IYZICO_BASE_URL=https://api.iyzipay.com) when going live — each environment needs its own
// product/plan reference codes.

import crypto from "node:crypto";

const BASE_URL = process.env.IYZICO_BASE_URL ?? "https://sandbox-api.iyzipay.com";
const API_KEY = process.env.IYZICO_API_KEY;
const SECRET_KEY = process.env.IYZICO_SECRET_KEY;

if (!API_KEY || !SECRET_KEY) {
  console.error("IYZICO_API_KEY ve IYZICO_SECRET_KEY ortam değişkenlerini ayarlayın.");
  process.exit(1);
}

function authHeader(uriPath, body) {
  const randomKey = `${Date.now()}${crypto.randomBytes(8).toString("hex")}`;
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(randomKey + uriPath + body)
    .digest("hex");
  const authString = `apiKey:${API_KEY}&randomKey:${randomKey}&signature:${signature}`;
  return { authorization: `IYZWSv2 ${Buffer.from(authString).toString("base64")}`, randomKey };
}

async function post(path, payload) {
  const body = JSON.stringify(payload);
  const { authorization, randomKey } = authHeader(path, body);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: authorization, "x-iyzi-rnd": randomKey, "Content-Type": "application/json" },
    body,
  });
  const json = await res.json();
  if (!res.ok || json.status === "failure") {
    throw new Error(`${path} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

const product = await post("/v2/subscription/products", {
  locale: "tr",
  name: "YouTube Kanal Yönetim Paneli Pro",
  description: "Aylık Pro üyelik",
});
console.log("Product created:", product.data.referenceCode);

const plan = await post(`/v2/subscription/products/${product.data.referenceCode}/pricing-plans`, {
  locale: "tr",
  name: "Pro Aylık",
  price: "99.90",
  currencyCode: "TRY",
  paymentInterval: "MONTHLY",
  paymentIntervalCount: 1,
  planPaymentType: "RECURRING",
  trialPeriodDays: 0, // trial is tracked in-app (ensureTrialSubscription), not duplicated on iyzico's side
});
console.log("Pricing plan created:", plan.data.referenceCode);
console.log("\nSet this in your env: IYZICO_PRICING_PLAN_REF_CODE=" + plan.data.referenceCode);
