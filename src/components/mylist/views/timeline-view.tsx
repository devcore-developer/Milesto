"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarRange, Flag, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-mylist";
import { formatDate, useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";
import { PROJECT_STATUSES, type ProjectDTO } from "@/lib/types";
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_TONES, startOfLocalDay } from "@/lib/project-utils";
import { cn } from "@/lib/utils";
import {
  ProjectStatusBadge,
  projectStatusLabelKey,
} from "@/components/mylist/project/badges";

const DAY_MS = 86_400_000;

interface Scale {
  /** timeline start (local midnight) */
  from: number;
  /** timeline end (local midnight) */
  to: number;
  totalDays: number;
  dayWidth: number;
  months: { label: string; offsetDays: number; spanDays: number }[];
}

function buildScale(projects: ProjectDTO[], isRTL: boolean): Scale {
  const today = startOfLocalDay();
  let min = today - 7 * DAY_MS;
  let max = today + 30 * DAY_MS;

  for (const p of projects) {
    if (p.startDate) min = Math.min(min, new Date(p.startDate).setHours(0, 0, 0, 0));
    if (p.deadline) max = Math.max(max, new Date(p.deadline).setHours(0, 0, 0, 0));
  }
  min -= 3 * DAY_MS;
  max += 3 * DAY_MS;

  const totalDays = Math.max(14, Math.round((max - min) / DAY_MS));
  // Aim for a canvas ~1100px wide, clamped so bars stay readable.
  const dayWidth = Math.min(48, Math.max(10, 1100 / totalDays));

  // Month segmentation (calendar-aware, works in any locale)
  const months: { label: string; offsetDays: number; spanDays: number }[] = [];
  const cursor = new Date(min);
  let offset = 0;
  while (offset < totalDays) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthStart = new Date(y, m, 1).getTime();
    const nextMonth = new Date(y, m + 1, 1).getTime();
    const spanUntil = Math.min(max, nextMonth - DAY_MS);
    const spanDays = Math.max(
      1,
      Math.round((spanUntil - Math.max(min, monthStart)) / DAY_MS) + 1,
    );
    months.push({
      label: cursor.toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
        month: "short",
        year: "2-digit",
      }),
      offsetDays: offset,
      spanDays,
    });
    offset += spanDays;
    cursor.setMonth(m + 1, 1);
  }

  return { from: min, to: max, totalDays, dayWidth, months };
}

function dayOffset(scale: Scale, iso: string): number {
  return Math.round((new Date(iso).setHours(0, 0, 0, 0) - scale.from) / DAY_MS);
}

function TimelineRow({
  project,
  scale,
  todayOffset,
}: {
  project: ProjectDTO;
  scale: Scale;
  todayOffset: number;
}) {
  const { t, lang } = useI18n();
  const openProject = useUIStore((s) => s.openProject);
  const color = project.color ?? PROJECT_STATUS_COLORS[project.status];

  const hasRange = !!project.startDate || !!project.deadline;
  const startOffset = project.startDate ? dayOffset(scale, project.startDate) : null;
  const endOffset = project.deadline ? dayOffset(scale, project.deadline) : null;

  const barFrom =
    startOffset !== null ? startOffset : endOffset !== null ? endOffset - 7 : todayOffset - 3;
  const barTo =
    endOffset !== null ? endOffset : startOffset !== null ? startOffset + 14 : todayOffset + 3;
  const left = Math.min(barFrom, barTo);
  const width = Math.max(Math.abs(barTo - barFrom), 2);

  const pct = project.progressPct;

  return (
    <div
      className="group flex items-center gap-3 border-b border-slate-100 py-2 last:border-0 hover:bg-slate-50/70"
      role="button"
      tabIndex={0}
      onClick={() => openProject(project.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProject(project.id);
        }
      }}
    >
      {/* Name column */}
      <div className="w-44 shrink-0 ps-1">
        <p className="truncate text-sm font-medium text-slate-800" dir="auto">
          {project.name}
        </p>
        <p className="truncate text-[11px] text-slate-400" dir="ltr">
          {project.startDate ? formatDate(project.startDate, lang, "d MMM") : "…"}
          {" → "}
          {project.deadline ? formatDate(project.deadline, lang, "d MMM") : "…"}
        </p>
      </div>

      {/* Track */}
      <div
        className="relative h-9 min-w-0 flex-1 overflow-hidden rounded-md bg-slate-50"
        dir="ltr"
      >
        {/* month grid lines */}
        {scale.months.map((m) => (
          <span
            key={m.label}
            className="absolute inset-y-0 w-px bg-slate-200/80"
            style={{ left: m.offsetDays * scale.dayWidth }}
          />
        ))}

        {/* today marker */}
        <span
          className="absolute inset-y-0 z-10 w-px bg-red-400"
          style={{ left: todayOffset * scale.dayWidth }}
        >
          <span className="absolute -top-0 start-1/2 size-1.5 -translate-x-1/2 rounded-full bg-red-400" />
        </span>

        {hasRange ? (
          <div
            className="absolute top-1/2 z-[5] flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-full shadow-sm ring-1 ring-black/5"
            style={{
              left: left * scale.dayWidth,
              width: width * scale.dayWidth,
              backgroundColor: color,
            }}
            title={`${project.name} · ${pct}%`}
          >
            {/* progress fill */}
            <span
              className="absolute inset-y-0 start-0 bg-white/25"
              style={{ width: `${pct}%` }}
            />
            {/* deadline flag at bar end */}
            {project.deadline && (
              <Flag className="absolute end-0.5 size-3 text-white/90" />
            )}
          </div>
        ) : (
          <span
            className="absolute top-1/2 z-[5] size-2.5 -translate-y-1/2 rounded-full ring-1 ring-black/5"
            style={{
              left: todayOffset * scale.dayWidth,
              backgroundColor: color,
            }}
          />
        )}

        {project.overdue && (
          <AlertTriangle
            className="absolute end-1 top-1/2 z-10 size-3.5 -translate-y-1/2 text-red-500"
            aria-label={t("overdue")}
          />
        )}
      </div>

      {/* Meta */}
      <div className="hidden w-24 shrink-0 items-center justify-end gap-2 sm:flex">
        <span className="text-xs font-semibold tabular-nums text-slate-500">{pct}%</span>
      </div>
    </div>
  );
}

