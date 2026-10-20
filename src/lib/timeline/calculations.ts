import { diffDays } from "@/lib/timeline/dates";
import { PRIORITY_ORDER } from "@/lib/timeline/status";
import type {
  DeadlineBucket,
  DeadlineInsights,
  AtRiskItem,
  Deliverable,
  Milestone,
  RecentCompletedItem,
  ScheduleConflict,
  ScheduleData,
  ScheduleTask,
  TimelineEvent,
  TimelineEventKind,
  TimelineFilters,
  AwaitingReviewItem,
  UnscheduledItem,
  DeliverablePriority,
} from "@/types/timeline";

export function buildEvents(
  schedule: ScheduleData,
  deliverables: Deliverable[],
  milestones: Milestone[]
): TimelineEvent[] {
  const projectNameById = new Map(schedule.projects.map((p) => [p.id, p.name] as const));
  const nameOf = (id: string) => projectNameById.get(id) ?? id;
  const events: TimelineEvent[] = [];

  for (const t of schedule.tasks) {
    if (t.done || !t.projectId) continue;
    if (t.dueDate) {
      events.push({
        id: `task_due:${t.id}`, kind: "task_due", date: t.dueDate, title: t.title,
        projectId: t.projectId, projectName: nameOf(t.projectId), refId: t.id,
        refKind: "task", priority: t.priority, done: false,
      });
    }
    if (t.startDate) {
      events.push({
        id: `task_start:${t.id}`, kind: "task_start", date: t.startDate, title: t.title,
        projectId: t.projectId, projectName: nameOf(t.projectId), refId: t.id,
        refKind: "task", priority: t.priority, done: false,
      });
    }
  }

  for (const ph of schedule.phases) {
    if (!ph.endDate || !ph.projectId) continue;
    events.push({
      id: `phase_end:${ph.id}`, kind: "phase_end", date: ph.endDate, title: ph.name,
      projectId: ph.projectId, projectName: nameOf(ph.projectId), refId: ph.id,
      refKind: "phase", priority: "medium", done: false,
    });
  }

  for (const m of milestones) {
    if (m.status !== "planned" || !m.projectId) continue;
    events.push({
      id: `milestone:${m.id}`, kind: "milestone", date: m.date, title: m.title,
      projectId: m.projectId, projectName: nameOf(m.projectId), refId: m.id,
      refKind: "milestone", priority: "high", done: false,
    });
  }

  for (const d of deliverables) {
    if (!d.projectId || d.status === "accepted" || d.status === "cancelled") continue;
    events.push({
      id: `deliverable_due:${d.id}`, kind: "deliverable_due", date: d.dueDate, title: d.title,
      projectId: d.projectId, projectName: nameOf(d.projectId), refId: d.id,
      refKind: "deliverable", priority: d.priority, done: false,
    });
  }

  for (const p of schedule.payments) {
    if (p.cancelled || !p.projectId) continue;
    events.push({
      id: `payment_due:${p.id}`, kind: "payment_due", date: p.dueDate, title: p.title,
      projectId: p.projectId, projectName: nameOf(p.projectId), refId: p.id,
      refKind: "obligation", priority: "high", done: p.fullyPaid,
      payment: { currency: p.currency, amountMinor: p.amountMinor, paidMinor: p.paidMinor, fullyPaid: p.fullyPaid },
    });
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title, "ar")));
  return events;
}

export function filterEvents(events: TimelineEvent[], filters: TimelineFilters, _today: string): TimelineEvent[] {
  return events.filter((e) => {
    if (filters.scope === "active" && e.done) return false;
    if (filters.projectId !== "all" && e.projectId !== filters.projectId) return false;
    if (filters.kinds.length > 0 && !filters.kinds.includes(e.kind)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(e.priority)) return false;
    if (filters.dateFrom && e.date < filters.dateFrom) return false;
    if (filters.dateTo && e.date > filters.dateTo) return false;
    return true;
  });
}

export function bucketOf(dateISO: string, today: string): DeadlineBucket {
  if (dateISO < today) return "overdue"; // نصوص ISO تقارن معجميًا = مقارنة تواريخ صحيحة
  if (dateISO === today) return "today";
  const d = diffDays(today, dateISO);
  if (d <= 7) return "next7";
  if (d <= 30) return "next30";
  return "later";
}

export function filterEventsByBucket(events: TimelineEvent[], bucket: DeadlineBucket, today: string): TimelineEvent[] {
  return events.filter((e) => bucketOf(e.date, today) === bucket);
}

// ⚠️ خطورة تقديرية (estimate وليست تنبؤًا):
// base حسب الأيام المتبقية: بدون تاريخ=20 | متأخر=90 | اليوم=85 | ≤3=70 | ≤7=55 | ≤14=40 | ≤30=25 | غير ذلك=10
// +15 لو معطّلة باعتماد غير مكتمل، +10 لو أولوية حرجة، +5 لو عالية — الحد النهائي 0..100
export function estimateRiskScore(input: { daysLeft?: number; blocked: boolean; priority: DeliverablePriority }): number {
  const { daysLeft, blocked, priority } = input;
  let base: number;
  if (daysLeft == null) base = 20;
  else if (daysLeft < 0) base = 90;
  else if (daysLeft === 0) base = 85;
  else if (daysLeft <= 3) base = 70;
  else if (daysLeft <= 7) base = 55;
  else if (daysLeft <= 14) base = 40;
  else if (daysLeft <= 30) base = 25;
  else base = 10;
  if (blocked) base += 15;
  if (priority === "critical") base += 10;
  else if (priority === "high") base += 5;
  return Math.max(0, Math.min(100, base));
}

