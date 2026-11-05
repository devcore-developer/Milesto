"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DueChip,
  PRIORITY_COLORS,
  priorityLabelKey,
} from "@/components/mylist/task/badges";
import {
  DeadlineChip,
  ProjectProgress,
  ProjectStatusBadge,
} from "@/components/mylist/project/badges";
import {
  useProjects,
  useStats,
  useTasks,
  useUpdateTask,
} from "@/hooks/use-mylist";
import { formatDate, useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";
import { toDateKey } from "@/lib/calendar-utils";
import type { AuthUser, TaskDTO, TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ListTodo;
  tone: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

function TaskRow({ taskId, title, status, dueDate, priority }: {
  taskId: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: TaskPriority;
}) {
  const { t } = useI18n();
  const updateTask = useUpdateTask();

  return (
    <div className="flex items-center gap-3 py-2.5">
      <Checkbox
        checked={status === "COMPLETED"}
        disabled={updateTask.isPending}
        onCheckedChange={(checked) =>
          updateTask.mutate({
            id: taskId,
            data: { status: checked ? "COMPLETED" : "TODO" },
          })
        }
        aria-label={title}
        className="shrink-0"
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          status === "COMPLETED" ? "text-slate-400 line-through" : "text-slate-700",
        )}
      >
        {title}
      </span>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[priority] }}
        title={t(priorityLabelKey(priority))}
      />
      {dueDate && <DueChip isoDateStr={dueDate} />}
    </div>
  );
}

/** Task that starts today — compact row with a "starts today" chip. */
function StartingTaskRow({ task }: { task: TaskDTO }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        title={t(priorityLabelKey(task.priority))}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
        {task.title}
      </span>
      <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
        {t("dashboard.startsToday")}
      </span>
    </div>
  );
}

