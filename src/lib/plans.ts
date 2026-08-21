export type PlanId = "free" | "standart" | "pro" | "ultra";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceTRY: number | null;
  channelLimit: number | null;
  description: string;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceTRY: null,
    channelLimit: 10,
    description: "7 gün, Standart plan limitleriyle ücretsiz deneme",
    features: ["10 kanala kadar ekleme", "Tüm dashboard ve trend özellikleri", "7 gün süreyle"],
  },
  {
    id: "standart",
    name: "Standart",
    priceTRY: 149,
    channelLimit: 10,
    description: "Az sayıda kanal yöneten bireysel kullanıcılar için",
    features: ["10 kanala kadar ekleme", "Günlük otomatik yenileme", "Kategori/konsept yönetimi"],
  },
  {
    id: "pro",
    name: "Pro",
    priceTRY: 299,
    channelLimit: 25,
    description: "Büyüyen kanal portföyleri için",
    features: ["25 kanala kadar ekleme", "Günlük otomatik yenileme", "Öncelikli destek"],
  },
  {
    id: "ultra",
    name: "Ultra",
    priceTRY: 599,
    channelLimit: null,
    description: "Ajanslar ve büyük ölçekli operasyonlar için",
    features: [
      "Sınırsız kanal ekleme",
      "Günlük otomatik yenileme",
      "Öncelikli destek",
      "Kanal analiz paneli (yakında)",
    ],
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
