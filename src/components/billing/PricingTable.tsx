"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { PLANS, type PlanId } from "@/lib/plans";
import { Button } from "@/components/ui/Button";
import { CheckoutForm } from "@/components/billing/CheckoutForm";

interface PricingTableProps {
  currentPlan: string;
  currentStatus: string;
}

export function PricingTable({ currentPlan, currentStatus }: PricingTableProps) {
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanId, "free"> | null>(null);

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = currentStatus === "active" && currentPlan === plan.id;
          const isFree = plan.id === "free";
          return (
            <div
              key={plan.id}
              className={clsx(
                "flex flex-col rounded-lg border p-5",
                isCurrent ? "border-brand bg-brand-soft" : "border-line bg-surface"
              )}
            >
              <h3 className="text-sm font-semibold text-ink-muted">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                {isFree ? (
                  <span className="text-2xl font-bold text-ink">Ücretsiz</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-ink">{plan.priceTRY}₺</span>
                    <span className="text-xs text-ink-faint">/ay</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-muted">{plan.description}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-xs text-ink-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    {feature}
                  </li>
                ))}
              </ul>

              {!isFree && (
                <Button
                  variant={isCurrent ? "secondary" : "primary"}
                  disabled={isCurrent}
                  onClick={() => setSelectedPlan(plan.id as Exclude<PlanId, "free">)}
                  className="mt-5 w-full justify-center"
                >
                  {isCurrent ? "Mevcut planınız" : "Bu planı seç"}
                </Button>
              )}
              {isFree && (
                <div className="mt-5 w-full rounded-md border border-line px-4 py-2 text-center text-sm text-ink-faint">
                  {currentStatus === "trialing" ? "Aktif deneme" : "Kayıt sırasında otomatik"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink-muted">
            {PLANS.find((p) => p.id === selectedPlan)?.name} plana geç
          </h2>
          <CheckoutForm plan={selectedPlan} />
        </div>
      )}
    </div>
  );
}
