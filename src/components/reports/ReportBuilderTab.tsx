"use client";

import { useState } from "react";
import { Download, FolderOpen, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReports } from "@/providers/ReportsProvider";
import {
  projectPerformance,
  toDeliverableViews,
  toMilestoneViews,
  todayISO,
  type ReportFilters,
  type Row,
} from "@/lib/report-insights";

type Props = {
  filters?: ReportFilters;
  onFiltersChange?: (f: ReportFilters) => void;
  onGoTab?: (tab: string, projectId?: string) => void;
  className?: string;
};

type SavedConfig = { id: string; name: string; filters: ReportFilters; createdAt: string };

export function ReportBuilderTab(props: Props = {}) {
  const rep = useReports() as unknown as Record<string, any>;
  const today = todayISO();

  const projects: Row[] = Array.isArray(rep?.projects) ? rep.projects : [];
  const milestones = toMilestoneViews(rep?.milestones);
  const deliverables = toDeliverableViews(rep?.deliverables);

  const [name, setName] = useState("");
  const [saved, setSaved] = useState<SavedConfig[]>([]);

  const pid = props.filters?.projectId;
  const q = props.filters?.query?.trim() ?? "";
  const allRows = projectPerformance(projects, milestones, deliverables, today);
  const rows = allRows
    .filter((r) => (pid ? r.projectId === pid : true))
    .filter((r) => (q ? r.projectName.includes(q) : true));

  function saveConfig() {
    const n = name.trim() || `تقرير ${saved.length + 1}`;
    setSaved([{ id: `${Date.now()}`, name: n, filters: props.filters ?? {}, createdAt: today }, ...saved]);
    setName("");
  }

  function downloadCsv() {
    const header = ["المشروع", "مراحل منجزة", "مراحل إجمالي", "تسليمات منجزة", "تسليمات إجمالي", "متأخر", "نسبة الإنجاز"];
    const lines = rows.map((r) =>
      [
        `"${r.projectName.replace(/"/g, '""')}"`,
        r.milestonesDone,
        r.milestonesTotal,
        r.deliverablesDone,
        r.deliverablesTotal,
        r.overdue,
        `${r.progress}%`,
      ].join(","),
    );
    const blob = new Blob(["\uFEFF" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "milesto-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={props.className ?? "space-y-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الإعدادات…" className="h-9 w-44" />
        <Button onClick={saveConfig}>
          <Save className="ms-1 h-4 w-4" />
          حفظ الإعدادات الحالية
        </Button>
        <Button variant="outline" onClick={downloadCsv}>
          <Download className="ms-1 h-4 w-4" />
          تصدير CSV
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">الإعدادات المحفوظة</h3>
        {saved.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            لسه مفيش إعدادات محفوظة — ظبّط الفلاتر فوق واحفظها.
          </div>
        ) : (
          saved.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
              <div className="grow text-sm font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.createdAt}</div>
              <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => props.onFiltersChange?.(c.filters)}>
                تطبيق
              </Button>
              <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => props.onGoTab?.("projects")}>
                فتح تبويب المشاريع
              </Button>
              <Button
                variant="ghost"
                className="h-8 px-3 text-xs"
                onClick={() => setSaved(saved.filter((x) => x.id !== c.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="p-2 text-start">المشروع</th>
              <th className="p-2 text-start">المراحل</th>
              <th className="p-2 text-start">التسليمات</th>
              <th className="p-2 text-start">متأخر</th>
              <th className="p-2 text-start">الإنجاز</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.projectId} className="border-t border-border">
                <td className="p-2 font-medium">{r.projectName}</td>
                <td className="p-2">
                  {r.milestonesDone}/{r.milestonesTotal}
                </td>
                <td className="p-2">
                  {r.deliverablesDone}/{r.deliverablesTotal}
                </td>
                <td className="p-2">{r.overdue > 0 ? <span className="font-medium text-rose-600">{r.overdue}</span> : "0"}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded bg-muted">
                      <div className="h-2 rounded bg-emerald-500" style={{ width: `${r.progress}%` }} />
                    </div>
                    <span className="text-xs">{r.progress}%</span>
                  </div>
                </td>
                <td className="p-2">
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => props.onGoTab?.("projects", r.projectId)}>
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                  مفيش بيانات مطابقة.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ReportBuilderTab;