export function DashboardView({ user }: { user: AuthUser }) {
  const { t, lang } = useI18n();
  const { data, isLoading } = useStats();
  const { data: projectsData } = useProjects();
  const { data: tasksData } = useTasks();
  const requestNewTask = useUIStore((s) => s.requestNewTask);
  const setView = useUIStore((s) => s.setView);
  const openProject = useUIStore((s) => s.openProject);

  const projects = projectsData?.projects ?? [];
  const tasks = tasksData?.tasks ?? [];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboard.greetingMorning");
    if (h < 18) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
  }, [t]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </div>
    );
  }

  const { totals, completionPct, dueToday, upcoming, byPriority, last7Days } = data.stats;
  const isEmpty = totals.all === 0 && projects.length === 0;

  const priorityData = byPriority.map((p) => ({
    key: p.priority,
    name: t(priorityLabelKey(p.priority)),
    value: p.count,
  }));
  const priorityTotal = byPriority.reduce((sum, p) => sum + p.count, 0);

  // ── Phase 3: today's schedule ─────────────────────────────
  const todayKey = toDateKey(new Date());
  const startingToday = tasks.filter(
    (task) =>
      task.startDate &&
      task.startDate.slice(0, 10) === todayKey &&
      task.status !== "COMPLETED",
  );
  const deadlineToday = projects.filter(
    (p) =>
      p.deadline &&
      p.deadline.slice(0, 10) === todayKey &&
      p.status !== "COMPLETED" &&
      p.status !== "CANCELLED",
  );
  const hasSchedule = dueToday.length > 0 || startingToday.length > 0 || deadlineToday.length > 0;

  // ── Phase 3: upcoming project deliveries ──────────────────
  const upcomingDeliveries = projects
    .filter(
      (p) =>
        p.deliveryDate &&
        p.deliveryDate.slice(0, 10) >= todayKey &&
        p.status !== "COMPLETED" &&
        p.status !== "CANCELLED",
    )
    .sort((a, b) => (a.deliveryDate ?? "").localeCompare(b.deliveryDate ?? ""))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {user.name || user.email}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("tasks.taskCount", { count: totals.all })} · {t("dashboard.completionRate")} {completionPct}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setView("calendar")}>
            <CalendarDays className="size-4" />
            <span className="hidden sm:inline">{t("dashboard.openCalendar")}</span>
          </Button>
          <Button onClick={() => requestNewTask()} className="gap-2">
            <Plus className="size-4" />
            {t("dashboard.quickAddTask")}
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="size-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.noTasksYet")}</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500">{t("dashboard.createFirstTask")}</p>
          </div>
          <Button onClick={() => requestNewTask()} size="lg" className="gap-2">
            <Plus className="size-4" />
            {t("dashboard.quickAddTask")}
          </Button>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("dashboard.totalTasks")} value={totals.all} icon={ListTodo} tone="bg-primary/10 text-primary" />
            <StatCard label={t("dashboard.completedTasks")} value={totals.completed} icon={CheckCircle2} tone="bg-blue-600/10 text-blue-600" />
            <StatCard label={t("dashboard.inProgressTasks")} value={totals.inProgress} icon={CalendarClock} tone="bg-sky-500/10 text-sky-600" />
            <StatCard label={t("dashboard.overdueTasks")} value={totals.overdue} icon={AlertTriangle} tone="bg-red-600/10 text-red-600" />
          </div>

          {/* Phase 3: today's schedule + upcoming deliveries */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="size-4 text-primary" />
                  {t("dashboard.todaySchedule")}
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => setView("calendar")}>
                  {t("dashboard.openCalendar")}
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {!hasSchedule ? (
                  <div className="flex flex-col items-center gap-1 py-8 text-center">
                    <CheckCircle2 className="size-8 text-emerald-500" />
                    <p className="text-sm font-medium text-slate-600">
                      {t("dashboard.nothingScheduled")}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dueToday.slice(0, 5).map((task) => (
                      <TaskRow
                        key={task.id}
                        taskId={task.id}
                        title={task.title}
                        status={task.status}
                        dueDate={task.dueDate}
                        priority={task.priority}
                      />
                    ))}
                    {startingToday.slice(0, 3).map((task) => (
                      <StartingTaskRow key={`start-${task.id}`} task={task} />
                    ))}
                    {deadlineToday.map((p) => (
                      <button
                        key={`dl-${p.id}`}
                        onClick={() => openProject(p.id)}
                        className="flex w-full items-center gap-3 py-2.5 text-start transition-colors hover:bg-slate-50"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color ?? "#1E3A8A" }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                          {p.name}
                        </span>
                        <ProjectStatusBadge status={p.status} />
                        <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                          {t("projects.dueTodayLabel")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderKanban className="size-4 text-primary" />
                  {t("dashboard.projectDeliveries")}
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => setView("projects")}>
                  {t("dashboard.projectsViewAll")}
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {upcomingDeliveries.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 py-8 text-center">
                    <FolderKanban className="size-8 text-slate-300" />
                    <p className="text-sm text-slate-400">{t("dashboard.noDeliveries")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {upcomingDeliveries.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => openProject(p.id)}
                        className="flex w-full items-center gap-3 py-2.5 text-start transition-colors hover:bg-slate-50"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color ?? "#1E3A8A" }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-700">
                            {p.name}
                          </span>
                          <span className="mt-1 block max-w-56">
                            <ProjectProgress pct={p.progressPct} compact />
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                          {formatDate(p.deliveryDate, lang)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Projects overview */}
          {projects.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderKanban className="size-4 text-primary" />
                  {t("dashboard.projectsOverview")}
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => setView("projects")}>
                  {t("dashboard.projectsViewAll")}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {(() => {
                  const active = projects.filter((p) => p.status === "ACTIVE").length;
                  const overdue = projects.filter((p) => p.overdue).length;
                  const dueSoon = projects.filter(
                    (p) =>
                      !p.overdue &&
                      p.status !== "COMPLETED" &&
                      p.status !== "CANCELLED" &&
                      p.daysRemaining !== null &&
                      p.daysRemaining >= 0 &&
                      p.daysRemaining <= 7,
                  ).length;
                  const completed = projects.filter((p) => p.status === "COMPLETED").length;
                  const chips = [
                    { label: t("projects.activeProjects"), count: active, tone: "bg-blue-50 text-blue-700" },
                    { label: t("projects.dueSoonProjects"), count: dueSoon, tone: "bg-sky-50 text-sky-700" },
                    { label: t("projects.overdueProjects"), count: overdue, tone: "bg-red-50 text-red-700" },
                    { label: t("projects.completedProjects"), count: completed, tone: "bg-emerald-50 text-emerald-700" },
                  ];
                  const sorted = [...projects]
                    .filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED")
                    .sort((a, b) => {
                      const aD = a.deadline ? Date.parse(a.deadline) : Number.POSITIVE_INFINITY;
                      const bD = b.deadline ? Date.parse(b.deadline) : Number.POSITIVE_INFINITY;
                      return aD - bD;
                    })
                    .slice(0, 4);
                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {chips.map((chip) => (
                          <span
                            key={chip.label}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                              chip.tone,
                            )}
                          >
                            {chip.label}
                            <span className="font-bold">{chip.count}</span>
                          </span>
                        ))}
                      </div>
                      {sorted.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {sorted.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => openProject(p.id)}
                              className="flex w-full items-center gap-3 py-2.5 text-start transition-colors hover:bg-slate-50"
                            >
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: p.color ?? "#1E3A8A" }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-700">
                                  {p.name}
                                </span>
                                <span className="mt-1 block max-w-64">
                                  <ProjectProgress pct={p.progressPct} compact />
                                </span>
                              </span>
                              <ProjectStatusBadge status={p.status} />
                              <DeadlineChip
                                deadline={p.deadline}
                                overdue={p.overdue}
                                daysRemaining={p.daysRemaining}
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="py-4 text-center text-sm text-slate-400">
                          {t("dashboard.allCaughtUp")}
                        </p>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Completion + charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm font-medium text-slate-500">{t("dashboard.completionRate")}</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-primary">
                {completionPct}%
              </p>
              <Progress value={completionPct} className="mt-4 h-2.5" />
              <p className="mt-3 text-xs text-slate-400">
                {totals.completed}/{totals.all} {t("dashboard.completedTasks").toLowerCase()}
              </p>
            </Card>

            <Card className="p-5 lg:col-span-1">
              <p className="text-sm font-medium text-slate-500">{t("dashboard.weeklyCompleted")}</p>
              <div className="mt-2" dir="ltr">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={last7Days} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} stroke="#94A3B8" />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} stroke="#94A3B8" />
                    <Tooltip cursor={{ fill: "rgba(30,58,138,0.06)" }} />
                    <Bar dataKey="completed" fill="#1E3A8A" radius={[5, 5, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-sm font-medium text-slate-500">{t("dashboard.priorityBreakdown")}</p>
              {priorityTotal === 0 ? (
                <div className="flex h-[180px] items-center justify-center text-sm text-slate-400">
                  {t("dashboard.allCaughtUp")}
                </div>
              ) : (
                <div className="flex items-center gap-2" dir="ltr">
                  <ResponsiveContainer width="55%" height={180}>
                    <PieChart>
                      <Pie
                        data={priorityData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {priorityData.map((entry) => (
                          <Cell key={entry.key} fill={PRIORITY_COLORS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex-1 space-y-1.5">
                    {priorityData.map((p) => (
                      <li key={p.key} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p.key] }} />
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="font-semibold text-slate-800">{p.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          {/* Due today + upcoming */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{t("dashboard.dueToday")}</CardTitle>
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => setView("tasks")}>
                  {t("dashboard.viewAll")}
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {dueToday.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 py-8 text-center">
                    <CheckCircle2 className="size-8 text-emerald-500" />
                    <p className="text-sm font-medium text-slate-600">{t("dashboard.nothingDueToday")}</p>
                    <p className="text-xs text-slate-400">{t("dashboard.allCaughtUp")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dueToday.slice(0, 6).map((task) => (
                      <TaskRow
                        key={task.id}
                        taskId={task.id}
                        title={task.title}
                        status={task.status}
                        dueDate={task.dueDate}
                        priority={task.priority}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("dashboard.upcomingDeadlines")}</CardTitle>
                <CardDescription>{t("dashboard.next7Days")}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {upcoming.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 py-8 text-center">
                    <CalendarClock className="size-8 text-slate-300" />
                    <p className="text-sm text-slate-400">{t("dashboard.noUpcomingDeadlines")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {upcoming.slice(0, 6).map((task) => (
                      <TaskRow
                        key={task.id}
                        taskId={task.id}
                        title={task.title}
                        status={task.status}
                        dueDate={task.dueDate}
                        priority={task.priority}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}