export function buildDependencyGraph(tasks: ScheduleTask[]): Map<string, string[]> {
  const ids = new Set(tasks.map((t) => t.id));
  const graph = new Map<string, string[]>();
  for (const t of tasks) {
    graph.set(t.id, t.dependencies.filter((d) => ids.has(d) && d !== t.id));
  }
  return graph;
}

// كشف الدورات بـ DFS — بيرجع كل دورة كمصفوفة معرفات
export function findCircularDependencies(tasks: ScheduleTask[]): string[][] {
  const graph = buildDependencyGraph(tasks);
  const state = new Map<string, number>(); // 0 = في زيارة جارية، 1 = خلص
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seenCycles = new Set<string>();

  const visit = (node: string): void => {
    state.set(node, 0);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const s = state.get(next);
      if (s === 0) {
        const idx = stack.indexOf(next);
        const cycle = stack.slice(idx);
        const key = [...cycle].sort().join("|");
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          cycles.push(cycle);
        }
      } else if (s == null) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 1);
  };

  for (const t of tasks) {
    if (state.get(t.id) == null) visit(t.id);
  }
  return cycles;
}

const OVERLOAD_THRESHOLD = 3;

export function detectConflicts(
  schedule: ScheduleData,
  deliverables: Deliverable[],
  milestones: Milestone[],
  _today: string
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const projectName = new Map(schedule.projects.map((p) => [p.id, p.name] as const));
  const taskById = new Map(schedule.tasks.map((t) => [t.id, t] as const));

  // (1) اعتماد دائري
  for (const cycle of findCircularDependencies(schedule.tasks)) {
    const labels = cycle.map((id) => taskById.get(id)?.title ?? id);
    conflicts.push({
      id: `circular:${[...cycle].sort().join("|")}`,
      type: "circular_dependency",
      severity: "high",
      title: "اعتماد دائري",
      message: `المهام دي معتمدة على بعضها بشكل دائري: ${labels.join(" ← ")}`,
      refs: cycle.map((id) => ({ kind: "task", id, label: taskById.get(id)?.title ?? id })),
    });
  }

  // (2) مهام معطلة + (3) جدولة قبل الاعتماد
  for (const t of schedule.tasks) {
    if (t.done) continue;
    const unfinished = t.dependencies
      .map((d) => taskById.get(d))
      .filter((d): d is ScheduleTask => Boolean(d) && d!.done === false);
    if (unfinished.length > 0) {
      conflicts.push({
        id: `blocked:${t.id}`,
        type: "blocked_task",
        severity: "medium",
        title: "مهمة معطلة",
        message: `«${t.title}» مستنية ${unfinished.length} عنصر اعتماد غير مكتمل`,
        projectId: t.projectId,
        refs: [
          { kind: "task", id: t.id, label: t.title },
          ...unfinished.slice(0, 4).map((u) => ({ kind: "task", id: u.id, label: u.title })),
        ],
      });
    }
    const myStart = t.startDate ?? t.dueDate;
    for (const dep of unfinished) {
      const depEnd = dep.dueDate ?? dep.startDate;
      if (depEnd && myStart && myStart < depEnd) {
        conflicts.push({
          id: `before:${t.id}:${dep.id}`,
          type: "schedule_before_prerequisite",
          severity: "high",
          title: "جدولة قبل الاعتماد",
          message: `«${t.title}» متجدولة (${myStart}) قبل انتهاء الاعتماد «${dep.title}» (${depEnd}) — راجع التواريخ بنفسك، مفيش حاجة اتغيرت أوتوماتيك`,
          projectId: t.projectId,
          date: myStart,
          refs: [
            { kind: "task", id: t.id, label: t.title },
            { kind: "task", id: dep.id, label: dep.title },
          ],
        });
      }
    }
  }

  // (4) أيام محمّلة — كل الأحداث النشطة مجمعة بالتاريخ
  const allEvents = buildEvents(schedule, deliverables, milestones);
  const byDate = new Map<string, TimelineEvent[]>();
  for (const e of allEvents) {
    if (e.done) continue;
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  for (const [date, list] of byDate) {
    if (list.length >= OVERLOAD_THRESHOLD) {
      conflicts.push({
        id: `overload:${date}`,
        type: "overloaded_day",
        severity: "medium",
        title: "يوم محمّل",
        message: `${list.length} أحداث مستحقة في ${date} — في ضغط على اليوم ده`,
        date,
        refs: list.slice(0, 6).map((e) => ({ kind: e.kind, id: e.refId, label: e.title })),
      });
    }
  }

  // (5) تكديس مخرجات عالية الأولوية في نفس المشروع خلال 3 أيام
  const highDels = deliverables.filter(
    (d) => (d.priority === "high" || d.priority === "critical") && d.status !== "accepted" && d.status !== "cancelled"
  );
  const seenClusters = new Set<string>();
  for (let i = 0; i < highDels.length; i++) {
    const a = highDels[i];
    if (!a) continue;
    for (let j = i + 1; j < highDels.length; j++) {
      const b = highDels[j];
      if (!b || a.projectId !== b.projectId || a.id === b.id) continue;
      const gap = Math.abs(diffDays(a.dueDate, b.dueDate));
      if (gap <= 3) {
        const key = [a.id, b.id].sort().join("|");
        if (seenClusters.has(key)) continue;
        seenClusters.add(key);
        conflicts.push({
          id: `cluster:${key}`,
          type: "clustered_high_priority",
          severity: "medium",
          title: "تكديس أولويات",
          message: `مخرجان عاليا الأولوية «${a.title}» و«${b.title}» مستحقين خلال ${gap} يوم في «${projectName.get(a.projectId) ?? a.projectId}»`,
          projectId: a.projectId,
          date: a.dueDate < b.dueDate ? a.dueDate : b.dueDate,
          refs: [
            { kind: "deliverable", id: a.id, label: a.title },
            { kind: "deliverable", id: b.id, label: b.title },
          ],
        });
      }
    }
  }

  return conflicts;
}

export function buildInsights(
  schedule: ScheduleData,
  deliverables: Deliverable[],
  milestones: Milestone[],
  events: TimelineEvent[],
  today: string
): DeadlineInsights {
  const projectName = new Map(schedule.projects.map((p) => [p.id, p.name] as const));
  const nameOf = (id: string) => projectName.get(id) ?? id;
  const active = events.filter((e) => !e.done);

  const overdue: TimelineEvent[] = [];
  const dueToday: TimelineEvent[] = [];
  const next7: TimelineEvent[] = [];
  const next30: TimelineEvent[] = [];
  for (const e of active) {
    const b = bucketOf(e.date, today);
    if (b === "overdue") overdue.push(e);
    else if (b === "today") dueToday.push(e);
    else if (b === "next7") next7.push(e);
    else if (b === "next30") next30.push(e);
  }
  const sortAsc = (a: TimelineEvent, b: TimelineEvent) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  overdue.sort(sortAsc);
  dueToday.sort(sortAsc);
  next7.sort(sortAsc);
  next30.sort(sortAsc);

  const upcomingMilestones = active
    .filter((e) => e.kind === "milestone" && e.date >= today)
    .sort(sortAsc)
    .slice(0, 8);

  const awaitingReview: AwaitingReviewItem[] = deliverables
    .filter((d) => d.status === "ready_for_review" || d.status === "delivered")
    .map((d) => ({
      deliverableId: d.id,
      title: d.title,
      projectId: d.projectId,
      projectName: nameOf(d.projectId),
      status: d.status,
      dueDate: d.dueDate,
    }));

  const taskById = new Map(schedule.tasks.map((t) => [t.id, t] as const));
  const atRisk: AtRiskItem[] = [];
  for (const t of schedule.tasks) {
    if (t.done) continue;
    const blockedBy = t.dependencies.filter((d) => taskById.get(d) && taskById.get(d)!.done === false);
    const blocked = blockedBy.length > 0;
    const daysLeft = t.dueDate ? diffDays(today, t.dueDate) : undefined;
    const qualifies = blocked || (daysLeft != null && daysLeft <= 3);
    if (!qualifies) continue;
    atRisk.push({
      taskId: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: nameOf(t.projectId),
      dueDate: t.dueDate,
      daysLeft,
      blockedBy,
      risk: estimateRiskScore({ daysLeft, blocked, priority: t.priority }),
    });
  }
  atRisk.sort((a, b) => b.risk - a.risk);

  const unscheduled: UnscheduledItem[] = schedule.tasks
    .filter((t) => !t.done && !t.startDate && !t.dueDate)
    .map((t) => ({ taskId: t.id, title: t.title, projectId: t.projectId, projectName: nameOf(t.projectId) }));

  const recentCompleted: RecentCompletedItem[] = deliverables
    .filter((d) => Boolean(d.actualDeliveryDate) && (d.status === "delivered" || d.status === "accepted"))
    .sort((a, b) => (a.actualDeliveryDate! < b.actualDeliveryDate! ? 1 : -1))
    .slice(0, 8)
    .map((d) => ({
      deliverableId: d.id,
      title: d.title,
      projectId: d.projectId,
      projectName: nameOf(d.projectId),
      actualDeliveryDate: d.actualDeliveryDate!,
      status: d.status,
    }));

  return {
    today,
    overdue,
    dueToday,
    next7,
    next30,
    upcomingMilestones,
    awaitingReview,
    atRisk,
    unscheduled,
    recentCompleted,
    counts: { overdue: overdue.length, today: dueToday.length, next7: next7.length, next30: next30.length },
  };
}