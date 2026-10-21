"use client";

import { useMemo, useState } from "react";
import { useProjects } from "@/lib/project-context";

/* ------------------------------------------------------------------ */
/*  Types are derived from the real app context — no demo data here.   */
/* ------------------------------------------------------------------ */

type ProjectRecord = ReturnType<typeof useProjects>["projects"][number];
type TaskRecord = ReturnType<typeof useProjects>["tasks"][number];

type StatusBucket = "planned" | "active" | "done";
type PriorityTone = "high" | "medium" | "low" | "none";
type StatusFilter = "all" | StatusBucket;
type PriorityFilter = "all" | "high" | "medium" | "low";

type TaskView = {
  id: string;
  title: string;
  projectId: string | null;
  status: StatusBucket;
  priority: PriorityTone;
  priorityLabel: string | null;
  weight: number | null;
  dueDate: string | null;
  overdue: boolean;
};

type TaskGroup = {
  key: string;
  name: string;
  tasks: TaskView[];
  doneCount: number;
  weightedProgress: number | null;
};

/* ------------------------------ helpers --------------------------- */

function rec(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function textOf(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function localToday(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(iso: string): string {
  const parts = iso.split("-").map((part) => Number(part));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const DONE_WORDS = new Set(["done", "complete", "completed", "closed", "finished"]);
const ACTIVE_WORDS = new Set(["in-progress", "in_progress", "inprogress", "active", "doing", "current"]);

const STATUS_META: Record<StatusBucket, { label: string; className: string }> = {
  planned: {
    label: "Planned",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  active: {
    label: "In progress",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  done: {
    label: "Done",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
};

const HIGH_PRIORITY_WORDS = new Set(["critical", "urgent", "highest", "high", "p0", "p1"]);
const LOW_PRIORITY_WORDS = new Set(["low", "lowest", "minor", "trivial", "p4", "p5"]);

const PRIORITY_CLASS: Record<Exclude<PriorityTone, "none">, string> = {
  high: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-300",
};

function statusBucket(raw: unknown): StatusBucket {
  const value = textOf(raw).toLowerCase();
  if (DONE_WORDS.has(value)) return "done";
  if (ACTIVE_WORDS.has(value)) return "active";
  return "planned";
}

function priorityInfo(raw: unknown): { tone: PriorityTone; label: string | null } {
  if (raw === null || raw === undefined || raw === "") return { tone: "none", label: null };
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const tone: PriorityTone = raw >= 4 ? "high" : raw <= 2 ? "low" : "medium";
    return { tone, label: `P${raw}` };
  }
  const value = textOf(raw);
  const lowered = value.toLowerCase();
  const tone: PriorityTone = HIGH_PRIORITY_WORDS.has(lowered)
    ? "high"
    : LOW_PRIORITY_WORDS.has(lowered)
      ? "low"
      : "medium";
  return { tone, label: capitalize(value) };
}

function dueDateOf(record: Record<string, unknown>): string | null {
  for (const key of ["dueDate", "dueOn", "deadline", "due"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 10);
  }
  return null;
}

function taskTitle(record: Record<string, unknown>): string {
  return textOf(record.title, "") || textOf(record.name, "") || "Untitled task";
}

function toTaskView(task: TaskRecord, today: string, index: number): TaskView {
  const record = rec(task);
  const bucket = statusBucket(record.status);
  const dueDate = dueDateOf(record);
  const priority = priorityInfo(record.priority);
  const rawWeight = record.weight;
  const weight = typeof rawWeight === "number" && Number.isFinite(rawWeight) ? rawWeight : null;
  return {
    id: textOf(record.id) || `task-${index}`,
    title: taskTitle(record),
    projectId: textOf(record.projectId) || null,
    status: bucket,
    priority: priority.tone,
    priorityLabel: priority.label,
    weight,
    dueDate,
    overdue: bucket !== "done" && dueDate !== null && dueDate < today,
  };
}

function compareTasks(a: TaskView, b: TaskView): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  const rankOf = (tone: PriorityTone) =>
    tone === "high" ? 3 : tone === "medium" ? 2 : tone === "low" ? 1 : 0;
  const rankDiff = rankOf(b.priority) - rankOf(a.priority);
  if (rankDiff !== 0) return rankDiff;
  return a.title.localeCompare(b.title);
}

function projectDisplayName(project: ProjectRecord | null): string {
  if (!project) return "Unassigned";
  const record = rec(project);
  return textOf(record.name, "") || textOf(record.title, "") || "Untitled project";
}

/* ---------------------------- small UI ---------------------------- */

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "info" | "danger";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "info"
        ? "text-sky-600 dark:text-sky-400"
        : tone === "danger"
          ? "text-rose-600 dark:text-rose-400"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function TaskRow({ task }: { task: TaskView }) {
  const statusMeta = STATUS_META[task.status];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-2xs font-medium ${statusMeta.className}`}
      >
        {statusMeta.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
        <p
          className={`mt-0.5 text-xs ${
            task.overdue ? "font-medium text-rose-600 dark:text-rose-400" : "text-muted-foreground"
          }`}
        >
          {task.dueDate
            ? task.overdue
              ? `Overdue · was due ${formatDate(task.dueDate)}`
              : `Due ${formatDate(task.dueDate)}`
            : "No deadline"}
        </p>
      </div>
      {task.priorityLabel && task.priority !== "none" ? (
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-2xs font-medium ${PRIORITY_CLASS[task.priority]}`}
        >
          {task.priorityLabel}
        </span>
      ) : null}
      {task.weight !== null ? (
        <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
          Weight {task.weight}
        </span>
      ) : null}
    </li>
  );
}

/* ------------------------------ page ------------------------------ */

export default function TasksPage() {
  const { projects, tasks } = useProjects();
  const today = useMemo(() => localToday(), []);

  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

  const views = useMemo(
    () => tasks.map((task, index) => toTaskView(task, today, index)),
    [tasks, today]
  );

  const stats = useMemo(() => {
    const total = views.length;
    const done = views.filter((view) => view.status === "done").length;
    const active = views.filter((view) => view.status === "active").length;
    const overdue = views.filter((view) => view.overdue).length;
    const totalWeight = views.reduce((sum, view) => sum + (view.weight ?? 0), 0);
    const allWeighted = total > 0 && views.every((view) => view.weight !== null);

    let weightedProgress: number | null = null;
    if (total > 0) {
      if (allWeighted && totalWeight > 0) {
        const doneWeight = views.reduce(
          (sum, view) => sum + (view.status === "done" ? (view.weight ?? 0) : 0),
          0
        );
        weightedProgress = Math.round((doneWeight / totalWeight) * 100);
      } else {
        weightedProgress = Math.round((done / total) * 100);
      }
    }

    return { total, done, active, overdue, weightedProgress };
  }, [views]);

  const groups = useMemo<TaskGroup[]>(() => {
    const needle = query.trim().toLowerCase();
    const filtered = views.filter((view) => {
      if (projectFilter !== "all" && view.projectId !== projectFilter) return false;
      if (statusFilter !== "all" && view.status !== statusFilter) return false;
      if (priorityFilter !== "all" && view.priority !== priorityFilter) return false;
      if (needle && !view.title.toLowerCase().includes(needle)) return false;
      return true;
    });

    const projectById = new Map(
      projects.map((project) => [textOf(rec(project).id), project])
    );
    const buckets = new Map<string, TaskView[]>();
    for (const view of filtered) {
      const key =
        view.projectId && projectById.has(view.projectId) ? view.projectId : "unassigned";
      const list = buckets.get(key);
      if (list) list.push(view);
      else buckets.set(key, [view]);
    }

    const orderedKeys = [
      ...projects.map((project) => textOf(rec(project).id)).filter((key) => buckets.has(key)),
      ...(buckets.has("unassigned") ? ["unassigned"] : []),
    ];

    return orderedKeys.map((key) => {
      const list = [...(buckets.get(key) ?? [])].sort(compareTasks);
      const doneCount = list.filter((view) => view.status === "done").length;
      const allWeighted = list.length > 0 && list.every((view) => view.weight !== null);
      const totalWeight = list.reduce((sum, view) => sum + (view.weight ?? 0), 0);
      const weightedProgress =
        allWeighted && totalWeight > 0
          ? Math.round(
              (list.reduce(
                (sum, view) => sum + (view.status === "done" ? (view.weight ?? 0) : 0),
                0
              ) /
                totalWeight) *
                100
            )
          : null;
      return {
        key,
        name: key === "unassigned" ? "Unassigned" : projectDisplayName(projectById.get(key) ?? null),
        tasks: list,
        doneCount,
        weightedProgress,
      };
    });
  }, [views, projects, projectFilter, statusFilter, priorityFilter, query]);

  const filtersActive =
    query.trim() !== "" ||
    projectFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Weighted tasks across all projects with priority, status, and deadlines.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total tasks" value={formatInt(stats.total)} hint="Across all projects" />
        <StatCard
          label="Done"
          value={formatInt(stats.done)}
          tone="positive"
          hint={
            stats.weightedProgress !== null
              ? `${stats.weightedProgress}% weighted progress`
              : undefined
          }
        />
        <StatCard label="In progress" value={formatInt(stats.active)} tone="info" />
        <StatCard
          label="Overdue"
          value={formatInt(stats.overdue)}
          tone={stats.overdue > 0 ? "danger" : "default"}
          hint="Past deadline, not done"
        />
        <StatCard
          label="Weighted progress"
          value={stats.weightedProgress !== null ? `${stats.weightedProgress}%` : "—"}
          hint={stats.weightedProgress !== null ? "By task weight" : "Add task weights to unlock"}
        />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks…"
          className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
        />
        <select
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
          aria-label="Filter by project"
          className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All projects</option>
          {projects.map((project, index) => {
            const id = textOf(rec(project).id);
            return (
              <option key={id || `project-${index}`} value={id}>
                {projectDisplayName(project)}
              </option>
            );
          })}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="planned">Planned</option>
          <option value="active">In progress</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
          aria-label="Filter by priority"
          className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {filtersActive ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setProjectFilter("all");
              setStatusFilter("all");
              setPriorityFilter("all");
            }}
            className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Clear filters
          </button>
        ) : null}
      </section>

      {tasks.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No tasks yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Create a project, add its phases, then add tasks from the project workspace. Every
            task across all projects will appear here with its priority, weight, and deadline.
          </p>
        </section>
      ) : groups.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No tasks match the current filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing the search or widening the filters.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const progress =
              group.weightedProgress ??
              (group.tasks.length > 0
                ? Math.round((group.doneCount / group.tasks.length) * 100)
                : 0);
            return (
              <section
                key={group.key}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-foreground">{group.name}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatInt(group.doneCount)} of {formatInt(group.tasks.length)} done
                      {group.weightedProgress !== null
                        ? ` · weighted ${group.weightedProgress}%`
                        : ""}
                    </p>
                  </div>
                  <div className="w-32 sm:w-48">
                    <ProgressBar value={progress} />
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {group.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}