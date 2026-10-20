"use client";

/**
 * Milesto — Milestones section (timeline workspace), rebuilt on the real
 * Timeline context (Phase 10).
 *
 * The previous version was written against an API that does not exist
 * (schedule / createMilestone / editMilestone / completeMilestone /
 * archiveMilestone, and Milestone fields like date / relatedTaskIds /
 * relatedDeliverableIds / blockedByTaskIds / completedAt / "archived").
 * This rebuild maps the same UX onto the real provider:
 * - create   → addMilestone({ projectId, title, dueDate, status, ... })
 * - edit     → updateMilestone(id, patch)  (validated + cycle-checked)
 * - start    → updateMilestone(id, { status: "in-progress" })
 * - complete → updateMilestone(id, { status: "done" })
 * - archive  → deleteMilestone(id)         (no "archived" status exists)
 * - linked tasks/deliverables → milestone dependencies (the only real
 *   link in the model, validated by the provider).
 * Every mutation returns a MutationResult — failures are surfaced verbatim
 * in an inline banner instead of being swallowed.
 */

import * as React from "react";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { useProjects } from "@/lib/project-context";
import { useTimeline } from "@/providers/TimelineProvider";
import { cn } from "@/lib/utils";
import type { Milestone, MilestoneStatus } from "@/lib/timeline";

type Props = { today?: string; projectId?: string; className?: string };

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------- labels ---------------------------------- */

const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  planned: "مخططة",
  "in-progress": "قيد التنفيذ",
  done: "مكتملة",
  "at-risk": "معرضة للخطر",
  cancelled: "ملغاة",
};

const MILESTONE_STATUS_VARIANTS: Record<
  MilestoneStatus,
  "success" | "danger" | "warning" | "info" | "neutral" | "outline"
> = {
  planned: "info",
  "in-progress": "warning",
  done: "success",
  "at-risk": "danger",
  cancelled: "neutral",
};

function formatArabicDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${iso}T00:00:00`));
  } catch {
    return iso;
  }
}

/* --------------------------------- form ---------------------------------- */

interface FormState {
  id: string | null; // null ⇒ create
  title: string;
  projectId: string;
  dueDate: string;
  description: string;
  dependencies: string[];
}

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  projectId: "",
  dueDate: "",
  description: "",
  dependencies: [],
};

function MilestoneForm({
  initial,
  projects,
  milestones,
  onCancel,
  onSubmit,
}: {
  initial: FormState;
  projects: { id: string; name: string }[];
  milestones: Milestone[];
  onCancel: () => void;
  onSubmit: (values: FormState) => string | null;
}) {
  const [title, setTitle] = React.useState(initial.title);
  const [projectId, setProjectId] = React.useState(initial.projectId);
  const [dueDate, setDueDate] = React.useState(initial.dueDate);
  const [description, setDescription] = React.useState(initial.description);
  const [dependencies, setDependencies] = React.useState<string[]>(initial.dependencies);
  const [error, setError] = React.useState<string | null>(null);

  // Same project only, never the milestone itself. The provider re-checks
  // unknown references and dependency cycles on every save.
  const dependencyCandidates = milestones.filter(
    (m) => m.id !== initial.id && m.projectId === projectId
  );

  function toggleDependency(id: string) {
    setDependencies((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function submit() {
    const failure = onSubmit({
      id: initial.id,
      title: title.trim(),
      projectId,
      dueDate,
      description: description.trim(),
      dependencies,
    });
    setError(failure);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold">
          {initial.id ? "تعديل مرحلة" : "مرحلة جديدة"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">العنوان</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اعتماد التصميم النهائي"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">المشروع</label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={Boolean(initial.id)}
              >
                <option value="">اختر مشروعًا…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">تاريخ الاستحقاق</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">الوصف</label>
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-background p-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              تعتمد على (مراحل من نفس المشروع)
            </label>
            {dependencyCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">مفيش مراحل تانية في نفس المشروع.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dependencyCandidates.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                      dependencies.includes(m.id)
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={dependencies.includes(m.id)}
                      onChange={() => toggleDependency(m.id)}
                    />
                    {m.title}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={!title.trim() || !projectId || !dueDate}>
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- section -------------------------------- */

export function MilestonesSection({ today: todayProp, projectId, className }: Props = {}) {
  const { projects } = useProjects();
  const {
    milestones,
    today: contextToday,
    persistenceError,
    addMilestone,
    updateMilestone,
    deleteMilestone,
  } = useTimeline();

  const today = todayProp ?? contextToday;

  const [projectFilter, setProjectFilter] = React.useState(projectId ?? "all");
  const [query, setQuery] = React.useState("");
  const [form, setForm] = React.useState<FormState | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const projectNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const visible = React.useMemo(
    () =>
      [...milestones]
        .filter((m) => (projectFilter === "all" ? true : m.projectId === projectFilter))
        .filter((m) => (query.trim() ? m.title.includes(query.trim()) : true))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [milestones, projectFilter, query]
  );

  function openCreate() {
    setActionError(null);
    setForm({ ...EMPTY_FORM, projectId: projectFilter === "all" ? "" : projectFilter });
  }

  function openEdit(m: Milestone) {
    setActionError(null);
    setForm({
      id: m.id,
      title: m.title,
      projectId: m.projectId,
      dueDate: m.dueDate,
      description: m.description ?? "",
      dependencies: m.dependencies ? [...m.dependencies] : [],
    });
  }

  function saveForm(values: FormState): string | null {
    if (!values.id) {
      const result = addMilestone({
        projectId: values.projectId,
        title: values.title,
        dueDate: values.dueDate,
        status: "planned",
        description: values.description || undefined,
        dependencies: values.dependencies.length > 0 ? [...values.dependencies] : undefined,
      });
      if (!result.ok) return result.error;
      setForm(null);
      return null;
    }
    const result = updateMilestone(values.id, {
      title: values.title,
      dueDate: values.dueDate,
      description: values.description || undefined,
      dependencies: [...values.dependencies],
    });
    if (!result.ok) return result.error;
    setForm(null);
    return null;
  }

  function start(m: Milestone) {
    setActionError(null);
    const result = updateMilestone(m.id, { status: "in-progress" });
    if (!result.ok) setActionError(result.error);
  }

  function complete(m: Milestone) {
    setActionError(null);
    const result = updateMilestone(m.id, { status: "done" });
    if (!result.ok) setActionError(result.error);
  }

  function remove(m: Milestone) {
    setActionError(null);
    if (!window.confirm(`متأكد إنك عايز تحذف المرحلة "${m.title}"؟`)) return;
    const result = deleteMilestone(m.id);
    if (!result.ok) setActionError(result.error);
  }

  return (
    <section className={cx("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          المراحل الرئيسية <span className="text-muted-foreground">({milestones.length})</span>
        </h2>
        <span className="text-xs text-muted-foreground">اليوم: {today}</span>
      </div>

      {persistenceError ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-danger">
          تعذّر حفظ بيانات المراحل محليًا: {persistenceError}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-danger">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث…"
          className="h-9 w-36"
        />
        <div className="grow" />
        <Button onClick={openCreate}>
          <Plus className="ms-1 h-4 w-4" />
          مرحلة جديدة
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="مفيش مراحل"
          description="ضيف أول مرحلة رئيسية لتابعة استحقاقات المشروع."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المرحلة</TableHead>
                <TableHead className="w-40">المشروع</TableHead>
                <TableHead className="w-44">الاستحقاق</TableHead>
                <TableHead className="w-32">الحالة</TableHead>
                <TableHead className="w-56 text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((m) => {
                const missed = m.status === "planned" && m.dueDate < today;
                const deps = m.dependencies?.length ?? 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{m.title}</div>
                      {m.description ? (
                        <div className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                          {m.description}
                        </div>
                      ) : null}
                      {deps > 0 ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          تعتمد على {deps} مرحلة
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {projectNameById.get(m.projectId) ?? m.projectId}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={cn("tabular-nums", missed && "font-medium text-danger")}>
                        {formatArabicDate(m.dueDate)}
                      </span>
                      {missed ? (
                        <span className="ms-2 inline-flex items-center gap-1 text-xs font-medium text-danger">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          متأخرة
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={MILESTONE_STATUS_VARIANTS[m.status]}>
                        {MILESTONE_STATUS_LABELS[m.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {m.status === "planned" ? (
                          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => start(m)}>
                            بدء
                          </Button>
                        ) : null}
                        {m.status !== "done" && m.status !== "cancelled" ? (
                          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => complete(m)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            إكمال
                          </Button>
                        ) : null}
                        <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                          تعديل
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 px-3 text-xs text-danger"
                          onClick={() => remove(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {form ? (
        <MilestoneForm
          key={form.id ?? "create"}
          initial={form}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          milestones={milestones}
          onCancel={() => setForm(null)}
          onSubmit={saveForm}
        />
      ) : null}
    </section>
  );
}

export default MilestonesSection;