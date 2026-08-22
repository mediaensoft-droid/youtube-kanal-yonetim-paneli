"use client";

import { useState } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import {
  Search,
  Users,
  Globe2,
  DollarSign,
  TrendingUp,
  Languages,
  Image as ImageIcon,
  FileText,
  Heart,
  Tv,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCompactNumber } from "@/lib/format";
import type { ChannelAnalysisResult } from "@/app/api/analysis/route";

function scoreFromText(text: string): number | null {
  const match = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*10/);
  return match ? Number(match[1]) : null;
}

function scoreNoteFromText(text: string): string {
  const idx = text.indexOf("—");
  return idx === -1 ? text : text.slice(idx + 1).trim();
}

function scoreColorClass(score: number | null): string {
  if (score === null) return "text-ink-faint";
  if (score >= 8) return "text-emerald-400";
  if (score >= 5) return "text-amber-400";
  return "text-red-400";
}

function sentimentColorClass(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("positive")) return "text-emerald-400";
  if (lower.includes("negative")) return "text-red-400";
  return "text-ink-muted";
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}

function StatCard({ icon, label, value, valueClassName }: StatCardProps) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4 transition-all duration-200 hover:border-line-strong hover:-translate-y-0.5">
      <div className="flex items-center gap-2 text-ink-faint">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={clsx("mt-2 text-sm font-semibold", valueClassName ?? "text-ink")}>{value}</p>
    </div>
  );
}

function AudienceFitCard({
  audienceFit,
  loading,
  onFetch,
}: {
  audienceFit: string | null;
  loading: boolean;
  onFetch: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4 transition-all duration-200 hover:border-line-strong hover:-translate-y-0.5">
      <div className="flex items-center gap-2 text-ink-faint">
        <Heart className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Kitle Uyumu</span>
      </div>
      {audienceFit ? (
        <p className={clsx("mt-2 text-sm font-semibold", sentimentColorClass(audienceFit))}>{audienceFit}</p>
      ) : (
        <button
          type="button"
          onClick={onFetch}
          disabled={loading}
          className="mt-2 text-xs font-medium text-brand transition-colors duration-150 hover:text-brand-hover disabled:text-ink-faint"
        >
          {loading ? "Getiriliyor…" : "Kitle Uyumunu Getir →"}
        </button>
      )}
    </div>
  );
}

function QualityCard({
  icon,
  label,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
}) {
  const score = scoreFromText(text);
  const note = text === "—" ? "Veri yok" : scoreNoteFromText(text);
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4 transition-all duration-200 hover:border-line-strong hover:-translate-y-0.5 sm:col-span-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-faint">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        {score !== null && (
          <span className={clsx("text-sm font-bold", scoreColorClass(score))}>{score}/10</span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{note}</p>
    </div>
  );
}

function ResultCard({
  result,
  audienceFitLoading,
  onFetchAudienceFit,
}: {
  result: ChannelAnalysisResult;
  audienceFitLoading: boolean;
  onFetchAudienceFit: () => void;
}) {
  return (
    <div className="animate-fade-in-up rounded-xl border border-line bg-surface p-5 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Tv className="h-4 w-4" />
        </div>
        <h3 className="text-lg font-semibold text-ink">{result.channelName}</h3>
        {result.fromCache && (
          <span className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-faint">
            <Database className="h-3 w-3" /> önbellek
          </span>
        )}
      </div>

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Users className="h-3.5 w-3.5" />} label="Hedef Yaş Kitlesi" value={result.targetAgeGroup} />
        <StatCard icon={<Globe2 className="h-3.5 w-3.5" />} label="Hedef Ülke" value={result.targetCountry} />
        <StatCard
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Aylık Gelir (tahmini)"
          value={result.monthlyRevenue !== null ? `$${formatCompactNumber(result.monthlyRevenue)}` : "—"}
          valueClassName="text-emerald-400"
        />
        <StatCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="RPM"
          value={result.rpm !== null ? `$${result.rpm}` : "—"}
        />
        <AudienceFitCard
          audienceFit={result.audienceFit}
          loading={audienceFitLoading}
          onFetch={onFetchAudienceFit}
        />
        <StatCard
          icon={<Languages className="h-3.5 w-3.5" />}
          label="Dil Boşlukları"
          value={result.languageGaps.length > 0 ? result.languageGaps.join(", ") : "Belirgin boşluk yok"}
        />
        <QualityCard icon={<ImageIcon className="h-3.5 w-3.5" />} label="Kapak Görseli Kalitesi" text={result.thumbnailQuality} />
        <QualityCard icon={<FileText className="h-3.5 w-3.5" />} label="Metin Kalitesi" text={result.textQuality} />
      </div>
    </div>
  );
}

export function AnalysisForm({ initialResults = [] }: { initialResults?: ChannelAnalysisResult[] }) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ChannelAnalysisResult[]>(initialResults);
  const [audienceFitLoadingIds, setAudienceFitLoadingIds] = useState<Record<string, boolean>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Analiz başarısız oldu.");
        return;
      }
      setResults((prev) => [data, ...prev]);
      setUrl("");
    } catch {
      toast.error("Analiz başarısız oldu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFetchAudienceFit(channelId: string) {
    setAudienceFitLoadingIds((prev) => ({ ...prev, [channelId]: true }));
    try {
      const res = await fetch("/api/analysis/audience-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Kitle uyumu getirilemedi.");
        return;
      }
      setResults((prev) =>
        prev.map((r) => (r.channelId === channelId ? { ...r, audienceFit: data.audienceFit } : r))
      );
    } catch {
      toast.error("Kitle uyumu getirilemedi.");
    } finally {
      setAudienceFitLoadingIds((prev) => ({ ...prev, [channelId]: false }));
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="YouTube kanal linki yapıştırın"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={submitting}>
          <Search className="h-4 w-4" />
          {submitting ? "Analiz ediliyor…" : "Analiz Et"}
        </Button>
      </form>

      <div className="stagger mt-6 flex flex-col gap-4">
        {results.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface p-10 text-center text-sm text-ink-faint">
            Henüz analiz edilmiş kanal yok.
          </div>
        ) : (
          results.map((result, i) => (
            <ResultCard
              key={`${result.channelId}-${i}`}
              result={result}
              audienceFitLoading={audienceFitLoadingIds[result.channelId] ?? false}
              onFetchAudienceFit={() => handleFetchAudienceFit(result.channelId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
