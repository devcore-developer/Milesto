"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarCog, Diamond, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useSetDependencies, useTasks, useTimelineCompute, useUpdateTask } from "@/hooks/use-mylist";
import { formatDate, useI18n } from "@/lib/i18n";
import type { ProjectDTO, TaskDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

interface Scale {
  from: number;
  totalDays: number;
  dayWidth: number;
}

function buildTaskScale(tasks: TaskDTO[], project: ProjectDTO): Scale {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let min = todayMid - 7 * DAY_MS;
  let max = todayMid + 30 * DAY_MS;
  for (const t of tasks) {
    if (t.startDate) min = Math.min(min, new Date(t.startDate).setHours(0, 0, 0, 0));
    if (t.dueDate) max = Math.max(max, new Date(t.dueDate).setHours(0, 0, 0, 0));
  }
  if (project.startDate) min = Math.min(min, new Date(project.startDate).setHours(0, 0, 0, 0));
  if (project.deadline) max = Math.max(max, new Date(project.deadline).setHours(0, 0, 0, 0));
  min -= 2 * DAY_MS;
  max += 2 * DAY_MS;
  const totalDays = Math.max(14, Math.round((max - min) / DAY_MS));
  const dayWidth = Math.min(40, Math.max(9, 900 / totalDays));
  return { from: min, totalDays, dayWidth };
}

function isoToOffset(scale: Scale, iso: string): number {
  return Math.round((new Date(iso).setHours(0, 0, 0, 0) - scale.from) / DAY_MS);
}

function shiftISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const ROW_H = 34;
const NAME_W = 160;

// ─────────────── date/dependency editor ───────────────

function TaskEditDialog({
  task,
  tasks,
  onClose,
}: {
  task: TaskDTO;
  tasks: TaskDTO[];
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const updateTask = useUpdateTask();
  const setDepsMutation = useSetDependencies();

  const [startDate, setStartDate] = useState(
    task.startDate ? task.startDate.slice(0, 10) : "",
  );
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [deps, setDeps] = useState<Set<string>>(new Set(task.dependsOn));
  const others = tasks.filter((x) => x.id !== task.id);

  function save() {
    updateTask.mutate(
      {
        id: task.id,
        data: {
          startDate: startDate || null,
          dueDate: dueDate || null,
        },
      },
      {
        onSuccess: () => {
          setDepsMutation.mutate(
            { taskId: task.id, dependsOnIds: [...deps] },
            { onSuccess: onClose },
          );
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base" dir="auto">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tl-start">{t("tasks.startDateLabel")}</Label>
              <Input
                id="tl-start"
                type="date"
                dir="ltr"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl-due">{t("tasks.dueDateLabel")}</Label>
              <Input
                id="tl-due"
                type="date"
                dir="ltr"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("sched.dependsOn")}</Label>
            {others.length === 0 ? (
              <p className="text-xs text-slate-400">{t("sched.noDates")}</p>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {others.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
                  >
                    <Checkbox
                      checked={deps.has(o.id)}
                      onCheckedChange={(c) =>
                        setDeps((s) => {
                          const next = new Set(s);
                          if (c === true) next.add(o.id);
                          else next.delete(o.id);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate" dir="auto">{o.title}</span>
                    {o.isMilestone && <Diamond className="size-3 text-amber-500" />}
                  </label>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">{formatDate(task.startDate, lang, "d MMM")} → {formatDate(task.dueDate, lang, "d MMM")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button
            onClick={save}
            disabled={updateTask.isPending || setDepsMutation.isPending}
          >
            {(updateTask.isPending || setDepsMutation.isPending) && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── recalculate panel ───────────────

function RecalculateDialog({
  project,
  onClose,
}: {
  project: ProjectDTO;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const compute = useTimelineCompute();
  const [mode, setMode] = useState<"forward" | "backward">(
    project.deadline && !project.startDate ? "backward" : "forward",
  );
  const [overwriteAll, setOverwriteAll] = useState(false);

  const preview = compute.data;

  const tasksQuery = useTasks({ projectId: project.id });
  const currentDates = useMemo(
    () => new Map((tasksQuery.data?.tasks ?? []).map((t) => [t.id, t])),
    [tasksQuery.data],
  );

  function runPreview() {
    compute.mutate({
      projectId: project.id,
      body: {
        mode,
        apply: false,
        startDate: project.startDate ?? undefined,
        deadline: project.deadline,
      },
    });
  }

  function apply() {
    compute.mutate(
      {
        projectId: project.id,
        body: {
          mode,
          apply: true,
          overwriteAll,
          startDate: project.startDate ?? undefined,
          deadline: project.deadline,
        },
      },
      { onSuccess: () => onClose() },
    );
  }

  const changes =
    preview?.schedule?.filter((s) => {
      const cur = currentDates.get(s.taskId);
      if (!s.start || !s.end) return false;
      if (!cur) return true;
      const same =
        cur.startDate?.slice(0, 10) === s.start && cur.dueDate?.slice(0, 10) === s.end;
      return !same;
    }) ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{t("sched.previewTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Select value={mode} onValueChange={(v) => setMode(v as "forward" | "backward")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="forward">{t("sched.forward")}</SelectItem>
                <SelectItem value="backward">{t("sched.backward")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={runPreview} disabled={compute.isPending}>
              {compute.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("sched.preview")}
            </Button>
            {preview && preview.makespanDays > 0 && (
              <Badge variant="secondary">
                {t("sched.makespan", { n: preview.makespanDays })}
              </Badge>
            )}
          </div>

          {preview?.cyclic?.length ? (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">
              ⚠ {t("sched.cycleWarning")}
            </p>
          ) : null}

          {!preview && (
            <p className="text-sm text-slate-400">{t("sched.preview")}: —</p>
          )}
          {preview && changes.length === 0 && (
            <p className="text-sm text-slate-500">{t("sched.noChanges")}</p>
          )}
          {changes.length > 0 && (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {changes.map((s) => (
                <li key={s.taskId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-700" dir="auto">
                    {s.isMilestone && "◆ "}
                    {s.title}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500" dir="ltr">
                    {formatDate(s.start, lang, "d MMM")} → {formatDate(s.end, lang, "d MMM")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <Checkbox
              checked={overwriteAll}
              onCheckedChange={(c) => setOverwriteAll(c === true)}
            />
            {t("sched.overwriteAll")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={apply} disabled={compute.isPending}>
            {compute.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("sched.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── the expanded project task timeline ───────────────

export function ProjectTaskTimeline({ project }: { project: ProjectDTO }) {
  const { t } = useI18n();
  const tasksQuery = useTasks({ projectId: project.id });
  const tasks = tasksQuery.data?.tasks ?? [];
  const updateTask = useUpdateTask();
  const scale = useMemo(() => buildTaskScale(tasks, project), [tasks, project]);

  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [recalc, setRecalc] = useState(false);
  const dragRef = useRef<{
    taskId: string;
    startX: number;
    startIso: string | null;
    dueIso: string | null;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState<Record<string, number>>({});

  const todayOffset = Math.round(
    (new Date().setHours(0, 0, 0, 0) - scale.from) / DAY_MS,
  );

  function onPointerDown(e: React.PointerEvent, task: TaskDTO) {
    if (!task.startDate || !task.dueDate) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      taskId: task.id,
      startX: e.clientX,
      startIso: task.startDate.slice(0, 10),
      dueIso: task.dueDate.slice(0, 10),
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const days = Math.round((e.clientX - drag.startX) / scale.dayWidth);
    setDragDelta((d) => ({ ...d, [drag.taskId]: days }));
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const days = dragDelta[drag.taskId] ?? 0;
    setDragDelta((d) => {
      const { [drag.taskId]: _removed, ...rest } = d;
      return rest;
    });
    if (days !== 0 && drag.startIso && drag.dueIso) {
      updateTask.mutate({
        id: drag.taskId,
        data: {
          startDate: shiftISO(drag.startIso, days),
          dueDate: shiftISO(drag.dueIso, days),
        },
      });
    }
  }

  if (tasksQuery.isLoading) {
    return <p className="px-3 py-3 text-sm text-slate-400">{t("loading")}</p>;
  }
  if (tasks.length === 0) {
    return <p className="px-3 py-3 text-sm text-slate-400">{t("sched.noDates")}</p>;
  }

  const trackW = scale.totalDays * scale.dayWidth;
  const rowBottom = (i: number) => (i + 1) * ROW_H;

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3" dir="ltr">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRecalc(true)}>
          <CalendarCog className="size-3.5" />
          {t("sched.recalculate")}
        </Button>
        <span className="text-xs text-slate-400">{t("sched.dragHint")}</span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: NAME_W + trackW + 16 }}>
          {/* header */}
          <div className="flex" style={{ height: 22 }}>
            <div style={{ width: NAME_W }} />
            <div className="relative" style={{ width: trackW }}>
              {Array.from({ length: Math.min(scale.totalDays, 400) }).map((_, i) => {
                const d = new Date(scale.from + i * DAY_MS);
                const isWeekend = d.getDay() === 5 || d.getDay() === 6;
                return isWeekend ? (
                  <span
                    key={i}
                    className="absolute inset-y-0 bg-slate-200/50"
                    style={{ left: i * scale.dayWidth, width: scale.dayWidth }}
                  />
                ) : null;
              })}
            </div>
          </div>

          {/* task rows */}
          <div className="relative">
            {tasks.map((task, i) => {
              const delta = dragDelta[task.id] ?? 0;
              const start = task.startDate
                ? isoToOffset(scale, task.startDate) + delta
                : null;
              const end = task.dueDate
                ? isoToOffset(scale, task.dueDate) + delta
                : null;
              const isDone = task.status === "COMPLETED";
              const overdue =
                !isDone && task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
              const barTop = i * ROW_H + (ROW_H - 16) / 2;
              return (
                <div key={task.id} className="flex items-center" style={{ height: ROW_H }}>
                  <div style={{ width: NAME_W }} className="flex min-w-0 items-center gap-1 pe-2">
                    {task.isMilestone && <Diamond className="size-3 shrink-0 text-amber-500" />}
                    <button
                      type="button"
                      onClick={() => setEditing(task)}
                      className="truncate text-xs text-slate-600 hover:text-primary hover:underline"
                      dir="auto"
                      title={task.title}
                    >
                      {task.title}
                    </button>
                  </div>
                  <div className="relative" style={{ width: trackW, height: ROW_H }}>
                    {start !== null && end !== null ? (
                      task.isMilestone ? (
                        <button
                          type="button"
                          className="absolute z-[5] cursor-grab active:cursor-grabbing"
                          style={{
                            left: start * scale.dayWidth - 6,
                            top: barTop,
                          }}
                          onPointerDown={(e) => onPointerDown(e, task)}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          onClick={() => setEditing(task)}
                          aria-label={task.title}
                        >
                          <Diamond
                            className={cn(
                              "size-3.5",
                              overdue ? "text-red-500 fill-red-100" : "text-amber-500 fill-amber-100",
                            )}
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={cn(
                            "absolute z-[5] flex h-4 cursor-grab items-center overflow-hidden rounded-full shadow-sm ring-1 ring-black/5 active:cursor-grabbing",
                            isDone ? "bg-slate-400" : "bg-primary",
                            overdue && "ring-2 ring-red-400",
                          )}
                          style={{
                            left: start * scale.dayWidth,
                            width: Math.max((end - start + 1) * scale.dayWidth, 8),
                            top: barTop,
                          }}
                          onPointerDown={(e) => onPointerDown(e, task)}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          onClick={() => setEditing(task)}
                          aria-label={task.title}
                          title={task.title}
                        />
                      )
                    ) : (
                      <span
                        className="absolute z-[5] size-2 rounded-full bg-slate-300"
                        style={{ left: 0, top: barTop + 6 }}
                        title={t("sched.editDates")}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* dependency arrows overlay */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={NAME_W + trackW}
              height={tasks.length * ROW_H}
            >
              {tasks.map((task, i) =>
                task.dependsOn.map((depId) => {
                  const depIdx = tasks.findIndex((x) => x.id === depId);
                  if (depIdx === -1) return null;
                  const dep = tasks[depIdx];
                  if (!dep.dueDate) return null;
                  const x1 = isoToOffset(scale, dep.dueDate) * scale.dayWidth + NAME_W + scale.dayWidth / 2;
                  const y1 = depIdx * ROW_H + ROW_H / 2;
                  const target = task.startDate
                    ? isoToOffset(scale, task.startDate) * scale.dayWidth + NAME_W
                    : NAME_W + 4;
                  const x2 = target;
                  const y2 = i * ROW_H + ROW_H / 2;
                  const mid = (y1 + y2) / 2;
                  return (
                    <path
                      key={`${depId}-${task.id}`}
                      d={`M ${x1} ${y1} C ${x1 + 14} ${y1}, ${x2 - 14} ${mid}, ${x2} ${y2}`}
                      fill="none"
                      stroke="rgb(148 163 184)"
                      strokeWidth="1"
                      markerEnd="url(#arrow-head)"
                    />
                  );
                }),
              )}
              <defs>
                <marker
                  id="arrow-head"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" fill="rgb(148 163 184)" />
                </marker>
              </defs>
            </svg>

            {/* today line */}
            <span
              className="pointer-events-none absolute inset-y-0 z-[8] w-px bg-red-400/70"
              style={{ left: NAME_W + todayOffset * scale.dayWidth }}
            />
          </div>
        </div>
      </div>

      {editing && (
        <TaskEditDialog task={editing} tasks={tasks} onClose={() => setEditing(null)} />
      )}
      {recalc && <RecalculateDialog project={project} onClose={() => setRecalc(false)} />}
    </div>
  );
}