"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { KeyRound, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ROLE_LABELS, type MemberRole } from "@/lib/roles";

export interface ProfileTile {
  id: number;
  displayName: string;
  username: string | null;
  role: MemberRole;
  image: string | null;
}

interface ProfilePickerProps {
  profiles: ProfileTile[];
  currentMemberId: number;
  currentIsOwner: boolean;
  /** Owner session that still has to enter the profile password. */
  ownerLocked: boolean;
  ownerHasPassword: boolean;
}

const TILE_COLORS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

// Netflix-style "who is using the panel?" screen shown right after the Google sign-in. Picking a
// staff profile asks for that person's password and swaps the session to them (same Credentials
// flow as the sign-in page); the owner tile simply continues as the Google account.
export function ProfilePicker({ profiles, currentMemberId, currentIsOwner, ownerLocked, ownerHasPassword }: ProfilePickerProps) {
  const router = useRouter();
  const { update } = useSession();
  const [selected, setSelected] = useState<ProfileTile | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function initial(name: string) {
    return name.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";
  }

  function handleTileClick(profile: ProfileTile) {
    if (profile.username === null) {
      // Owner tile: an unlocked owner just continues; a locked one (or one without a password yet)
      // goes through the password modal; a staff session needs a fresh Google sign-in first.
      if (!currentIsOwner) {
        void signIn("google", { redirectTo: "/profiles" });
        return;
      }
      if (!ownerLocked || !ownerHasPassword) {
        router.push("/");
        router.refresh();
        return;
      }
      setSelected(profile);
      setPassword("");
      setError(null);
      return;
    }
    if (profile.id === currentMemberId) {
      router.push("/");
      router.refresh();
      return;
    }
    setSelected(profile);
    setPassword("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      if (selected.username === null) {
        const res = await fetch("/api/profiles/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Şifre hatalı");
          return;
        }
        // Pull the refreshed JWT into the client session before navigating.
        await update();
        router.push("/");
        router.refresh();
        return;
      }
      const res = await signIn("staff", { username: selected.username, password, redirect: false });
      if (!res || res.error) {
        setError(
          res?.code === "DISABLED"
            ? "Bu hesap pasif, yöneticinize başvurun"
            : res?.code === "NO_ACCESS"
              ? "Çalışma alanının üyeliği sona ermiş."
              : "Şifre hatalı"
        );
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="stagger grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {profiles.map((profile, index) => {
          const isCurrent = profile.id === currentMemberId;
          const color = TILE_COLORS[index % TILE_COLORS.length];
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleTileClick(profile)}
              className="group flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-black/40"
            >
              {profile.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.image}
                  alt={profile.displayName}
                  className="h-28 w-28 rounded-2xl object-cover ring-2 ring-line transition-all duration-200 group-hover:ring-brand"
                />
              ) : (
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-2xl text-5xl font-bold text-white ring-2 ring-line transition-all duration-200 group-hover:ring-brand"
                  style={{ backgroundColor: color }}
                >
                  {initial(profile.displayName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-ink">{profile.displayName}</p>
                <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-ink-muted">
                  {profile.username === null ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" /> Hesap sahibi
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-3.5 w-3.5" /> {ROLE_LABELS[profile.role]}
                    </>
                  )}
                </p>
                {isCurrent && !(profile.username === null && ownerLocked) && (
                  <p className="mt-1 text-xs font-medium text-brand">Şu anki oturum</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected &&
        createPortal(
          <div
            className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => !submitting && setSelected(null)}
          >
            <form
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="animate-scale-in w-full max-w-sm rounded-lg border border-line-strong bg-surface-2 p-5 shadow-2xl shadow-black/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-ink">{selected.displayName}</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {selected.username === null ? "Hesap sahibi" : `@${selected.username} · ${ROLE_LABELS[selected.role]}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Kapat"
                  className="rounded-md p-1 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="mt-4 block text-sm font-medium text-ink">Şifre</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-label="Şifre"
                autoFocus
                required
                className="mt-1"
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(null)} disabled={submitting}>
                  Vazgeç
                </Button>
                <Button type="submit" size="sm" disabled={submitting || password.length === 0}>
                  {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
                </Button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
