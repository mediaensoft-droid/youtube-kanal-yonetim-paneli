"use client";

import { useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, LogOut, Trash2, CreditCard } from "lucide-react";
import type { AppUser } from "@/lib/db/users";
import type { Subscription } from "@/lib/db/subscriptions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/format";
import { getPlan, type PlanId } from "@/lib/plans";

interface ProfileClientProps {
  user: AppUser;
  subscription: Subscription | null;
}

const STATUS_LABELS: Record<string, string> = {
  trialing: "Deneme süresi",
  active: "Aktif",
  past_due: "Ödeme sorunu",
  canceled: "İptal edildi",
};

export function ProfileClient({ user, subscription }: ProfileClientProps) {
  const { update } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState(user.image);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [savingName, setSavingName] = useState(false);

  const planId: PlanId = (["free", "standart", "pro", "ultra"] as PlanId[]).includes(
    subscription?.plan as PlanId
  )
    ? (subscription!.plan as PlanId)
    : "free";
  const plan = getPlan(planId);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Yükleme başarısız oldu");
      setImage(data.image);
      await update();
      toast.success("Profil fotoğrafı güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükleme başarısız oldu");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    setUploading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kaldırılamadı");
      setImage(null);
      await update();
      toast.success("Profil fotoğrafı kaldırıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaldırılamadı");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("İsim boş olamaz");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi");
      await update();
      toast.success("İsim güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSavingName(false);
    }
  }

  const initial = (user.name ?? user.email).charAt(0).toUpperCase();
  const nameChanged = name.trim() !== (user.name ?? "") && name.trim().length > 0;

  return (
    <div className="animate-fade-in-up mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-ink">Profil</h1>

      <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="group relative h-24 w-24 shrink-0">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={user.name ?? user.email}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-hover text-3xl font-semibold text-ink-muted">
                {initial}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Fotoğrafı değiştir"
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition-colors duration-150 group-hover:bg-black/50 group-hover:text-white disabled:pointer-events-none"
            >
              <Camera className="h-6 w-6" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-ink">{user.name ?? "İsimsiz kullanıcı"}</p>
            <p className="truncate text-sm text-ink-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-3.5 w-3.5" />
                {uploading ? "Yükleniyor..." : "Fotoğraf değiştir"}
              </Button>
              {image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePhoto}
                  disabled={uploading}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Kaldır
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <label className="mb-1.5 block text-sm font-medium text-ink">Görünen isim</label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            <Button onClick={handleSaveName} disabled={!nameChanged || savingName}>
              {savingName ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            Google hesabınızdaki isimden bağımsız olarak burada değiştirebilirsiniz.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-faint">E-posta</p>
            <p className="text-sm text-ink">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">Üye olma tarihi</p>
            <p className="text-sm text-ink">{formatDate(user.createdAt)}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
          <div>
            <p className="text-xs text-ink-faint">Plan</p>
            <p className="text-sm text-ink">
              {plan.name}
              {subscription && (
                <span className="ml-1.5 text-ink-faint">
                  · {STATUS_LABELS[subscription.status] ?? subscription.status}
                </span>
              )}
            </p>
          </div>
          <Link href="/billing">
            <Button type="button" variant="secondary" size="sm">
              <CreditCard className="h-3.5 w-3.5" /> Üyeliği Yönet
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="danger" size="sm" onClick={() => signOut({ redirectTo: "/sign-in" })}>
          <LogOut className="h-3.5 w-3.5" /> Çıkış yap
        </Button>
      </div>
    </div>
  );
}
