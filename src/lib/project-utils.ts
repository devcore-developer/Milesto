// Shared project computation helpers — safe on both server and client.
import type { ProjectDTO, ProjectStatus, TaskDTO } from "@/lib/types";
import { projectTotalValue } from "@/lib/finance";

const DAY_MS = 86_400_000;

/** Start of "today" as a local-time midnight timestamp. */
export function startOfLocalDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Whole days between today and the target date (local calendar days).
 * Negative values mean the date is in the past.
 */
export function calendarDaysUntil(iso: string | Date | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return Math.round((t.setHours(0, 0, 0, 0) - startOfLocalDay()) / DAY_MS);
}

/** A project is overdue when its deadline passed and it is not finished/cancelled. */
export function isProjectOverdue(
  deadline: string | null,
  status: ProjectStatus,
): boolean {
  if (!deadline || status === "COMPLETED" || status === "CANCELLED") return false;
  const days = calendarDaysUntil(deadline);
  return days !== null && days < 0;
}

/** Auto progress = completed tasks / total tasks (0% when no tasks). */
export function projectProgress(tasks: Pick<TaskDTO, "status">[]): {
  taskTotal: number;
  taskDone: number;
  progressPct: number;
} {
  const taskTotal = tasks.length;
  const taskDone = tasks.filter((t) => t.status === "COMPLETED").length;
  const progressPct = taskTotal === 0 ? 0 : Math.round((taskDone / taskTotal) * 100);
  return { taskTotal, taskDone, progressPct };
}

/** Tailwind classes for each project status badge. */
export const PROJECT_STATUS_TONES: Record<ProjectStatus, string> = {
  PLANNING: "border-slate-200 bg-slate-100 text-slate-600",
  ACTIVE: "border-blue-200 bg-blue-50 text-blue-700",
  ON_HOLD: "border-amber-200 bg-amber-50 text-amber-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

/** Solid color used for timeline bars / card accents. */
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  PLANNING: "#64748B",
  ACTIVE: "#1E3A8A",
  ON_HOLD: "#D97706",
  COMPLETED: "#059669",
  CANCELLED: "#DC2626",
};

/**
 * Minimal structural type for a Prisma Project row plus optional aggregates.
 * Defined manually so any `include` shape that carries `_count: { tasks }`
 * (or a `doneCount` override) is accepted.
 */
export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: Date | null;
  deadline: Date | null;
  deliveryDate: Date | null;
  color: string | null;
  notes: string | null;
  // ── Financials (Phase 4) ──
  agreedPrice: number;
  additionalCharges: number;
  additionalNotes: string | null;
  discount: number;
  clientId: string | null;
  client?: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { tasks: number };
  doneCount?: number;
}

/** Serialize a Project row (with optional task aggregates) into its wire DTO. */
export function serializeProject(project: ProjectRow, doneCount?: number): ProjectDTO {
  const taskTotal = project._count?.tasks ?? 0;
  const taskDone = doneCount ?? project.doneCount ?? 0;
  const progressPct = taskTotal === 0 ? 0 : Math.round((taskDone / taskTotal) * 100);
  const status = project.status as ProjectStatus;
  const deadlineIso = project.deadline ? project.deadline.toISOString() : null;
  const client = project.client
    ? { id: project.client.id, name: project.client.name }
    : project.clientId
      ? { id: project.clientId, name: "" }
      : null;
  const agreedPrice = project.agreedPrice ?? 0;
  const additionalCharges = project.additionalCharges ?? 0;
  const discount = project.discount ?? 0;
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status,
    priority: project.priority as ProjectDTO["priority"],
    startDate: project.startDate?.toISOString() ?? null,
    deadline: deadlineIso,
    deliveryDate: project.deliveryDate?.toISOString() ?? null,
    color: project.color,
    notes: project.notes,
    taskTotal,
    taskDone,
    progressPct,
    overdue: isProjectOverdue(deadlineIso, status),
    daysRemaining: calendarDaysUntil(project.deadline),
    client,
    agreedPrice,
    additionalCharges,
    additionalNotes: project.additionalNotes ?? null,
    discount,
    totalValue: projectTotalValue({ agreedPrice, additionalCharges, discount }),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}