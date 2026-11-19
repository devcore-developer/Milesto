// Deterministic scheduling engine (Phase A4) — pure functions, client-safe.
//
// The engine RECOMPUTES dates from: start/deadline, per-task durations,
// configurable working days/hours/holidays, and finish-to-start
// dependencies. It NEVER mutates anything itself — routes/UI apply the
// result, and manually approved dates are only overwritten when the user
// explicitly asks (see POST /api/projects/:id/timeline).
//
// All dates are local-midnight ISO strings ("YYYY-MM-DDT00:00:00.000Z"
// style from Date.toISOString on a local midnight Date) — deterministic
// across server/client because everything flows through the same helpers.

const DAY_MS = 86_400_000;

export interface ScheduleTaskInput {
  id: string;
  title: string;
  isMilestone: boolean;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  dependsOn: string[];
  /** Working-day duration; callers derive it (see deriveDurationDays). */
  durationDays?: number;
}

export interface ScheduleOptions {
  /** ISO date — anchor for forward scheduling. */
  startDate: string;
  /** ISO date — anchor for backward scheduling. */
  deadline?: string | null;
  /** Weekday numbers, 0=Sunday (derived from BusinessSettings.workingDays). */
  workingDays: number[];
  /** "YYYY-MM-DD" (fixed) or "MM-DD" (yearly recurring). */
  holidays: string[];
  mode: "forward" | "backward";
}

export interface ScheduledTask {
  taskId: string;
  title: string;
  isMilestone: boolean;
  /** ISO local-midnight dates; null when unschedulable (cycle/missing dep). */
  start: string | null;
  end: string | null;
  durationDays: number;
}

export interface ScheduleResult {
  scheduled: ScheduledTask[];
  /** Working-day span of the whole plan (forward mode). */
  makespanDays: number;
  planStart: string | null;
  planEnd: string | null;
  /** Task ids stuck in a dependency cycle (or depending on one). */
  cyclic: string[];
}

// ───────────────────── working-day math ─────────────────────

/** Local midnight of an ISO-ish date string (or epoch number). */
function midnight(value: string | number): Date {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Holiday match: exact "YYYY-MM-DD" or recurring "MM-DD". */
function isHoliday(d: Date, holidays: string[]): boolean {
  const full = toISODate(d);
  const md = full.slice(5);
  return holidays.includes(full) || holidays.includes(md);
}

export function isWorkingDay(d: Date, workingDays: number[], holidays: string[]): boolean {
  return workingDays.includes(d.getDay()) && !isHoliday(d, holidays);
}

/** First working day at or after `d`. */
export function nextWorkingDay(d: Date, workingDays: number[], holidays: string[]): Date {
  const c = new Date(d);
  let guard = 0;
  while (!isWorkingDay(c, workingDays, holidays) && guard < 400) {
    c.setDate(c.getDate() + 1);
    guard += 1;
  }
  return c;
}

/** `n` working days after the first working day on/after `from`
 *  (duration 0 → the anchor day itself, for milestones). */
export function addWorkingDays(
  from: Date,
  n: number,
  workingDays: number[],
  holidays: string[],
): Date {
  const c = nextWorkingDay(new Date(from), workingDays, holidays);
  if (n <= 0) return c;
  let remaining = n;
  while (remaining > 0) {
    c.setDate(c.getDate() + 1);
    if (isWorkingDay(c, workingDays, holidays)) remaining -= 1;
  }
  return c;
}

/** Working days between two dates, INCLUSIVE on both ends. */
export function workingDaysBetween(a: Date, b: Date, workingDays: number[], holidays: string[]): number {
  if (b < a) return 0;
  let count = 0;
  const c = new Date(a);
  while (c <= b) {
    if (isWorkingDay(c, workingDays, holidays)) count += 1;
    c.setDate(c.getDate() + 1);
  }
  return count;
}

/** Duration (working days) of a task: explicit span when both dates exist,
 *  else the caller-provided default. Milestones are always 0. */
export function deriveDurationDays(
  task: Pick<ScheduleTaskInput, "isMilestone" | "startDate" | "dueDate">,
  workingDays: number[],
  holidays: string[],
  defaultDays: number,
): number {
  if (task.isMilestone) return 0;
  if (task.startDate && task.dueDate) {
    return Math.max(
      1,
      workingDaysBetween(
        midnight(task.startDate),
        midnight(task.dueDate),
        workingDays,
        holidays,
      ),
    );
  }
  return Math.max(0, defaultDays);
}

// ───────────────────── graph helpers ─────────────────────

/** Kahn topological order; returns null for the set stuck in cycles. */
function topoOrder(
  tasks: ScheduleTaskInput[],
): { order: string[]; cyclic: string[] } | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const t of tasks) {
    const deps = t.dependsOn.filter((d) => byId.has(d) && d !== t.id);
    indegree.set(t.id, deps.length);
    for (const d of deps) {
      dependents.set(d, [...(dependents.get(d) ?? []), t.id]);
    }
  }
  const queue = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of dependents.get(id) ?? []) {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  if (order.length !== tasks.length) {
    const cyclic = tasks
      .filter((t) => !order.includes(t.id))
      .map((t) => t.id);
    return { order, cyclic };
  }
  return { order, cyclic: [] };
}

// ───────────────────── the engine ─────────────────────

