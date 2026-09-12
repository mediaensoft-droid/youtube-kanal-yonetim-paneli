"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Camera, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface AccountClientProps {
  displayName: string;
  username: string;
  roleLabel: string;
  image: string | null;
}

export function AccountClient({ displayName, username, roleLabel, image: initialImage }: AccountClientProps) {
  const router = useRouter();
  const { update } = useSession();
  const [image, setImage] = useState<string | null>(initialImage);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/account/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Yükleme başarısız oldu");
      setImage(data.image);
      await update();
      router.refresh();
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
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kaldırılamadı");
      setImage(null);
      await update();
      router.refresh();
      toast.success("Profil fotoğrafı kaldırıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaldırılamadı");
    } finally {
      setUploading(false);
    }
  }


  const [name, setName] = useState(displayName);
  const [currentName, setCurrentName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const nameChanged = name.trim() !== currentName && name.trim().length > 0;

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Ad boş olamaz");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi");
      setCurrentName(trimmed);
      setName(trimmed);
      router.refresh();
      toast.success("Ad güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== newPasswordRepeat) {
      toast.error("Yeni şifreler eşleşmiyor");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Şifre güncellenemedi");
      }
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordRepeat("");
      toast.success("Şifre güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre güncellenemedi");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="animate-fade-in-up mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-ink">Hesabım</h1>

      <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-5">
          <div className="group relative h-24 w-24 shrink-0">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={currentName} className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-hover text-3xl font-semibold text-ink-muted">
                {currentName.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?"}
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
            <p className="text-lg font-semibold text-ink">{currentName}</p>
            <p className="truncate text-sm text-ink-muted">@{username}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Camera className="h-3.5 w-3.5" />
                {uploading ? "Yükleniyor..." : "Fotoğraf değiştir"}
              </Button>
              {image && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto} disabled={uploading}>
                  <Trash2 className="h-3.5 w-3.5" /> Kaldır
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-faint">Kullanıcı adı</p>
            <p className="text-sm text-ink">@{username}</p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">Rol</p>
            <p className="text-sm text-ink">{roleLabel}</p>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="mt-6 border-t border-line pt-5">
          <label className="mb-1.5 block text-sm font-medium text-ink">Görünen ad</label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <Button type="submit" disabled={!nameChanged || savingName}>
              {savingName ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </form>
      </div>

      <div className="mt-4 rounded-lg border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-ink">Şifre değiştir</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Mevcut şifre</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Yeni şifre</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Yeni şifre (tekrar)</label>
            <Input
              type="password"
              value={newPasswordRepeat}
              onChange={(e) => setNewPasswordRepeat(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                savingPassword || !currentPassword || newPassword.length < 8 || !newPasswordRepeat
              }
            >
              {savingPassword ? "Kaydediliyor..." : "Şifreyi güncelle"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
