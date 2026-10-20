"use client";

import { AlertTriangle, CalendarClock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/lib/project-context";
import { useTimeline } from "@/providers/TimelineProvider";
import {
  buildInsights,
  deadlineItems,
  DEADLINE_BUCKET_LABEL,
  groupDeadlines,
  statusLabel,
  statusTone,
  toDeliverableViews,
  toMilestoneViews,
  todayISO,
  type DeadlineBucket,
  type Row,
  type Tone,
} from "@/lib/report-insights";

type Props = { today?: string; className?: string };

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const TONE_CARD: Record<Tone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  neutral: "border-border bg-muted text-foreground",
};

const BUCKETS: DeadlineBucket[] = ["overdue", "next7", "next30", "later"];

export function DeadlineIntelligence(props: Props = {}) {
  const api = useTimeline() as unknown as Record<string, any>;
  const projectsCtx = useProjects() as unknown as Record<string, any>;
  const today = props.today ?? todayISO();

  const projects: Row[] = Array.isArray(projectsCtx?.projects) ? projectsCtx.projects : [];
  const milestones = toMilestoneViews(api?.milestones);
  const deliverables = toDeliverableViews(api?.deliverables);
  const items = deadlineItems(projects, milestones, deliverables);
  const groups = groupDeadlines(items, today);
  const insights = buildInsights(items, today);

  return (
    <div className={cx("space-y-4", props.className)}>
      <h2 className="text-sm font-semibold">ذكاء المواعيد</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {insights.map((i) => (
          <div key={i.id} className={cx("rounded-lg border p-3", TONE_CARD[i.tone])}>
            <div className="text-sm font-semibold">{i.title}</div>
            <div className="mt-1 text-xs opacity-80">{i.detail}</div>
          </div>
        ))}
      </div>

      {BUCKETS.map((b) => {
        const list = groups[b];
        if (list.length === 0) return null;
        return (
          <div key={b} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              {b === "overdue" ? (
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              ) : (
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold">{DEADLINE_BUCKET_LABEL[b]}</span>
              <Badge variant={b === "overdue" ? "danger" : "neutral"}>{list.length}</Badge>
            </div>
            <div className="space-y-1">
              {list.map((it) => (
                <div key={it.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{it.title}</span>
                  <span className="text-muted-foreground">{it.projectName ?? "—"}</span>
                  {it.dueDate ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Info className="h-3 w-3" />
                      {it.dueDate}
                    </span>
                  ) : null}
                  <Badge variant={statusTone(it.status)}>{statusLabel(it.status)}</Badge>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {groups.no_date.length > 0 ? (
        <div className="text-xs text-muted-foreground">
          {groups.no_date.length} عنصر بدون تاريخ استحقاق مسجّل.
        </div>
      ) : null}
    </div>
  );
}

export default DeadlineIntelligence;