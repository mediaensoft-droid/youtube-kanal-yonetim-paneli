"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutDashboard, Tv, Layers, Lightbulb } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/channels", label: "Kanallar", icon: Tv },
  { href: "/categories", label: "Kategoriler", icon: Layers },
  { href: "/concepts", label: "Konseptler", icon: Lightbulb },
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

  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
        <div className="mr-5 flex items-center gap-2">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-ink">Kanal Paneli</span>
        </div>
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                active ? "bg-brand text-white shadow-[0_0_0_1px_rgba(255,0,0,0.35)]" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
