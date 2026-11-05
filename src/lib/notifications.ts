// Phase 3 — reminder engine: pure computation + localStorage persistence.
// Notifications are derived from existing tasks/projects data — no API or
// database changes, fully synchronized by construction.
import type { ProjectDTO, TaskDTO } from "./types";

export interface ReminderSettings {
  /** Master switch for the bell reminders */
  enabled: boolean;
  /** Remind when a task is due within N days (0 = same day only) */
  taskDaysBefore: number;
  /** Remind when a project deadline/delivery is within N days */
  projectDaysBefore: number;
  /** Also list overdue items */
  includeOverdue: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  taskDaysBefore: 3,
  projectDaysBefore: 7,
  includeOverdue: true,
};

const STORAGE_KEY = "mylist.reminderSettings.v1";
const MIN_DAYS = 0;
const MAX_DAYS = 30;

function clampDays(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? Math.round(value) : NaN;
  return Number.isFinite(n) && n >= MIN_DAYS && n <= MAX_DAYS ? n : fallback;
}

/** Read settings from localStorage (browser only), merged over defaults. */
export function loadReminderSettings(): ReminderSettings {
  if (typeof window === "undefined") return { ...DEFAULT_REMINDER_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REMINDER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      enabled: parsed.enabled !== false,
      taskDaysBefore: clampDays(
        parsed.taskDaysBefore,
        DEFAULT_REMINDER_SETTINGS.taskDaysBefore,
      ),
      projectDaysBefore: clampDays(
        parsed.projectDaysBefore,
        DEFAULT_REMINDER_SETTINGS.projectDaysBefore,
      ),
      includeOverdue: parsed.includeOverdue !== false,
    };
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

/** Persist settings to localStorage (browser only). */
export function saveReminderSettings(settings: ReminderSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode) — settings stay for the session.
  }
}

/** Signed whole calendar days between today and the target ISO date. */
function dayDiff(iso: string, today: Date): number {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return Number.NaN;
  const a = new Date(target);
  a.setHours(0, 0, 0, 0);
  const b = new Date(today);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export type NotificationKind =
  | "task-overdue"
  | "task-due-soon"
  | "project-overdue"
  | "project-deadline-soon"
  | "project-delivery-soon";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  /** Task id or project id the reminder points at */
  refId: string;
  /** Raw task/project name (translated nowhere) */
  title: string;
  /** Signed days relative to today: <0 overdue, 0 today, >0 upcoming */
  days: number;
  /** ISO date of the relevant deadline/due date */
  date: string | null;
}

const KIND_ORDER: Record<NotificationKind, number> = {
  "task-overdue": 0,
  "project-overdue": 1,
  "task-due-soon": 2,
  "project-deadline-soon": 3,
  "project-delivery-soon": 4,
};

/**
 * Compute the current reminder list from tasks & projects.
 * Pure function — pass `today` to make it deterministic (e.g. ticking clock).
 */
export function computeNotifications(
  tasks: TaskDTO[],
  projects: ProjectDTO[],
  settings: ReminderSettings,
  today: Date = new Date(),
): NotificationItem[] {
  if (!settings.enabled) return [];
  const items: NotificationItem[] = [];

  for (const task of tasks) {
    if (!task.dueDate || task.status === "COMPLETED") continue;
    const days = dayDiff(task.dueDate, today);
    if (Number.isNaN(days)) continue;
    if (days < 0) {
      if (settings.includeOverdue) {
        items.push({
          id: `task-overdue:${task.id}`,
          kind: "task-overdue",
          refId: task.id,
          title: task.title,
          days,
          date: task.dueDate,
        });
      }
    } else if (days <= settings.taskDaysBefore) {
      items.push({
        id: `task-due:${task.id}`,
        kind: "task-due-soon",
        refId: task.id,
        title: task.title,
        days,
        date: task.dueDate,
      });
    }
  }

  for (const p of projects) {
    if (p.status === "COMPLETED" || p.status === "CANCELLED") continue;

    if (p.deadline) {
      const days = dayDiff(p.deadline, today);
      if (Number.isFinite(days)) {
        if (days < 0) {
          if (settings.includeOverdue) {
            items.push({
              id: `project-overdue:${p.id}`,
              kind: "project-overdue",
              refId: p.id,
              title: p.name,
              days,
              date: p.deadline,
            });
          }
        } else if (days <= settings.projectDaysBefore) {
          items.push({
            id: `project-deadline:${p.id}`,
            kind: "project-deadline-soon",
            refId: p.id,
            title: p.name,
            days,
            date: p.deadline,
          });
        }
      }
    }

    if (p.deliveryDate) {
      const days = dayDiff(p.deliveryDate, today);
      if (Number.isFinite(days) && days >= 0 && days <= settings.projectDaysBefore) {
        items.push({
          id: `project-delivery:${p.id}`,
          kind: "project-delivery-soon",
          refId: p.id,
          title: p.name,
          days,
          date: p.deliveryDate,
        });
      }
    }
  }

  return items.sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.days - b.days,
  );
}