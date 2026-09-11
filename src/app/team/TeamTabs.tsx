"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Users, Activity } from "lucide-react";

// Sub-navigation of the Personel area, same visual pattern as ChannelsTabs.
const TABS = [
  { href: "/team", label: "Personel", icon: Users },
  { href: "/team/activity", label: "Hareketler", icon: Activity },
];

export function TeamTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 overflow-x-auto overflow-y-hidden border-b border-line">
      <div className="flex min-w-max items-center gap-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                active
                  ? "border-brand text-ink"
                  : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
