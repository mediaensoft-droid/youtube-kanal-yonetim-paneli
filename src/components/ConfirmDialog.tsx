"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  // Portal to <body>: every page root carries `.animate-fade-in-up`, whose keyframe ends on
  // `transform: translateY(0)` — a non-`none` transform, which makes that ancestor the
  // containing block for `position: fixed` descendants. Left un-portaled, this dialog renders
  // centered within the (possibly very tall, scrolled-away) page content instead of the
  // viewport, making it appear to do nothing when opened on a scrolled page.
  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-scale-in w-full max-w-sm rounded-lg border border-line-strong bg-surface-2 p-5 shadow-2xl shadow-black/50">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description && <p className="mt-2 text-sm text-ink-muted">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
