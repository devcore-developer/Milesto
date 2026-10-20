"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useProjects } from "@/lib/project-context";
import { useTimeline } from "@/providers/TimelineProvider";
import {
  deadlineBucket,
  isClosedStatus,
  normalizeStatus,
  priorityLabel,
  statusLabel,
  statusTone,
  toDeliverableViews,
  todayISO,
  typeLabel,
  type DeliverableView,
  type Row,
} from "@/lib/report-insights";

type Props = { today?: string; projectId?: string; className?: string };

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function str(v: unknown, fallback = "—"): string {
  return v == null || v === "" ? fallback : String(v);
}

const PRIORITY_OPTIONS = ["urgent", "high", "medium", "low"];
const STATUS_SUGGESTED = ["todo", "in_progress", "review", "done", "accepted", "cancelled"];

type FormValues = {
  title: string;
  type: string;
  dueDate: string;
  priority: string;
  assignee: string;
  notes: string;
};

function DeliverableForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: DeliverableView | null;
  onCancel: () => void;
  onSubmit: (v: FormValues) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState(initial?.type ?? "document");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [assignee, setAssignee] = useState(initial?.assignee ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold">{initial ? "تعديل تسليم" : "تسليم جديد"}</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">العنوان</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تقرير المراجعة" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">النوع</label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {["document", "report", "design", "code", "review", "approval", "material", "service", "other"].map((t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">الأولوية</label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">تاريخ الاستحقاق</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">المسؤول</label>
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="اسم المسؤول" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">ملاحظات</label>
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-background p-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            إلغاء
          </Button>
          <Button
            onClick={() => onSubmit({ title: title.trim(), type, dueDate, priority, assignee: assignee.trim(), notes: notes.trim() })}
            disabled={!title.trim()}
          >
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DeliverablesSection({ today: todayProp, projectId, className }: Props = {}) {
  const api = useTimeline() as unknown as Record<string, any>;
  const projectsCtx = useProjects() as unknown as Record<string, any>;
  const today = todayProp ?? todayISO();

  const projects: Row[] = Array.isArray(projectsCtx?.projects) ? projectsCtx.projects : [];
  const deliverables = toDeliverableViews(api?.deliverables);

  const canCreate = typeof api?.createDeliverable === "function";
  const canEdit = typeof api?.editDeliverable === "function";
  const canChange = typeof api?.changeDeliverableStatus === "function";

  const [projectFilter, setProjectFilter] = useState(projectId ?? "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DeliverableView | null>(null);
  const [creating, setCreating] = useState(false);

  const projectName = new Map<string, string>();
  for (const p of projects) {
    const id = str(p?.id, "");
    if (id) projectName.set(id, str(p?.title ?? p?.name, "—"));
  }

  const seen = new Set<string>();
  const statusOptions: string[] = [];
  for (const s of [...deliverables.map((d) => String(d.status ?? "")), ...STATUS_SUGGESTED]) {
    if (!s) continue;
    const k = normalizeStatus(s);
    if (!seen.has(k)) {
      seen.add(k);
      statusOptions.push(s);
    }
  }
  const typeOptions = Array.from(new Set(deliverables.map((d) => String(d.type ?? "")).filter(Boolean)));

  const visible = deliverables
    .filter((d) => (projectFilter === "all" ? true : d.projectId === projectFilter))
    .filter((d) => (statusFilter === "all" ? true : normalizeStatus(d.status) === normalizeStatus(statusFilter)))
    .filter((d) => (typeFilter === "all" ? true : String(d.type ?? "") === typeFilter))
    .filter((d) => (priorityFilter === "all" ? true : normalizeStatus(d.priority) === normalizeStatus(priorityFilter)))
    .filter((d) => (query.trim() ? str(d.title, "").includes(query.trim()) : true))
    .sort((a, b) => String(a.dueDate ?? "9999-12-31").localeCompare(String(b.dueDate ?? "9999-12-31")));

  function save(v: FormValues) {
    const patch = {
      title: v.title,
      type: v.type,
      dueDate: v.dueDate || undefined,
      priority: v.priority,
      assignee: v.assignee || undefined,
      notes: v.notes || undefined,
    };
    if (creating) api?.createDeliverable?.(patch);
    else if (editing) api?.editDeliverable?.(editing.id, patch);
    setCreating(false);
    setEditing(null);
  }

  return (
    <section className={cx("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          التسليمات <span className="text-muted-foreground">({deliverables.length})</span>
        </h2>
        <span className="text-xs text-muted-foreground">اليوم: {today}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">كل المشاريع</option>
          {projects.map((p) => {
            const id = str(p?.id, "");
            return id ? (
              <option key={id} value={id}>
                {str(p?.title ?? p?.name, id)}
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
              {statusLabel(s)}
            </option>
          ))}
        </select>
        {typeOptions.length > 0 ? (
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">كل الأنواع</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        ) : null}
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">كل الأولويات</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {priorityLabel(p)}
            </option>
          ))}
        </select>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث…" className="h-9 w-36" />
        <div className="grow" />
        {canCreate ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="ms-1 h-4 w-4" />
            تسليم جديد
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {visible.map((d) => {
          const bucket = deadlineBucket(d.dueDate, today);
          const late = bucket === "overdue" && !isClosedStatus(d.status);
          return (
            <div key={d.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{str(d.title, "تسليم بدون عنوان")}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{d.projectId ? projectName.get(d.projectId) ?? "—" : "—"}</span>
                    <span>النوع: {typeLabel(d.type)}</span>
                    {d.dueDate ? <span>الاستحقاق: {d.dueDate}</span> : null}
                    {d.priority ? <span>الأولوية: {priorityLabel(d.priority)}</span> : null}
                    {d.assignee ? <span>المسؤول: {d.assignee}</span> : null}
                    {late ? (
                      <span className="inline-flex items-center gap-1 font-medium text-rose-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        متأخر
                      </span>
                    ) : null}
                  </div>
                </div>
                <Badge variant={statusTone(d.status)}>{statusLabel(d.status)}</Badge>
              </div>

              {canChange || canEdit ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canChange ? (
                    <select
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      value={String(d.status ?? "")}
                      onChange={(e) => api?.changeDeliverableStatus?.(d.id, e.target.value)}
                    >
                      <option value="">تغيير الحالة…</option>
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {canEdit ? (
                    <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => setEditing(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            مفيش تسليمات مطابقة للفلتر الحالي.
          </div>
        ) : null}
      </div>

      {creating || editing ? (
        <DeliverableForm
          initial={editing}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={save}
        />
      ) : null}
    </section>
  );
}

export default DeliverablesSection;