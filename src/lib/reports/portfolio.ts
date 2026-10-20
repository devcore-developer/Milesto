// صحة المحفظة — التقدم بيتحسب من حالة المهام الحالية (مش تاريخ)
import { diffDays } from "@/lib/timeline/dates";
import type { Deliverable } from "@/types/timeline";
import type { PortfolioSummary, ProjectProgressRow, ReportTask } from "@/types/reports";
import type { ScheduleProject } from "@/types/timeline";

export const PROJECT_INACTIVE_STATUSES = new Set(["completed", "cancelled", "archived"]);

// التقدم المرجح: لو كل المهام فيها وزن > 0 بنستخدمه، وإلا أوزان متساوية — المعادلة معلنة
export function projectProgress(tasks: ReportTask[]): Omit<ProjectProgressRow, "projectId" | "projectName"> | null {
  if (tasks.length === 0) return null;
  const allWeighted = tasks.every((t) => typeof t.weight === "number" && t.weight > 0);
  const weightOf = (t: ReportTask) => (allWeighted && typeof t.weight === "number" ? t.weight : 1);
  const totalWeight = tasks.reduce((s, t) => s + weightOf(t), 0);
  const doneWeight = tasks.reduce((s, t) => s + (t.done ? weightOf(t) : 0), 0);
  return {
    progress: totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100),
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.done).length,
    weighted: allWeighted,
    hasTasks: true,
    overdueTasks: 0,
  };
}

export function buildPortfolioSummary(input: {
  projects: ScheduleProject[];
  tasks: ReportTask[];
  deliverables: Deliverable[];
  today: string;
}): PortfolioSummary {
  const { projects, tasks, deliverables, today } = input;
  const doneById = new Map(tasks.map((t) => [t.id, t.done] as const));

  const tasksCompleted = tasks.filter((t) => t.done).length;
  const tasksActive = tasks.length - tasksCompleted;
  const tasksOverdue = tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today).length;
  const tasksBlocked = tasks.filter((t) => !t.done && t.dependencies.some((d) => doneById.get(d) === false)).length;

  const projectsProgress: ProjectProgressRow[] = projects.map((p) => {
    const pt = tasks.filter((t) => t.projectId === p.id);
    const base = projectProgress(pt);
    const overdueTasks = pt.filter((t) => !t.done && t.dueDate && t.dueDate < today).length;
    return {
      projectId: p.id,
      projectName: p.name,
      progress: base?.progress ?? 0,
      tasksTotal: base?.tasksTotal ?? 0,
      tasksDone: base?.tasksDone ?? 0,
      weighted: base?.weighted ?? false,
      hasTasks: base != null,
      overdueTasks,
    };
  });
  const withTasks = projectsProgress.filter((r) => r.hasTasks);
  const overallProgress =
    withTasks.length === 0 ? null : Math.round(withTasks.reduce((s, r) => s + r.progress, 0) / withTasks.length);

  const deliverablesAccepted = deliverables.filter((d) => d.status === "accepted").length;
  const deliverablesRejected = deliverables.filter((d) => d.status === "rejected").length;
  const deliverablesCancelled = deliverables.filter((d) => d.status === "cancelled").length;
  const deliverablesDelivered = deliverables.filter((d) => d.status === "delivered").length;
  const deliverablesActive = deliverables.length - deliverablesAccepted - deliverablesCancelled;
  const decided = deliverablesAccepted + deliverablesRejected;
  const acceptanceRate = decided === 0 ? null : deliverablesAccepted / decided;

  const isActiveProject = (p: ScheduleProject) => !PROJECT_INACTIVE_STATUSES.has((p.status ?? "").toLowerCase());
  const projectsActive = projects.filter(isActiveProject).length;
  const approachingDeadline = projects.filter((p) => {
    if (!p.dueDate || !isActiveProject(p)) return false;
    const d = diffDays(today, p.dueDate);
    return d >= 0 && d <= 14;
  }).length;

  const projectsAtRisk = projectsProgress.filter((r) => r.overdueTasks > 0).length;

  return {
    projectsTotal: projects.length,
    projectsActive,
    projectsAtRisk,
    approachingDeadline,
    tasksTotal: tasks.length,
    tasksCompleted,
    tasksActive,
    tasksOverdue,
    tasksBlocked,
    deliverablesTotal: deliverables.length,
    deliverablesActive,
    deliverablesDelivered,
    deliverablesAccepted,
    deliverablesRejected,
    deliverablesCancelled,
    acceptanceRate,
    overallProgress,
    projectsProgress,
  };
}