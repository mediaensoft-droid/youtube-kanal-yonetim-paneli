import { redirect } from "next/navigation";
import { Tv, Layers, Globe2, MapPin, Clock, PieChart } from "lucide-react";
import { getSessionUserId } from "@/lib/auth";
import { listChannels } from "@/lib/db/channels";
import { listCategories } from "@/lib/db/categories";
import { countByCategory, countByLanguage, countByCountryFull } from "@/lib/stats";
import { StatTile } from "@/components/StatTile";
import { CategoryDistributionChart } from "@/components/charts/CategoryDistributionChart";
import { LanguageDistributionChart } from "@/components/charts/LanguageDistributionChart";
import { CountryMapSection } from "@/components/charts/CountryMapSection";
import { WorldClocks } from "@/components/charts/WorldClocks";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [channels, categories] = await Promise.all([listChannels(userId), listCategories(userId)]);

  const categoryData = countByCategory(channels, categories);
  const languageData = countByLanguage(channels);
  const countryData = countByCountryFull(channels);

  return (
    <div className="animate-fade-in-up">
      <h1 className="mb-6 text-2xl font-semibold text-ink">Dashboard</h1>

      <div className="stagger mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Toplam Kanal" value={channels.length} icon={<Tv className="h-5 w-5" />} />
        <StatTile
          label="Kategori Sayısı"
          value={categories.length}
          icon={<Layers className="h-5 w-5" />}
        />
        <StatTile
          label="Kullanılan Dil / Ülke"
          value={`${languageData.filter((d) => d.code !== "OTHER").length} / ${countryData.length}`}
          icon={<Globe2 className="h-5 w-5" />}
        />
      </div>

      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/20">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
            <PieChart className="animate-breathe h-4 w-4" /> Kategoriye Göre Dağılım
          </h2>
          <CategoryDistributionChart data={categoryData} />
        </div>

        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/20">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
            <Globe2 className="animate-breathe h-4 w-4" /> Dile Göre Dağılım
          </h2>
          <LanguageDistributionChart data={languageData} />
        </div>

        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/20 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
            <MapPin className="animate-breathe h-4 w-4" /> Ülkeye Göre Dağılım
          </h2>
          <CountryMapSection data={countryData} />
        </div>

        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/20 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
            <Clock className="animate-breathe h-4 w-4" /> Ülke Saatleri
          </h2>
          <WorldClocks data={countryData} />
        </div>
      </div>
    </div>
  );
}
