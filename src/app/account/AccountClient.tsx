"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface AccountClientProps {
  displayName: string;
  username: string;
  roleLabel: string;
}

export function AccountClient({ displayName, username, roleLabel }: AccountClientProps) {
  const router = useRouter();

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
