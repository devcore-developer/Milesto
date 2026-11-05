"use client";

import { AlertTriangle } from "lucide-react";
import { formatDate, useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: "#94A3B8",
  MEDIUM: "#2563EB",
  HIGH: "#D97706",
  URGENT: "#DC2626",
};

const PRIORITY_KEY: Record<TaskPriority, TranslationKey> = {
  LOW: "tasks.priorityLow",
  MEDIUM: "tasks.priorityMedium",
  HIGH: "tasks.priorityHigh",
  URGENT: "tasks.priorityUrgent",
};

const STATUS_KEY: Record<TaskStatus, TranslationKey> = {
  TODO: "tasks.statusTodo",
  IN_PROGRESS: "tasks.statusInProgress",
  COMPLETED: "tasks.statusCompleted",
};

export function priorityLabelKey(priority: TaskPriority): TranslationKey {
  return PRIORITY_KEY[priority];
}

export function statusLabelKey(status: TaskStatus): TranslationKey {
  return STATUS_KEY[status];
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        priority === "URGENT" && "border-red-200 bg-red-50 text-red-700",
        priority === "HIGH" && "border-amber-200 bg-amber-50 text-amber-700",
        priority === "MEDIUM" && "border-blue-200 bg-blue-50 text-blue-700",
        priority === "LOW" && "border-slate-200 bg-slate-100 text-slate-600",
      )}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[priority] }} />
      {t(priorityLabelKey(priority))}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useI18n();
  if (status === "TODO") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        status === "IN_PROGRESS" && "border-sky-200 bg-sky-50 text-sky-700",
        status === "COMPLETED" && "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      {t(statusLabelKey(status))}
    </span>
  );
}

export function CategoryChip({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <span className="inline-flex max-w-40 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function DueChip({ isoDateStr }: { isoDateStr: string }) {
  const { t, lang } = useI18n();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = new Date(isoDateStr);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((day.getTime() - startOfToday.getTime()) / 86_400_000);

  const overdue = diffDays < 0;
  const today = diffDays === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        overdue
          ? "border-red-200 bg-red-50 text-red-700"
          : today
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-100 text-slate-600",
      )}
    >
      {overdue && <AlertTriangle className="size-3" />}
      {overdue ? t("overdue") : today ? t("today") : formatDate(isoDateStr, lang)}
    </span>
  );
}
