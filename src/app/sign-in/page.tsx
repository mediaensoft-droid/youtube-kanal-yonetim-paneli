import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  RefreshCw,
  Sparkles,
  Check,
  Globe2,
} from "lucide-react";
import { getSessionUserId } from "@/lib/auth";
import { countAllChannels } from "@/lib/db/channels";
import { PLANS } from "@/lib/plans";
import { CardShapes } from "@/components/CardShapes";
import { SignInButton } from "./SignInButton";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Tek Panelden Portföy Görünümü",
    description:
      "Onlarca kanalı kategori, dil ve hedef ülkeye göre tek dashboard'da görün — hangi kanal nerede, kaç dilde yayında, anında anlaşılır.",
  },
  {
    icon: CalendarDays,
    title: "Yayın Takvimi",
    description:
      "Her kanal için haftalık yayın günü deseni tanımlayın, aylık takvimde planlandı/yayınlandı/atlandı durumunu takip edin.",
  },
  {
    icon: RefreshCw,
    title: "Otomatik İstatistik Yenileme",
    description:
      "Abone, görüntülenme ve video sayıları otomatik güncellenir; her kanalın büyüme trendini zaman içinde izleyin.",
  },
  {
    icon: Sparkles,
    title: "AI Destekli Kanal Analizi",
    description:
      "Ultra planda: NexLev verisi ve Claude ile kitle uyumu, RPM ve gelir tahmini — kanal başına derinlemesine analiz.",
  },
];

export default async function SignInPage() {
  const userId = await getSessionUserId();
  if (userId) redirect("/");

  const channelCount = await countAllChannels();

  return (
    <div className="animate-fade-in-up">
      {/* Hero */}
      <section className="grid grid-cols-1 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            YouTube Kanal Yönetimi
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl">
            Onlarca YouTube kanalını tek panelden yönetin
          </h1>
          <p className="mt-4 max-w-lg text-base text-ink-muted">
            Kategoriye, dile ve ülkeye göre kanal portföyünüzü tek ekranda görün, yayın
            takvimini planlayın, istatistikleri otomatik takip edin — dağınık tablolara
            gerek kalmadan.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <SignInButton size="lg" />
            <p className="text-xs text-ink-faint">Ücretsiz deneyin, kredi kartı gerekmez.</p>
          </div>

          {channelCount > 0 && (
            <div className="mt-8 flex items-center gap-2 text-sm text-ink-muted">
              <Globe2 className="h-4 w-4 shrink-0 text-brand" />
              Şu anda platformda gerçek kullanımda:{" "}
              <span className="font-semibold text-ink">{channelCount} kanal</span>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden="true">
            <CardShapes seed={7} count={6} />
          </div>
          <div className="relative z-10 overflow-hidden rounded-lg border border-line-strong bg-surface shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marketing/dashboard-preview.jpg"
              alt="Kanal Paneli Dashboard ekranı — kategoriye, dile ve ülkeye göre gerçek kanal dağılımı"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="stagger grid grid-cols-1 gap-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-lg border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/20"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section className="py-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-ink">Fiyatlandırma</h2>
          <p className="mt-2 text-sm text-ink-muted">
            İhtiyacınıza göre bir plan seçin — istediğiniz zaman değiştirebilirsiniz.
          </p>
        </div>

        <div className="stagger mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/20"
            >
              <h3 className="text-sm font-semibold text-ink-muted">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                {plan.priceTRY === null ? (
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
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <SignInButton size="lg" />
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-xs text-ink-faint">
        Kanal Paneli — YouTube kanal portföy yönetimi.
      </footer>
    </div>
  );
}
