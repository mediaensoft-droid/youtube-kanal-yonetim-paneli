"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Category, Concept, Channel } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { MultiSelect } from "@/components/MultiSelect";
import { LANGUAGES } from "@/lib/constants/languages";
import { COUNTRIES, countryFlagEmoji } from "@/lib/constants/countries";
import { WEEKDAYS } from "@/lib/weekdays";
import clsx from "clsx";

const languageOptions = LANGUAGES.map((l) => ({ code: l.code, label: l.name }));
const countryOptions = COUNTRIES.map((c) => ({
  code: c.code,
  label: c.name,
  icon: countryFlagEmoji(c.code),
}));

interface ChannelFormProps {
  mode: "create" | "edit";
  categories: Category[];
  concepts: Concept[];
  initialChannel?: Channel;
}

export function ChannelForm({ mode, categories, concepts, initialChannel }: ChannelFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [categoryId, setCategoryId] = useState<string>(
    initialChannel?.categoryId != null ? String(initialChannel.categoryId) : ""
  );
  const [conceptId, setConceptId] = useState<string>(
    initialChannel?.conceptId != null ? String(initialChannel.conceptId) : ""
  );
  const [languages, setLanguages] = useState<string[]>(initialChannel?.languages ?? []);
  const [countries, setCountries] = useState<string[]>(initialChannel?.countries ?? []);
  const [notes, setNotes] = useState(initialChannel?.notes ?? "");
  const [publishDays, setPublishDays] = useState<number[]>(initialChannel?.publishDays ?? []);

  function togglePublishDay(iso: number) {
    setPublishDays((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "create") {
        const res = await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input,
            categoryId: categoryId ? Number(categoryId) : null,
            conceptId: conceptId ? Number(conceptId) : null,
            languages,
            countries,
            notes: notes || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kanal eklenemedi");
        toast.success(`${data.name} eklendi`);
        router.push("/channels");
        router.refresh();
      } else {
        const res = await fetch(`/api/channels/${initialChannel!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: categoryId ? Number(categoryId) : null,
            conceptId: conceptId ? Number(conceptId) : null,
            languages,
            countries,
            notes: notes || null,
            publishDays,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kanal güncellenemedi");
        toast.success("Kanal güncellendi");
        router.push("/channels");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {mode === "create" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            YouTube kanal URL&apos;si veya ID&apos;si
          </label>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.youtube.com/@kanaladi veya UCxxxxxxxxxxxxxxxxxxxxxx"
            required
          />
          <p className="mt-1 text-xs text-ink-faint">
            Abone sayısı, video sayısı, ad ve thumbnail YouTube&apos;dan otomatik çekilecek.
          </p>
        </div>
      )}

      {mode === "edit" && initialChannel && (
        <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={initialChannel.thumbnailUrl}
            alt={initialChannel.name}
            className="h-10 w-10 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-medium text-ink">{initialChannel.name}</p>
            <p className="text-xs text-ink-faint">
              YouTube verileri &quot;Yenile&quot; butonuyla güncellenir
            </p>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Kategori</label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Kategorisiz</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Konsept</label>
        <Select value={conceptId} onChange={(e) => setConceptId(e.target.value)}>
          <option value="">Konseptsiz</option>
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Diller</label>
        <MultiSelect
          options={languageOptions}
          value={languages}
          onChange={setLanguages}
          placeholder="Dil seçin..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Hedef Ülkeler</label>
        <MultiSelect
          options={countryOptions}
          value={countries}
          onChange={setCountries}
          placeholder="Ülke seçin..."
        />
      </div>

      {mode === "edit" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Yayın Günleri</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => {
              const active = publishDays.includes(day.iso);
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => togglePublishDay(day.iso)}
                  className={clsx(
                    "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink"
                  )}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            Bu kanalın hangi günler video yayınlayacağını belirler, Takvim sayfasında gösterilir.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Notlar</label>
        <Textarea rows={3} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={() => router.push("/channels")}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Kaydediliyor..." : mode === "create" ? "Kanalı Ekle" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
