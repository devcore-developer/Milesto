"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReports } from "@/providers/ReportsProvider";
import * as OverviewTabModule from "@/components/reports/OverviewTab";
import * as ProjectPerformanceTabModule from "@/components/reports/ProjectPerformanceTab";
import { FinancialTab } from "@/components/reports/FinancialTab";
import { ProductivityTab } from "@/components/reports/ProductivityTab";
import { QualityTab } from "@/components/reports/QualityTab";
import { ReportBuilderTab } from "@/components/reports/ReportBuilderTab";
import {
  buildInsights,
  deadlineItems,
  normalizeStatus,
  toDeliverableViews,
  toMilestoneViews,
  todayISO,
  type ReportFilters,
  type Row,
  type Tone,
} from "@/lib/report-insights";

const OverviewTabC = (OverviewTabModule as any).OverviewTab ?? (OverviewTabModule as any).default;
const ProjectPerformanceTabC =
  (ProjectPerformanceTabModule as any).ProjectPerformanceTab ?? (ProjectPerformanceTabModule as any).default;

type Props = { onGoTab?: (tab: string, projectId?: string) => void; className?: string };

const TABS: Array<{ key: string; label: string }> = [
  { key: "overview", label: "نظرة عامة" },
  { key: "projects", label: "أداء المشاريع" },
  { key: "financial", label: "المالية" },
  { key: "productivity", label: "الإنتاجية" },
  { key: "quality", label: "الجودة" },
  { key: "builder", label: "مُنشئ التقارير" },
];

const TONE_CARD: Record<Tone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  neutral: "border-border bg-muted text-foreground",
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function ReportsWorkspace(props: Props = {}) {
  const rep = useReports() as unknown as Record<string, any>;
  const today = todayISO();

  const projects: Row[] = Array.isArray(rep?.projects) ? rep.projects : [];
  const milestones = toMilestoneViews(rep?.milestones);
  const deliverables = toDeliverableViews(rep?.deliverables);

  const [tab, setTab] = useState("overview");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filters: ReportFilters = {
    projectId: projectFilter === "all" ? undefined : projectFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    query: query.trim() ? query.trim() : undefined,
  };

  const statusOptions = Array.from(
    new Map(
      [...milestones.map((m) => String(m.status ?? "")), ...deliverables.map((d) => String(d.status ?? ""))]
        .filter(Boolean)
        .map((s) => [normalizeStatus(s), s] as const),
    ).values(),
  );

  const insights = buildInsights(deadlineItems(projects, milestones, deliverables), today);

  function goTab(key: string) {
    setTab(key);
    props.onGoTab?.(key);
  }

  function reset() {
    setProjectFilter("all");
    setStatusFilter("all");
    setQuery("");
  }

  return (
    <div className={cx("space-y-4", props.className)}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {insights.slice(0, 4).map((i) => (
          <div key={i.id} className={cx("rounded-lg border p-3", TONE_CARD[i.tone])}>
            <div className="text-sm font-semibold">{i.title}</div>
            <div className="mt-1 text-xs opacity-80">{i.detail}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">كل المشاريع</option>
          {projects.map((p) => {
            const id = String(p?.id ?? "");
            return id ? (
              <option key={id} value={id}>
                {String(p?.title ?? p?.name ?? id)}
              </option>
            ) : null;
          })}
        </select>
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">كل الحالات</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالعنوان…" className="h-9 w-40" />
        <div className="grow" />
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          تصفير
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => goTab(t.key)}
            className={cx(
              "rounded-t-md px-3 py-2 text-sm",
              tab === t.key ? "border-b-2 border-primary font-medium text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "overview" ? <OverviewTabC /> : null}
        {tab === "projects" ? <ProjectPerformanceTabC /> : null}
        {tab === "financial" ? <FinancialTab filters={filters} /> : null}
        {tab === "productivity" ? <ProductivityTab filters={filters} /> : null}
        {tab === "quality" ? <QualityTab filters={filters} /> : null}
        {tab === "builder" ? (
          <ReportBuilderTab
            filters={filters}
            onFiltersChange={(f) => {
              setProjectFilter(f.projectId ?? "all");
              setStatusFilter(f.status ?? "all");
              setQuery(f.query ?? "");
            }}
            onGoTab={(t, pid) => {
              if (pid) setProjectFilter(pid);
              goTab(t);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default ReportsWorkspace;