"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { CATEGORICAL_PALETTE } from "@/lib/colors";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORICAL_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={clsx(
              "flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset ring-white/10 transition-transform duration-150 hover:scale-110",
              value.toLowerCase() === color.toLowerCase() && "ring-2 ring-offset-2 ring-offset-surface-2 ring-white/70"
            )}
            style={{ backgroundColor: color }}
            aria-label={color}
          >
            {value.toLowerCase() === color.toLowerCase() && (
              <Check className="h-4 w-4 text-black/70" />
            )}
          </button>
        ))}
      </div>
      <input
        type="color"
        value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#999999"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border border-line bg-surface p-0.5"
      />
    </div>
  );
}
