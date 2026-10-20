"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useProjects } from "@/lib/project-context";
import { useTimeline } from "@/providers/TimelineProvider";
import {
  detectConflicts,
  deadlineItems,
  toDeliverableViews,
  toMilestoneViews,
  todayISO,
  type Row,
} from "@/lib/report-insights";

type Props = { today?: string; className?: string };

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function ConflictsPanel(props: Props = {}) {
  const api = useTimeline() as unknown as Record<string, any>;
  const projectsCtx = useProjects() as unknown as Record<string, any>;
  const today = props.today ?? todayISO();

  const projects: Row[] = Array.isArray(projectsCtx?.projects) ? projectsCtx.projects : [];
  const milestones = toMilestoneViews(api?.milestones);
  const deliverables = toDeliverableViews(api?.deliverables);
  const conflicts = detectConflicts(deadlineItems(projects, milestones, deliverables), today);

  return (
    <div className={cx("space-y-3", props.className)}>
      <h2 className="text-sm font-semibold">التعارضات</h2>

      {conflicts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <ShieldCheck className="h-4 w-4" />
          مفيش تعارضات في الجدول الحالي.
        </div>
      ) : (
        conflicts.map((c) => (
          <div key={c.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              {c.day} — {c.projectName ?? "بدون مشروع"}
            </div>
            <div className="mt-1 text-xs text-amber-900/80">{c.message}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {c.refs.map((r) => (
                <span key={r.id} className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">
                  {r.title}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default ConflictsPanel;