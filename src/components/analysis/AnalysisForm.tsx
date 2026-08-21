"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ChannelAnalysisResult } from "@/app/api/analysis/route";

const COLUMNS: { key: keyof ChannelAnalysisResult; label: string }[] = [
  { key: "channelName", label: "Kanal" },
  { key: "targetAgeGroup", label: "Hedef Yaş Kitlesi" },
  { key: "targetCountry", label: "Hedef Ülke" },
  { key: "thumbnailQuality", label: "Kapak Görseli Kalitesi" },
  { key: "textQuality", label: "Metin Kalitesi" },
  { key: "audienceFit", label: "Kitle Uyumu" },
  { key: "languageGaps", label: "Dil Boşlukları" },
  { key: "rpm", label: "RPM" },
];

export function AnalysisForm() {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ChannelAnalysisResult[]>([]);

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

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {COLUMNS.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-3 py-2 font-medium text-ink-muted">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-ink-faint">
                  Henüz analiz edilmiş kanal yok.
                </td>
              </tr>
            ) : (
              results.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-3 py-2 text-ink">
                      {Array.isArray(row[col.key])
                        ? (row[col.key] as string[]).join(", ")
                        : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
