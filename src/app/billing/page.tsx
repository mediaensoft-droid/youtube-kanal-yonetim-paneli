import { redirect } from "next/navigation";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { getSessionUserId } from "@/lib/auth";
import { getSubscriptionByUserId } from "@/lib/db/subscriptions";
import { hasActiveAccess } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { CheckoutForm } from "@/components/billing/CheckoutForm";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  trialing: "Deneme süresi",
  active: "Aktif",
  past_due: "Ödeme sorunu",
  canceled: "İptal edildi",
};

export default async function BillingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [subscription, active] = await Promise.all([
    getSubscriptionByUserId(userId),
    hasActiveAccess(userId),
  ]);

  return (
    <div className="animate-fade-in-up mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-ink">Üyelik</h1>

      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          {active ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <CreditCard className="h-5 w-5 text-ink-muted" />
          )}
          <span className="font-medium text-ink">
            Durum: {subscription ? (STATUS_LABELS[subscription.status] ?? subscription.status) : "—"}
          </span>
        </div>
        {subscription?.status === "trialing" && subscription.trialEndsAt && (
          <p className="mt-2 text-sm text-ink-muted">
            Deneme süreniz {formatDate(subscription.trialEndsAt)} tarihinde sona eriyor.
          </p>
        )}
        {subscription?.status === "active" && (
          <p className="mt-2 text-sm text-ink-muted">Pro plan aktif — kanal ekleme/yenileme sınırsız.</p>
        )}
        {!active && (
          <p className="mt-2 text-sm text-ink-muted">
            Deneme süreniz doldu ya da aktif bir üyeliğiniz yok. Yeni kanal eklemek/yenilemek için
            aşağıdan Pro plana geçebilirsiniz.
          </p>
        )}
      </div>

      {!active && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink-muted">Pro plana geç</h2>
          <CheckoutForm />
        </div>
      )}
    </div>
  );
}
