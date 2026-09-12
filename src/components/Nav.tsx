"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import clsx from "clsx";
import {
  LayoutDashboard,
  Tv,
  Menu,
  X,
  LogOut,
  CreditCard,
  CalendarDays,
  ClipboardList,
  StickyNote,
  FolderOpen,
  MessageSquare,
  UserRound,
  Users,
} from "lucide-react";
import { UnreadBadge } from "@/components/UnreadBadge";

const BASE_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/channels", label: "Kanallar", icon: Tv },
  { href: "/calendar", label: "Takvim", icon: CalendarDays },
  { href: "/tasks", label: "Görevler", icon: ClipboardList },
  { href: "/notes", label: "Notlarım", icon: StickyNote },
  { href: "/files", label: "Belgeler", icon: FolderOpen },
  { href: "/messages", label: "Mesajlar", icon: MessageSquare },
];

const OWNER_ONLY_LINKS = [
  { href: "/team", label: "Personel", icon: Users },
  { href: "/billing", label: "Üyelik", icon: CreditCard },
];

function BrandMark() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" className="shrink-0">
      <rect width="26" height="18" rx="6" fill="#FF0000" />
      <path d="M10.5 5.5L17 9L10.5 12.5V5.5Z" fill="white" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useSession();
  const role = session?.member?.role;
  const isOwner = role === "yonetici";
  const links = isOwner ? [...BASE_LINKS, ...OWNER_ONLY_LINKS] : BASE_LINKS;
  const accountHref = isOwner ? "/profile" : "/account";
  const accountLabel = isOwner ? "Profil" : "Hesabım";

  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
      <div className="flex items-center gap-1 px-4 py-3 sm:px-6 lg:px-8">
        <div className="mr-5 flex flex-1 items-center gap-2 sm:flex-initial">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-ink">Kanal Paneli</span>
        </div>

        {session?.user && (
          <div className="hidden items-center gap-1 sm:flex">
            {links.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-brand text-white shadow-[0_0_0_1px_rgba(255,0,0,0.35)]"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {href === "/messages" && <UnreadBadge />}
                </Link>
              );
            })}
          </div>
        )}

        {session?.user && (
          <div className="hidden items-center gap-2 border-l border-line pl-3 ml-1 sm:flex">
            <Link
              href={accountHref}
              title={accountLabel}
              className="rounded-full transition-opacity duration-150 hover:opacity-80"
            >
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? session.user.email ?? "Kullanıcı"}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover text-xs text-ink-muted">
                  {(session.user.name ?? session.user.email ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/sign-in" })}
              aria-label="Çıkış yap"
              className="flex items-center justify-center rounded-md p-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}

        {session?.user && (
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
            className="flex items-center justify-center rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink sm:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
      </div>

      {menuOpen && session?.user && (
        <div className="animate-fade-in border-t border-line px-4 py-2 sm:hidden">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={clsx(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  active ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {href === "/messages" && <UnreadBadge />}
              </Link>
            );
          })}
          {session?.user && (
            <>
              <Link
                href={accountHref}
                onClick={() => setMenuOpen(false)}
                className={clsx(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  pathname.startsWith(accountHref)
                    ? "bg-brand text-white"
                    : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                )}
              >
                <UserRound className="h-4 w-4" />
                {accountLabel}
              </Link>
              <button
                type="button"
                onClick={() => signOut({ redirectTo: "/sign-in" })}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
                Çıkış yap
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
