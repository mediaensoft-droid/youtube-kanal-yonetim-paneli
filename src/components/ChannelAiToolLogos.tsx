"use client";

import { useState } from "react";
import { getAiTool, toolLogoUrl } from "@/lib/aiTools";

interface ChannelAiToolLogosProps {
  toolIds: string[];
  /** Logos shown before collapsing the rest into a "+N" chip. */
  max?: number;
  /** Logo size in pixels. */
  size?: number;
}

function ToolLogo({ toolId, size }: { toolId: string; size: number }) {
  const tool = getAiTool(toolId);
  const [failed, setFailed] = useState(false);
  if (!tool) return null;

  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      title={tool.name}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 overflow-hidden rounded-sm transition-transform duration-150 hover:scale-110"
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span
          className="flex h-full w-full items-center justify-center bg-surface-hover text-[11px] font-semibold leading-none text-ink-muted"
          aria-hidden
        >
          {tool.name.charAt(0).toUpperCase()}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={toolLogoUrl(tool)}
          alt={tool.name}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </a>
  );
}

export function ChannelAiToolLogos({ toolIds, max = 6, size = 16 }: ChannelAiToolLogosProps) {
  if (toolIds.length === 0) return null;

  const shown = toolIds.slice(0, max);
  const extra = toolIds.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((id) => (
        <ToolLogo key={id} toolId={id} size={size} />
      ))}
      {extra > 0 && (
        <span
          className="flex shrink-0 items-center justify-center rounded-sm bg-surface-hover text-[11px] font-medium leading-none text-ink-muted"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