export function scheduleProject(
  tasks: ScheduleTaskInput[],
  opts: ScheduleOptions,
  defaultDurationDays = 1,
): ScheduleResult {
  const workingDays = opts.workingDays.length
    ? opts.workingDays
    : [0, 1, 2, 3, 4];
  const holidays = opts.holidays;

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const topo = topoOrder(tasks);
  if (!topo) {
    return {
      scheduled: [],
      makespanDays: 0,
      planStart: null,
      planEnd: null,
      cyclic: tasks.map((t) => t.id),
    };
  }

  const endOf = new Map<string, Date>();
  const startOf = new Map<string, Date>();
  const durationOf = new Map<string, number>();

  if (opts.mode === "forward") {
    const anchor = nextWorkingDay(midnight(opts.startDate), workingDays, holidays);
    for (const id of topo.order) {
      const task = byId.get(id) as ScheduleTaskInput;
      const duration = task.durationDays ??
        deriveDurationDays(task, workingDays, holidays, defaultDurationDays);
      durationOf.set(id, duration);
      // Start after the project anchor AND after every dependency ends.
      let start = new Date(anchor);
      for (const depId of task.dependsOn) {
        const depEnd = endOf.get(depId);
        if (!depEnd) continue;
        const dayAfter = new Date(depEnd);
        dayAfter.setDate(dayAfter.getDate() + 1);
        const candidate = nextWorkingDay(dayAfter, workingDays, holidays);
        if (candidate > start) start = candidate;
      }
      const end = addWorkingDays(start, Math.max(0, duration - 1), workingDays, holidays);
      startOf.set(id, start);
      endOf.set(id, duration === 0 ? start : end);
    }
  } else {
    // Backward: pull from the deadline (deps finish before dependents start).
    const anchorRaw = opts.deadline
      ? midnight(opts.deadline)
      : midnight(opts.startDate);
    const anchor = nextWorkingDay(anchorRaw, workingDays, holidays);
    const reversed = [...topo.order].reverse();
    for (const id of reversed) {
      const task = byId.get(id) as ScheduleTaskInput;
      const duration = task.durationDays ??
        deriveDurationDays(task, workingDays, holidays, defaultDurationDays);
      durationOf.set(id, duration);
      let end = new Date(anchor);
      for (const depId of task.dependsOn) {
        const depStart = startOf.get(depId);
        if (!depStart) continue;
        const dayBefore = new Date(depStart);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const candidate = prevWorkingDay(dayBefore, workingDays, holidays);
        if (candidate < end) end = candidate;
      }
      // walk back duration-1 working days
      const start = (() => {
        const c = new Date(end);
        let remaining = Math.max(0, duration - 1);
        while (remaining > 0) {
          c.setDate(c.getDate() - 1);
          if (isWorkingDay(c, workingDays, holidays)) remaining -= 1;
        }
        return isWorkingDay(c, workingDays, holidays) ? c : prevWorkingDay(c, workingDays, holidays);
      })();
      startOf.set(id, start);
      endOf.set(id, end);
    }
  }

  const scheduled: ScheduledTask[] = topo.order.map((id) => {
    const task = byId.get(id) as ScheduleTaskInput;
    const start = startOf.get(id) ?? null;
    const end = endOf.get(id) ?? null;
    return {
      taskId: id,
      title: task.title,
      isMilestone: task.isMilestone,
      start: start ? toISODate(start) : null,
      end: end ? toISODate(end) : null,
      durationDays: durationOf.get(id) ?? 0,
    };
  });

  const ends = scheduled
    .filter((s) => s.end)
    .map((s) => midnight(s.end as string).getTime());
  const starts = scheduled
    .filter((s) => s.start)
    .map((s) => midnight(s.start as string).getTime());
  const planStart = starts.length ? new Date(Math.min(...starts)) : null;
  const planEnd = ends.length ? new Date(Math.max(...ends)) : null;
  const makespanDays =
    planStart && planEnd
      ? workingDaysBetween(planStart, planEnd, workingDays, holidays)
      : 0;

  return {
    scheduled,
    makespanDays,
    planStart: planStart ? toISODate(planStart) : null,
    planEnd: planEnd ? toISODate(planEnd) : null,
    cyclic: topo.cyclic,
  };
}

function prevWorkingDay(d: Date, workingDays: number[], holidays: string[]): Date {
  const c = new Date(d);
  let guard = 0;
  while (!isWorkingDay(c, workingDays, holidays) && guard < 400) {
    c.setDate(c.getDate() - 1);
    guard += 1;
  }
  return c;
}

/** Parse BusinessSettings JSON columns into engine inputs (defensive). */
export function parseSchedulingSettings(settings: {
  workingDays: string;
  holidays: string;
}): { workingDays: number[]; holidays: string[] } {
  let workingDays: number[] = [0, 1, 2, 3, 4];
  let holidays: string[] = [];
  try {
    const wd: unknown = JSON.parse(settings.workingDays);
    if (Array.isArray(wd)) {
      workingDays = wd.filter(
        (n): n is number => typeof n === "number" && n >= 0 && n <= 6,
      );
    }
  } catch {
    // keep defaults
  }
  try {
    const h: unknown = JSON.parse(settings.holidays);
    if (Array.isArray(h)) {
      holidays = h.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // keep defaults
  }
  return { workingDays, holidays };
}