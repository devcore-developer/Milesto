// تحليلات الإنتاجية — من تواريخ الإكمال الفعلية فقط
// ممناع نبني "تاريخ تقدم" من حالات المهام الحالية ونقدمه كأنه تاريخ حقيقي
import { addDaysISO, diffDays, formatArabicDate, startOfWeekISO } from "@/lib/timeline/dates";
import { isDateInRange } from "@/lib/reports/financial";
import type { ProductivitySummary, ReportTask } from "@/types/reports";
import type { SchedulePhase, ScheduleProject } from "@/types/timeline";
import type { DeliverablePriority } from "@/types/timeline";

const ALL_PRIORITIES: DeliverablePriority[] = ["low", "medium", "high", "critical"];

function fillWeeks(buckets: Map<string, number>): { period: string; label: string; completed: number }[] {
  if (buckets.size === 0) return [];
  const weeks = [...buckets.keys()].sort();
  let start = weeks[0]!;
  const end = weeks[weeks.length - 1]!;
  if (diffDays(start, end) > 7 * 15) start = addDaysISO(end, -(7 * 15)); // حد أقصى 16 أسبوع
  const out: { period: string; label: string; completed: number }[] = [];
  let cur = start;
  for (let i = 0; cur <= end && i < 17; cur = addDaysISO(cur, 7), i++) {
    out.push({ period: cur, label: `أسبوع ${formatArabicDate(cur)}`, completed: buckets.get(cur) ?? 0 });
  }
  return out;
}

export function buildProductivitySummary(input: {
  tasks: ReportTask[];
  phases: SchedulePhase[];
  projects: ScheduleProject[];
  today: string;
  dateFrom?: string;
  dateTo?: string;
}): ProductivitySummary {
  const { tasks, phases, projects, today } = input;
  const range = { dateFrom: input.dateFrom, dateTo: input.dateTo };

  const doneWithDate = tasks.filter((t) => t.done && t.completedAt && isDateInRange(t.completedAt, range));
  const hasCompletionDates = doneWithDate.length > 0;

  const buckets = new Map<string, number>();
  for (const t of doneWithDate) {
    const wk = startOfWeekISO(t.completedAt!);
    buckets.set(wk, (buckets.get(wk) ?? 0) + 1);
  }

  let onTime = 0, late = 0, noCompletionDate = 0;
  for (const t of tasks) {
    if (!t.done) continue;
    if (!t.completedAt) { noCompletionDate++; continue; }
    if (!t.dueDate) continue; // من غير ميعاد مخطط مفيش تقييم التزام
    if (t.completedAt <= t.dueDate) onTime++;
    else late++;
  }

  const overdue = tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today);
  const overdueByPriority = ALL_PRIORITIES.map((priority) => ({
    priority,
    count: overdue.filter((t) => t.priority === priority).length,
  }));
  const projectName = new Map(projects.map((p) => [p.id, p.name] as const));
  const overdueByProjectMap = new Map<string, number>();
  for (const t of overdue) overdueByProjectMap.set(t.projectId, (overdueByProjectMap.get(t.projectId) ?? 0) + 1);
  const overdueByProject = [...overdueByProjectMap.entries()]
    .map(([projectId, count]) => ({ projectId, projectName: projectName.get(projectId) ?? projectId, count }))
    .sort((a, b) => b.count - a.count);

  const phaseDurations = phases
    .filter((ph) => Boolean(ph.startDate) && Boolean(ph.endDate))
    .map((ph) => ({
      projectId: ph.projectId,
      projectName: projectName.get(ph.projectId) ?? ph.projectId,
      phaseId: ph.id,
      phaseName: ph.name,
      days: diffDays(ph.startDate!, ph.endDate!) + 1, // شامل الطرفين
    }))
    .sort((a, b) => b.days - a.days);

  const withAssignee = tasks.filter((t) => Boolean(t.assignee));
  const workloadAvailable = withAssignee.length > 0;
  const workloadMap = new Map<string, { total: number; done: number; overdue: number }>();
  for (const t of withAssignee) {
    const key = t.assignee!;
    const agg = workloadMap.get(key) ?? { total: 0, done: 0, overdue: 0 };
    agg.total++;
    if (t.done) agg.done++;
    if (!t.done && t.dueDate && t.dueDate < today) agg.overdue++;
    workloadMap.set(key, agg);
  }

  return {
    hasCompletionDates,
    completionTrend: fillWeeks(buckets),
    onTime, late, noCompletionDate,
    overdueByPriority,
    overdueByProject,
    phaseDurations,
    workload: [...workloadMap.entries()]
      .map(([assignee, agg]) => ({ assignee, ...agg }))
      .sort((a, b) => b.total - a.total),
    workloadAvailable,
  };
}