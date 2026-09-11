"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Tv, EyeOff, Layers, Lightbulb, Telescope } from "lucide-react";

interface ChannelsTabsProps {
  passiveCount: number;
  plannedCount: number;
}

// Sub-navigation of the Kanallar hub. Categories and concepts used to be top-level nav items; they
// only exist to organise channels, so they live here now alongside the passive-channel list.
export function ChannelsTabs({ passiveCount, plannedCount }: ChannelsTabsProps) {
  const pathname = usePathname();

  const tabs = [
    { href: "/channels", label: "Kanallar", icon: Tv, badge: null },
    { href: "/channels/passive", label: "Pasif Kanallar", icon: EyeOff, badge: passiveCount || null },
    { href: "/channels/planned", label: "Planlanan Kanallar", icon: Telescope, badge: plannedCount || null },
    { href: "/channels/categories", label: "Kategoriler", icon: Layers, badge: null },
    { href: "/channels/concepts", label: "Konseptler", icon: Lightbulb, badge: null },
  ];

  return (
    <div className="mb-6 overflow-x-auto border-b border-line">
      <div className="flex min-w-max items-center gap-1">
        {tabs.map(({ href, label, icon: Icon, badge }) => {
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
              {badge !== null && (
                <span
                  className={clsx(
                    "rounded-full px-1.5 text-xs",
                    active ? "bg-brand-soft text-brand" : "bg-surface-hover text-ink-muted"
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
