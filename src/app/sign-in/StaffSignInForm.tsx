"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Staff accounts (created by the workspace owner on /team) sign in here; the owner uses Google.
export function StaffSignInForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("staff", { username, password, redirect: false });
    setSubmitting(false);
    if (res?.error) {
      // NextAuth flattens authorize() errors to a code; map the two we throw, default to the generic copy.
      setError(
        res.code === "DISABLED"
          ? "Hesabınız pasif, yöneticinize başvurun"
          : res.code === "NO_ACCESS"
            ? "Çalışma alanının üyeliği sona ermiş. Yöneticinize başvurun."
            : "Kullanıcı adı veya şifre hatalı"
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <KeyRound className="h-4 w-4" /> Personel girişi
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="animate-scale-in mt-2 w-full max-w-sm space-y-3 rounded-lg border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Personel girişi</p>
      <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Kullanıcı adı" autoComplete="username" required />
      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" autoComplete="current-password" required />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Vazgeç</Button>
        <Button type="submit" size="sm" disabled={submitting}>{submitting ? "Giriş yapılıyor..." : "Giriş yap"}</Button>
      </div>
    </form>
  );
}
