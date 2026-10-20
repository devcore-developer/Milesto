"use client";

import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/lib/project-context";
import { useTimeline } from "@/providers/TimelineProvider";
import {
  addDays,
  daysBetween,
  isValidISO,
  statusLabel,
  statusTone,
  toDeliverableViews,
  toMilestoneViews,
  todayISO,
  type DeliverableView,
  type MilestoneView,
  type Row,
} from "@/lib/report-insights";

type Props = { today?: string; className?: string };

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function str(v: unknown, fallback = "—"): string {
  return v == null || v === "" ? fallback : String(v);
}

const TONE_BG: Record<string, string> = {
  success: "bg-emerald-500",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  neutral: "bg-slate-400",
};

export function GanttView(props: Props = {}) {
  const api = useTimeline() as unknown as Record<string, any>;
  const projectsCtx = useProjects() as unknown as Record<string, any>;
  const today = props.today ?? todayISO();

  const projects: Row[] = Array.isArray(projectsCtx?.projects) ? projectsCtx.projects : [];
  const milestones = toMilestoneViews(api?.milestones);
  const deliverables = toDeliverableViews(api?.deliverables).filter((d) => {
    const s = String(d.status ?? "").toLowerCase();
    return s !== "cancelled" && s !== "canceled";
  });

  const dates: string[] = [today];
  for (const d of deliverables) {
    if (d.plannedStartDate && isValidISO(d.plannedStartDate)) dates.push(d.plannedStartDate);
    if (d.dueDate && isValidISO(d.dueDate)) dates.push(d.dueDate);
  }
  for (const m of milestones) {
    if (m.date && isValidISO(m.date)) dates.push(m.date);
  }
  dates.sort();
  const start = addDays(dates[0] ?? today, -7);
  let end = addDays(dates[dates.length - 1] ?? today, 7);
  if (daysBetween(start, end) < 30) end = addDays(start, 30);
  const span = Math.max(1, daysBetween(start, end));

  const pctOf = (iso: string) => Math.min(100, Math.max(0, (daysBetween(start, iso) / span) * 100));

  const ticks: string[] = [];
  for (let i = 0; i <= 5; i++) ticks.push(addDays(start, Math.round((span * i) / 5)));

  const groups = new Map<string, { projectName: string; deliverables: DeliverableView[]; milestones: MilestoneView[] }>();
  for (const p of projects) {
    const id = str(p?.id, "");
    if (id && !groups.has(id)) groups.set(id, { projectName: str(p?.title ?? p?.name, id), deliverables: [], milestones: [] });
  }
  for (const d of deliverables) {
    const id = d.projectId ?? "—";
    const g = groups.get(id) ?? { projectName: id === "—" ? "بدون مشروع" : id, deliverables: [], milestones: [] };
    g.deliverables.push(d);
    groups.set(id, g);
  }
  for (const m of milestones) {
    const id = m.projectId ?? "—";
    const g = groups.get(id) ?? { projectName: id === "—" ? "بدون مشروع" : id, deliverables: [], milestones: [] };
    g.milestones.push(m);
    groups.set(id, g);
  }

  return (
    <div className={cx("space-y-4", props.className)}>
      <div className="flex items-center gap-2">
        <div className="w-44 shrink-0 text-xs font-medium text-muted-foreground">{today}</div>
        <div className="relative h-6 grow">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute top-0 -translate-x-1/2 text-[10px] text-muted-foreground"
              style={{ left: `${pctOf(t)}%` }}
            >
              {t.slice(5)}
            </div>
          ))}
          <div className="absolute inset-y-0 w-px bg-rose-400" style={{ left: `${pctOf(today)}%` }} />
        </div>
      </div>

      {Array.from(groups.entries()).map(([id, g]) => (
        <div key={id} className="space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{g.projectName}</div>
            <Badge variant="outline">
              {g.deliverables.length} تسليم · {g.milestones.length} مرحلة
            </Badge>
          </div>

          {g.deliverables.map((d) => {
            const s = d.plannedStartDate && isValidISO(d.plannedStartDate) ? d.plannedStartDate : d.dueDate ?? today;
            const e = d.dueDate && isValidISO(d.dueDate) ? d.dueDate : d.plannedStartDate ?? today;
            const from = s <= e ? s : e;
            const to = s <= e ? e : s;
            const left = pctOf(from);
            const width = Math.max(1.5, pctOf(to) - left);
            return (
              <div key={d.id} className="flex items-center gap-2">
                <div className="w-44 shrink-0 truncate text-xs text-muted-foreground" title={str(d.title)}>
                  {str(d.title, "تسليم")}
                </div>
                <div className="relative h-5 grow rounded bg-muted">
                  <div
                    className={cx("absolute top-0 h-5 rounded", TONE_BG[statusTone(d.status)])}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${str(d.title)}: ${from} → ${to} (${statusLabel(d.status)})`}
                  />
                </div>
              </div>
            );
          })}

          {g.milestones.map((m) => {
            const hasDate = m.date != null && isValidISO(m.date);
            return (
              <div key={m.id} className="flex items-center gap-2">
                <div className="w-44 shrink-0 truncate text-xs text-muted-foreground" title={str(m.title)}>
                  {str(m.title, "مرحلة")}
                </div>
                <div className="relative h-5 grow rounded bg-muted">
                  {hasDate ? (
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-amber-500"
                      style={{ left: `${pctOf(m.date as string)}%` }}
                      title={`${str(m.title)} — ${m.date} (${statusLabel(m.status)})`}
                    />
                  ) : (
                    <div className="absolute inset-y-0 start-1 flex items-center text-[10px] text-muted-foreground">
                      بدون تاريخ
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {groups.size === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          مفيش بيانات رسم بياني لسه.
        </div>
      ) : null}
    </div>
  );
}

export default GanttView;