"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { MoreHorizontal, Pencil, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

interface ColumnMenuProps {
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
}

const MENU_WIDTH = 176;
const MENU_HEIGHT = 148;

export function ColumnMenu({
  canMoveLeft,
  canMoveRight,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: ColumnMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  function open() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      y: Math.min(rect.bottom + 4, window.innerHeight - MENU_HEIGHT - 8),
    });
  }

  function pick(action: () => void) {
    setPosition(null);
    action();
  }

  const items = [
    { label: "Yeniden adlandır", icon: Pencil, action: onRename, disabled: false, danger: false },
    { label: "Sola taşı", icon: ChevronLeft, action: onMoveLeft, disabled: !canMoveLeft, danger: false },
    { label: "Sağa taşı", icon: ChevronRight, action: onMoveRight, disabled: !canMoveRight, danger: false },
    { label: "Sil", icon: Trash2, action: onDelete, disabled: false, danger: true },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        aria-label="Sütun menüsü"
        aria-haspopup="menu"
        aria-expanded={position !== null}
        className="rounded p-1 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {/* Portal to <body>: the page root's `.animate-fade-in-up` leaves a transform behind, which
          would otherwise make it the containing block for this `position: fixed` menu. */}
      {position &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setPosition(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setPosition(null);
              }}
            />
            <div
              role="menu"
              className="animate-scale-in fixed z-50 origin-top-right rounded-md border border-line-strong bg-surface-2 p-1 shadow-2xl shadow-black/50"
              style={{ left: position.x, top: position.y, width: MENU_WIDTH }}
            >
              {items.map(({ label, icon: Icon, action, disabled, danger }) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  onClick={() => pick(action)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
                    danger
                      ? "text-red-400 hover:bg-red-950/40"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
