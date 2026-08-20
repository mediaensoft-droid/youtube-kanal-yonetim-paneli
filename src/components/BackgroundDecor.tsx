"use client";

import { useEffect, useRef } from "react";
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

const ICON_POOL = [PlayBadge, Play, ThumbsUp, Bell, MessageCircle, Share2, Eye];
const ICON_COUNT = 100;

// Deterministic pseudo-random scatter (no Math.random) so server- and client-rendered output match.
function seeded(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return Math.abs(v - Math.floor(v));
}

const ICON_DEFS = Array.from({ length: ICON_COUNT }, (_, i) => ({
  Icon: ICON_POOL[i % ICON_POOL.length],
  left: 3 + seeded(i * 2 + 1) * 92,
  top: 5 + seeded(i * 2 + 2) * 90,
  size: 14 + (i % 5) * 3,
}));

const FLEE_RADIUS = 140;
const FLEE_STRENGTH = 55;

export function BackgroundDecor() {
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let rafId: number | null = null;
    let pointer: { x: number; y: number } | null = null;

    function applyFlee() {
      rafId = null;
      if (!pointer) return;
      const { x, y } = pointer;
      const { innerWidth, innerHeight } = window;

      iconRefs.current.forEach((el, i) => {
        if (!el) return;
        const def = ICON_DEFS[i];
        const baseX = (def.left / 100) * innerWidth;
        const baseY = (def.top / 100) * innerHeight;
        const dx = baseX - x;
        const dy = baseY - y;
        const dist = Math.hypot(dx, dy);

        if (dist < FLEE_RADIUS && dist > 0.01) {
          const push = (1 - dist / FLEE_RADIUS) * FLEE_STRENGTH;
          el.style.transform = `translate(${(dx / dist) * push}px, ${(dy / dist) * push}px)`;
        } else {
          el.style.transform = "";
        }
      });
    }

    function handleMouseMove(e: MouseEvent) {
      pointer = { x: e.clientX, y: e.clientY };
      if (rafId === null) rafId = requestAnimationFrame(applyFlee);
    }

    // Tracks the cursor at the document level rather than per-icon hover: the icons sit behind
    // the page content (-z-10), so foreground elements would otherwise intercept every pointer
    // event before it ever reached them.
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="animated-gradient absolute inset-0" />

      <div className="animate-drift-a absolute -top-40 -left-40 h-80 w-80 rounded-full bg-brand/[0.07] blur-[100px]" />
      <div className="animate-drift-b absolute top-1/3 -right-40 h-72 w-72 rounded-full bg-brand/[0.06] blur-[100px]" />
      <div className="animate-drift-c absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-red-700/[0.08] blur-[100px]" />

      {ICON_DEFS.map((def, i) => (
        <div
          key={i}
          ref={(el) => {
            iconRefs.current[i] = el;
          }}
          className="absolute transition-transform duration-200 ease-out"
          style={{ left: `${def.left}%`, top: `${def.top}%` }}
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
              className="text-white/[0.14]"
              strokeWidth={1.5}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
