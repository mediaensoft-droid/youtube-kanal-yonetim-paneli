export type PlanId = "free" | "standart" | "pro" | "ultra";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceTRY: number | null;
  channelLimit: number | null;
  /** Separate allowance for planned (reference) channels — they never eat into channelLimit. */
  plannedChannelLimit: number | null;
  description: string;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceTRY: null,
    channelLimit: 10,
    plannedChannelLimit: 10,
    description: "7 gün, Standart plan limitleriyle ücretsiz deneme",
    features: ["10 kanala kadar ekleme", "10 planlanan (referans) kanal", "7 gün süreyle"],
  },
  {
    id: "standart",
    name: "Standart",
    priceTRY: 149,
    channelLimit: 10,
    plannedChannelLimit: 10,
    description: "Az sayıda kanal yöneten bireysel kullanıcılar için",
    features: ["10 kanala kadar ekleme", "10 planlanan (referans) kanal", "Günlük otomatik yenileme"],
  },
  {
    id: "pro",
    name: "Pro",
    priceTRY: 299,
    channelLimit: 25,
    plannedChannelLimit: 25,
    description: "Büyüyen kanal portföyleri için",
    features: ["25 kanala kadar ekleme", "25 planlanan (referans) kanal", "Öncelikli destek"],
  },
  {
    id: "ultra",
    name: "Ultra",
    priceTRY: 599,
    channelLimit: null,
    plannedChannelLimit: null,
    description: "Ajanslar ve büyük ölçekli operasyonlar için",
    features: ["Sınırsız kanal ekleme", "Sınırsız planlanan kanal", "Öncelikli destek"],
  },
];

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS.find((p) => p.id === id)!;
}

const IYZICO_PRICING_PLAN_ENV_VARS: Record<Exclude<PlanId, "free">, string> = {
  standart: "IYZICO_PRICING_PLAN_REF_CODE_STANDART",
  pro: "IYZICO_PRICING_PLAN_REF_CODE_PRO",
  ultra: "IYZICO_PRICING_PLAN_REF_CODE_ULTRA",
};

export function getIyzicoPricingPlanEnvVarName(plan: Exclude<PlanId, "free">): string {
  return IYZICO_PRICING_PLAN_ENV_VARS[plan];
}
