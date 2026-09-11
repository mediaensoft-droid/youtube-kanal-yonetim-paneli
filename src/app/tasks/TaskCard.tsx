"use client";

import type { DragEvent } from "react";
import clsx from "clsx";
import { CalendarDays, CheckSquare, MessageSquare } from "lucide-react";
import type { Task, TaskPriority } from "@/types";
import { formatShortDate } from "@/lib/format";
import type { BoardChannel, BoardMember } from "./TaskBoard";

interface TaskCardProps {
  task: Task;
  overdue: boolean;
  assignee?: BoardMember;
  channel?: BoardChannel;
  readOnly: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  high: "border-l-red-500",
  normal: "border-l-line-strong",
  low: "border-l-emerald-500",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "Yüksek",
  normal: "Normal",
  low: "Düşük",
};

export function TaskCard({
  task,
  overdue,
  assignee,
  channel,
  readOnly,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const checklistTotal = task.checklist.length;
  const checklistDone = task.checklist.filter((item) => item.done).length;
  const hasMeta = assignee || task.dueDate || channel || checklistTotal > 0 || task.commentCount > 0;

  return (
    <div
      data-task-id={task.id}
      role="button"
      tabIndex={0}
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      title={`${task.title} · Öncelik: ${PRIORITY_LABELS[task.priority]}`}
      className={clsx(
        "group rounded-md border border-line border-l-[3px] bg-surface-2 p-2.5 text-left shadow-sm transition-all duration-150",
        "hover:border-line-strong hover:shadow-md focus:outline-none focus:ring-1 focus:ring-brand",
        PRIORITY_BORDER[task.priority],
        !readOnly && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40"
      )}
    >
      <p className="text-sm font-medium leading-snug text-ink">{task.title}</p>

      {hasMeta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-muted">
          {assignee && (
            <span
              title={assignee.displayName}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-ink"
            >
              {assignee.displayName.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?"}
            </span>
          )}

          {task.dueDate && (
            <span
              className={clsx(
                "inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5",
                overdue ? "text-red-400" : "text-ink-muted"
              )}
              title={overdue ? "Son tarih geçti" : "Son tarih"}
            >
              <CalendarDays className="h-3 w-3" />
              {formatShortDate(task.dueDate)}
            </span>
          )}

          {channel && (
            <span className="inline-flex items-center gap-1" title={channel.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={channel.thumbnailUrl}
                alt={channel.name}
                className="h-4 w-4 rounded-full object-cover"
              />
            </span>
          )}

          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1" title="Yorumlar">
              <MessageSquare className="h-3 w-3" />
              {task.commentCount}
            </span>
          )}

          {checklistTotal > 0 && (
            <span
              className={clsx(
                "ml-auto inline-flex items-center gap-1",
                checklistDone === checklistTotal && "text-emerald-400"
              )}
              title="Kontrol listesi"
            >
              <CheckSquare className="h-3 w-3" />
              {checklistDone}/{checklistTotal}
              <span className="h-1 w-8 overflow-hidden rounded-full bg-surface">
                <span
                  className={clsx(
                    "block h-full rounded-full",
                    checklistDone === checklistTotal ? "bg-emerald-500" : "bg-brand"
                  )}
                  style={{ width: `${Math.round((checklistDone / checklistTotal) * 100)}%` }}
                />
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
