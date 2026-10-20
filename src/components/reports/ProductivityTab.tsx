"use client";

import { TrendingUp } from "lucide-react";
import { useReports } from "@/providers/ReportsProvider";
import {
  normalizeStatus,
  priorityLabel,
  productivityReport,
  toDeliverableViews,
  toMilestoneViews,
  todayISO,
  type ReportFilters,
} from "@/lib/report-insights";

type Props = { filters?: ReportFilters; className?: string };

export function ProductivityTab(props: Props = {}) {
  const rep = useReports() as unknown as Record<string, any>;
  const today = todayISO();

  const milestonesAll = toMilestoneViews(rep?.milestones);
  const deliverablesAll = toDeliverableViews(rep?.deliverables);

  const pid = props.filters?.projectId;
  const st = props.filters?.status;
  const matchStatus = (s?: string) => (st ? normalizeStatus(s) === normalizeStatus(st) : true);

  const milestones = milestonesAll.filter((m) => (pid ? m.projectId === pid : true) && matchStatus(m.status));
  const deliverables = deliverablesAll.filter((d) => (pid ? d.projectId === pid : true) && matchStatus(d.status));

  const report = productivityReport(milestones, deliverables, today);
  const maxWeekly = Math.max(1, ...report.weekly.map((w) => w.completed));
  const priorityEntries = Object.entries(report.byPriority).sort((a, b) => b[1] - a[1]);

  return (
    <div className={props.className ?? "space-y-4"}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">مكتمل آخر 30 يوم</div>
          <div className="mt-1 text-lg font-semibold">{report.completedLast30}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">الـ 30 يوم اللي قبله</div>
          <div className="mt-1 text-lg font-semibold">{report.completedPrev30}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            اتجاه التغيّر
          </div>
          <div className={`mt-1 text-lg font-semibold ${report.trendPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {report.trendPct > 0 ? "+" : ""}
            {report.trendPct}%
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-3 text-sm font-semibold">الإنجاز الأسبوعي</h3>
        <div className="flex h-28 items-end gap-3">
          {report.weekly.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-emerald-500"
                style={{ height: `${Math.max(4, (w.completed / maxWeekly) * 100)}%` }}
                title={`${w.completed}`}
              />
              <span className="text-[10px] text-muted-foreground">{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-2 text-sm font-semibold">التسليمات النشطة بالأولوية</h3>
        {priorityEntries.length === 0 ? (
          <div className="text-sm text-muted-foreground">مفيش تسليمات نشطة.</div>
        ) : (
          <div className="space-y-1">
            {priorityEntries.map(([p, count]) => (
              <div key={p} className="flex items-center justify-between text-sm">
                <span>{priorityLabel(p)}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductivityTab;