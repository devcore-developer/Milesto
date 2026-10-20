"use client";

import { Badge } from "@/components/ui/badge";
import { useReports } from "@/providers/ReportsProvider";
import {
  normalizeStatus,
  qualityReport,
  statusLabel,
  statusTone,
  toDeliverableViews,
  toMilestoneViews,
  type ReportFilters,
} from "@/lib/report-insights";

type Props = { filters?: ReportFilters; className?: string };

export function QualityTab(props: Props = {}) {
  const rep = useReports() as unknown as Record<string, any>;

  const milestonesAll = toMilestoneViews(rep?.milestones);
  const deliverablesAll = toDeliverableViews(rep?.deliverables);

  const pid = props.filters?.projectId;
  const st = props.filters?.status;
  const matchStatus = (s?: string) => (st ? normalizeStatus(s) === normalizeStatus(st) : true);

  const milestones = milestonesAll.filter((m) => (pid ? m.projectId === pid : true) && matchStatus(m.status));
  const deliverables = deliverablesAll.filter((d) => (pid ? d.projectId === pid : true) && matchStatus(d.status));

  const report = qualityReport(milestones, deliverables);

  return (
    <div className={props.className ?? "space-y-4"}>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground">نسبة إتمام التسليمات</div>
        <div className="mt-1 text-2xl font-semibold">{report.completionRatePct}%</div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-2 text-sm font-semibold">مراحل عليها معيّقات ({report.blockedMilestones.length})</h3>
        {report.blockedMilestones.length === 0 ? (
          <div className="text-sm text-muted-foreground">مفيش مراحل معيّقة.</div>
        ) : (
          <div className="space-y-1">
            {report.blockedMilestones.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{m.title ?? "مرحلة بدون عنوان"}</span>
                <Badge variant="danger">{m.blockedByTaskIds?.length ?? 0} معيّق</Badge>
                <Badge variant={statusTone(m.status)}>{statusLabel(m.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-2 text-sm font-semibold">تسليمات بدون مسؤول ({report.unassignedDeliverables.length})</h3>
        {report.unassignedDeliverables.length === 0 ? (
          <div className="text-sm text-muted-foreground">كل التسليمات ليها مسؤول.</div>
        ) : (
          <div className="space-y-1">
            {report.unassignedDeliverables.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{d.title ?? "تسليم بدون عنوان"}</span>
                <Badge variant={statusTone(d.status)}>{statusLabel(d.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-2 text-sm font-semibold">تسليمات بدون تاريخ استحقاق ({report.missingDueDate.length})</h3>
        {report.missingDueDate.length === 0 ? (
          <div className="text-sm text-muted-foreground">كل التسليمات النشطة ليها تاريخ.</div>
        ) : (
          <div className="space-y-1">
            {report.missingDueDate.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{d.title ?? "تسليم بدون عنوان"}</span>
                <Badge variant="warning">بدون تاريخ</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default QualityTab;