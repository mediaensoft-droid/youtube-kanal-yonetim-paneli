"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import clsx from "clsx";

export interface MultiSelectOption {
  code: string;
  label: string;
  icon?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "Seçin..." }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const optionByCode = useMemo(() => new Map(options.map((o) => [o.code, o])), [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
    );
  }, [options, query]);

  function toggle(code: string) {
    if (value.includes(code)) {
      onChange(value.filter((v) => v !== code));
    } else {
      onChange([...value, code]);
    }
  }

  function remove(code: string) {
    onChange(value.filter((v) => v !== code));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-[38px] items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-left text-sm transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <div className="flex flex-1 flex-wrap gap-1">
          {value.length === 0 && <span className="text-ink-faint">{placeholder}</span>}
          {value.map((code) => {
            const opt = optionByCode.get(code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded bg-surface-hover px-1.5 py-0.5 text-xs text-ink"
              >
                {opt?.icon} {opt?.label ?? code}
                <X
                  className="h-3 w-3 cursor-pointer text-ink-muted hover:text-brand"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(code);
                  }}
                />
              </span>
            );
          })}
        </div>
        <ChevronDown
          className={clsx(
            "h-4 w-4 shrink-0 text-ink-faint transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="animate-scale-in absolute z-20 mt-1 w-full origin-top rounded-md border border-line-strong bg-surface-2 shadow-xl shadow-black/40">
          <div className="p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ara..."
              className="w-full rounded border border-line bg-surface px-2 py-1 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-faint">Sonuç yok</li>
            )}
            {filteredOptions.map((opt) => {
              const selected = value.includes(opt.code);
              return (
                <li key={opt.code}>
                  <button
                    type="button"
                    onClick={() => toggle(opt.code)}
                    className={clsx(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-100 hover:bg-surface-hover",
                      selected && "bg-brand-soft font-medium text-ink"
                    )}
                  >
                    <input type="checkbox" checked={selected} readOnly className="pointer-events-none accent-brand" />
                    {opt.icon && <span>{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