export function TimelineView() {
  const { t, isRTL } = useI18n();
  const setView = useUIStore((s) => s.setView);

  const { data, isLoading } = useProjects();
  const projects = data?.projects ?? [];

  const withDates = useMemo(
    () =>
      projects
        .filter((p) => p.startDate || p.deadline)
        .sort((a, b) => {
          const aStart = a.startDate ? Date.parse(a.startDate) : Number.POSITIVE_INFINITY;
          const bStart = b.startDate ? Date.parse(b.startDate) : Number.POSITIVE_INFINITY;
          return aStart - bStart;
        }),
    [projects],
  );
  const withoutDates = useMemo(
    () => projects.filter((p) => !p.startDate && !p.deadline),
    [projects],
  );

  const scale = useMemo(() => buildScale(withDates, isRTL), [withDates, isRTL]);
  const todayOffset = Math.round((startOfLocalDay() - scale.from) / DAY_MS);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("timeline.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("timeline.subtitle")}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setView("projects")}>
          <FolderKanban className="size-4" />
          {t("dashboard.projectsViewAll")}
        </Button>
      </div>

      {withDates.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <CalendarRange className="size-8 text-slate-300" />
          <p className="font-medium text-slate-700">{t("timeline.noProjects")}</p>
          <p className="text-sm text-slate-400">{t("timeline.noProjectsHint")}</p>
          <Button className="mt-2 gap-2" onClick={() => setView("projects")}>
            <FolderKanban className="size-4" />
            {t("timeline.newProject")}
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <CardContent className="overflow-x-auto p-0">
            <div style={{ minWidth: 176 + scale.totalDays * scale.dayWidth + 120 }}>
            {/* Month header */}
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/60 py-2">
              <div className="w-44 shrink-0" />
              <div className="relative min-w-0 flex-1" dir="ltr">
                {scale.months.map((m) => (
                  <span
                    key={`${m.label}-${m.offsetDays}`}
                    className="absolute top-0 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                    style={{
                      left: m.offsetDays * scale.dayWidth,
                      width: m.spanDays * scale.dayWidth,
                    }}
                  >
                    {m.label}
                  </span>
                ))}
                {/* reserve height */}
                <span className="invisible block h-4" />
              </div>
              <div className="hidden w-24 shrink-0 sm:block" />
            </div>

            {/* Rows */}
            <div className="px-3">
              {withDates.map((p) => (
                <TimelineRow
                  key={p.id}
                  project={p}
                  scale={scale}
                  todayOffset={todayOffset}
                />
              ))}
            </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects without dates */}
      {withoutDates.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <CalendarRange className="size-4 text-slate-400" />
              {t("timeline.noDates")}
            </p>
            <div className="flex flex-wrap gap-2">
              {withoutDates.map((p) => (
                <button
                  key={p.id}
                  onClick={() => useUIStore.getState().openProject(p.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5",
                    PROJECT_STATUS_TONES[p.status],
                  )}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-[11px] opacity-70">
                    {t(projectStatusLabelKey(p.status))}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {withDates.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-slate-500">
          <span className="font-semibold">{t("timeline.legend")}:</span>
          {PROJECT_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: PROJECT_STATUS_COLORS[s] }}
              />
              {t(projectStatusLabelKey(s))}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-0.5 bg-red-400" />
            {t("timeline.today")}
          </span>
        </div>
      )}
    </div>
  );
}