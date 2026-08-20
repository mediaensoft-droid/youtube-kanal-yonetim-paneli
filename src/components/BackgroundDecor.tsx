"use client";

import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { Play, ThumbsUp, Bell, MessageCircle, Share2, Eye } from "lucide-react";

interface IconProps {
  width: number;
  height: number;
  className?: string;
  strokeWidth?: number;
}

function PlayBadge({ width, className }: IconProps) {
  return (
    <svg width={width} height={width * 0.7} viewBox="0 0 26 18" className={className}>
      <rect width="26" height="18" rx="6" className="fill-current" />
      <path d="M10.5 5.5L17 9L10.5 12.5V5.5Z" fill="var(--canvas)" />
    </svg>
  );
}

const ICON_DEFS = [
  { Icon: PlayBadge, left: 8, top: 14, size: 26 },
  { Icon: Play, left: 24, top: 74, size: 18 },
  { Icon: ThumbsUp, left: 60, top: 18, size: 20 },
  { Icon: Bell, left: 84, top: 60, size: 20 },
  { Icon: MessageCircle, left: 46, top: 48, size: 19 },
  { Icon: Share2, left: 14, top: 46, size: 18 },
  { Icon: Eye, left: 92, top: 16, size: 22 },
  { Icon: PlayBadge, left: 36, top: 86, size: 22 },
  { Icon: Play, left: 70, top: 90, size: 17 },
  { Icon: ThumbsUp, left: 4, top: 62, size: 18 },
  { Icon: Bell, left: 55, top: 78, size: 17 },
  { Icon: MessageCircle, left: 78, top: 34, size: 19 },
];

const FLEE_DISTANCE = 55;

export function BackgroundDecor() {
  const [offsets, setOffsets] = useState<Record<number, { x: number; y: number }>>({});

  function handleEnter(i: number, e: ReactMouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - e.clientX;
    const dy = cy - e.clientY;
    const dist = Math.hypot(dx, dy) || 1;
    setOffsets((prev) => ({
      ...prev,
      [i]: { x: (dx / dist) * FLEE_DISTANCE, y: (dy / dist) * FLEE_DISTANCE },
    }));
  }

  function handleLeave(i: number) {
    setOffsets((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="animated-gradient absolute inset-0" />

      <div className="animate-drift-a absolute -top-40 -left-40 h-80 w-80 rounded-full bg-brand/[0.07] blur-[100px]" />
      <div className="animate-drift-b absolute top-1/3 -right-40 h-72 w-72 rounded-full bg-brand/[0.06] blur-[100px]" />
      <div className="animate-drift-c absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-red-700/[0.08] blur-[100px]" />

      {ICON_DEFS.map((def, i) => {
        const offset = offsets[i];
        return (
          <div
            key={i}
            className="pointer-events-auto absolute cursor-default transition-transform duration-300 ease-out"
            style={{
              left: `${def.left}%`,
              top: `${def.top}%`,
              transform: offset ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
            }}
            onMouseEnter={(e) => handleEnter(i, e)}
            onMouseLeave={() => handleLeave(i)}
          >
            <div
              className="animate-float-icon"
              style={{
                animationDelay: `${(i % 6) * 0.6}s`,
                animationDuration: `${15 + (i % 5) * 2}s`,
              }}
            >
              <def.Icon
                width={def.size}
                height={def.size}
                className="text-brand/[0.16]"
                strokeWidth={1.5}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
