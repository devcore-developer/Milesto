"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { ProjectStatus, TaskPriority } from "@/lib/types";
import { PROJECT_STATUS_TONES } from "@/lib/project-utils";
import { cn } from "@/lib/utils";

const PROJECT_STATUS_KEY: Record<ProjectStatus, TranslationKey> = {
  PLANNING: "projects.statusPlanning",
  ACTIVE: "projects.statusActive",
  ON_HOLD: "projects.statusOnHold",
  COMPLETED: "projects.statusCompleted",
  CANCELLED: "projects.statusCancelled",
};

export const PRIORITY_KEY: Record<TaskPriority, TranslationKey> = {
  LOW: "tasks.priorityLow",
  MEDIUM: "tasks.priorityMedium",
  HIGH: "tasks.priorityHigh",
  URGENT: "tasks.priorityUrgent",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: "#94A3B8",
  MEDIUM: "#2563EB",
  HIGH: "#D97706",
  URGENT: "#DC2626",
};

export function projectStatusLabelKey(status: ProjectStatus): TranslationKey {
  return PROJECT_STATUS_KEY[status];
}

export function priorityLabelKeyFor(priority: TaskPriority): TranslationKey {
  return PRIORITY_KEY[priority];
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        PROJECT_STATUS_TONES[status],
      )}
    >
      {t(projectStatusLabelKey(status))}
    </span>
  );
}

export function ProjectPriorityDot({ priority }: { priority: TaskPriority }) {
  const { t } = useI18n();
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
      title={t(PRIORITY_KEY[priority])}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      />
      {t(PRIORITY_KEY[priority])}
    </span>
  );
}

/**
 * Remaining-days chip: neutral normally, amber when urgent (≤3 days),
 * sky when soon (≤7 days), red + warning icon when overdue.
 */
export function DeadlineChip({
  deadline,
  overdue,
  daysRemaining,
}: {
  deadline: string | null;
  overdue: boolean;
  daysRemaining: number | null;
}) {
  const { t } = useI18n();

  if (!deadline) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
        <CalendarClock className="size-3" />
        {t("projects.noDates")}
      </span>
    );
  }

  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
        <AlertTriangle className="size-3" />
        {t("projects.overdueBy", { days: Math.abs(daysRemaining ?? 0) })}
      </span>
    );
  }

  const urgent = daysRemaining !== null && daysRemaining <= 3;
  const soon = daysRemaining !== null && daysRemaining <= 7;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        urgent
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : soon
            ? "border-sky-200 bg-sky-50 text-sky-700"
            : "border-slate-200 bg-slate-100 text-slate-600",
      )}
    >
      <CalendarClock className="size-3" />
      {daysRemaining === 0
        ? t("projects.dueTodayLabel")
        : t("projects.dueInDays", { days: daysRemaining ?? 0 })}
    </span>
  );
}

/** Compact horizontal progress bar with "{done}/{total} tasks" label. */
export function ProjectProgress({
  pct,
  done,
  total,
  compact = false,
}: {
  pct: number;
  done?: number;
  total?: number;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const barColor =
    pct === 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-600" : pct >= 40 ? "bg-blue-500" : "bg-blue-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums text-slate-500",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {done !== undefined && total !== undefined
          ? t("projects.tasksDone", { done, total })
          : `${pct}%`}
      </span>
    </div>
  );
}