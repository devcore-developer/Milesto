// Phase 3 — pure date-grid & calendar-event helpers.
// No React / no i18n here: components map events to labels and colors.
import type { ProjectDTO, TaskDTO, TaskPriority } from "./types";

export type CalendarMode = "month" | "week" | "day";

export type CalendarEventKind =
  | "task"
  | "project-start"
  | "project-deadline"
  | "project-delivery";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  /** Local calendar date key "YYYY-MM-DD" */
  dateKey: string;
  title: string;
  completed: boolean;
  /** Event date passed while not completed */
  overdue: boolean;
  priority: TaskPriority;
  taskId: string | null;
  projectId: string | null;
}

/** "YYYY-MM-DD" for a local Date. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local-midnight Date from a "YYYY-MM-DD" key. */
export function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const c = startOfDay(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

/** Week starts on Sunday (0) for English, Saturday (6) for Arabic. */
export function weekStartsOnFor(lang: string): 0 | 6 {
  return lang === "ar" ? 6 : 0;
}

export function startOfWeek(d: Date, weekStartsOn: 0 | 6): Date {
  const day = startOfDay(d).getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

/** 42 cells (6 rows × 7 columns) covering the whole month view. */
export function buildMonthGrid(viewDate: Date, weekStartsOn: 0 | 6): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const gridStart = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** The 7 dates of the week containing viewDate. */
export function buildWeekDays(viewDate: Date, weekStartsOn: 0 | 6): Date[] {
  const s = startOfWeek(viewDate, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

function intlLocale(lang: string): string {
  return lang === "ar" ? "ar-EG" : "en-US";
}

/** Short weekday labels ordered from the configured week start. */
export function weekdayLabels(weekStartsOn: 0 | 6, lang: string): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale(lang), { weekday: "short" });
  // Jan 7 2024 was a Sunday — a stable base week.
  const base = Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(2024, 0, 7 + i)),
  );
  return Array.from({ length: 7 }, (_, i) => base[(i + weekStartsOn) % 7]);
}

/** e.g. "November 2026" / "نوفمبر ٢٠٢٦" */
export function monthLabel(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    month: "long",
    year: "numeric",
  }).format(d);
}

/** e.g. "Nov 9 – Nov 15" */
export function weekRangeLabel(weekStart: Date, lang: string): string {
  const fmt = new Intl.DateTimeFormat(intlLocale(lang), {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(weekStart)} – ${fmt.format(addDays(weekStart, 6))}`;
}

/** e.g. "Monday, November 9" */
export function dayLabel(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/** e.g. "Nov 9" */
export function shortDateLabel(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    day: "numeric",
    month: "short",
  }).format(d);
}

/**
 * Flatten tasks (due dates) and projects (start / deadline / delivery)
 * into dated events. Lexicographic "YYYY-MM-DD" comparison keeps this
 * timezone-safe.
 */
export function collectCalendarEvents(
  tasks: TaskDTO[],
  projects: ProjectDTO[],
  today: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const todayKey = toDateKey(today);

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const dateKey = task.dueDate.slice(0, 10);
    const completed = task.status === "COMPLETED";
    events.push({
      id: `task:${task.id}`,
      kind: "task",
      dateKey,
      title: task.title,
      completed,
      overdue: !completed && dateKey < todayKey,
      priority: task.priority,
      taskId: task.id,
      projectId: null,
    });
  }

  for (const p of projects) {
    const done = p.status === "COMPLETED" || p.status === "CANCELLED";
    if (p.startDate) {
      const dateKey = p.startDate.slice(0, 10);
      events.push({
        id: `proj-start:${p.id}`,
        kind: "project-start",
        dateKey,
        title: p.name,
        completed: done,
        overdue: false,
        priority: p.priority,
        taskId: null,
        projectId: p.id,
      });
    }
    if (p.deadline) {
      const dateKey = p.deadline.slice(0, 10);
      events.push({
        id: `proj-deadline:${p.id}`,
        kind: "project-deadline",
        dateKey,
        title: p.name,
        completed: done,
        overdue: !done && dateKey < todayKey,
        priority: p.priority,
        taskId: null,
        projectId: p.id,
      });
    }
    if (p.deliveryDate) {
      const dateKey = p.deliveryDate.slice(0, 10);
      events.push({
        id: `proj-delivery:${p.id}`,
        kind: "project-delivery",
        dateKey,
        title: p.name,
        completed: done,
        overdue: !done && dateKey < todayKey,
        priority: p.priority,
        taskId: null,
        projectId: p.id,
      });
    }
  }

  return events;
}

/** Group events by date key; completed items sink, overdue floats up. */
export function groupEventsByDate(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.dateKey);
    if (list) list.push(e);
    else map.set(e.dateKey, [e]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.kind.localeCompare(b.kind);
    });
  }
  return map;
}