/**
 * Milesto — Phase 10 — Deadline alert engine.
 *
 * Pure functions over REAL stored records only (Phase 10 §6):
 * - Buckets are derived from stored due dates versus today's local date.
 * - No dates are invented, no predictions are made, and completed items are
 *   excluded by default (the caller decides what "completed" means per kind:
 *   done task, accepted deliverable, fully settled payment, ...).
 * - Alert keys are stable (`kind:id:dueDate`) so notification state stays
 *   idempotent across repeated visits.
 */

export type AlertKind = "task" | "milestone" | "deliverable" | "payment";
export type AlertBucket = "overdue" | "today" | "next7" | "next30";
export type AlertSeverity = "critical" | "high" | "medium" | "low";

/** Minimal structural shape the engine needs. Any module record that has
 *  these fields can be passed directly without adapting types. */
export interface AlertSourceItem {
  id: string;
  title: string;
  kind: AlertKind;
  /** ISO calendar date "YYYY-MM-DD". */
  dueDate: string;
  projectId?: string | null;
  projectName?: string | null;
  /** Completed/terminal items are excluded unless includeCompleted is set. */
  completed?: boolean | null;
  priority?: string | null;
  /** Deep link (e.g. "/projects/p1?tab=timeline") used by the UI. */
  url?: string | null;
}

export interface DeadlineAlert {
  key: string;
  id: string;
  title: string;
  kind: AlertKind;
  projectId: string | null;
  projectName: string | null;
  dueDate: string;
  /** Negative when overdue. */
  daysRemaining: number;
  bucket: AlertBucket;
  severity: AlertSeverity;
  priority: string | null;
  url: string | null;
}

export interface ComputeAlertsOptions {
  /** Override "today" (ISO date). Defaults to the local calendar date. */
  today?: string;
  includeCompleted?: boolean;
}

export interface DeadlineAlertsResult {
  alerts: DeadlineAlert[];
  /** Records ignored because of missing/invalid data (never silently dropped). */
  skipped: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysInMonthOf(year: number, month: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] ?? 0;
}

/** Strict "YYYY-MM-DD" calendar validation (leap-year aware). */
export function isISODateString(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const segments = value.split("-").map(Number);
  const year = segments[0];
  const month = segments[1];
  const day = segments[2];
  if (year === undefined || month === undefined || day === undefined) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonthOf(year, month);
}

export interface ISOParts {
  year: number;
  month: number;
  day: number;
}

export function parseISODateParts(value: string): ISOParts | null {
  if (!isISODateString(value)) return null;
  const segments = value.split("-").map(Number);
  const year = segments[0];
  const month = segments[1];
  const day = segments[2];
  if (year === undefined || month === undefined || day === undefined) return null;
  return { year, month, day };
}

function toUTCNoon(iso: string): number {
  const parts = parseISODateParts(iso);
  if (!parts) throw new Error(`Invalid ISO date: "${iso}".`);
  return Date.UTC(parts.year, parts.month - 1, parts.day, 12);
}

/**
 * Whole-day difference (toISO - fromISO) computed on UTC-noon anchors, so it
 * is immune to DST shifts and timezones. Callers must pass validated dates.
 */
export function diffInDays(fromISO: string, toISO: string): number {
  const diff = toUTCNoon(toISO) - toUTCNoon(fromISO);
  return Math.round(diff / 86_400_000);
}

/**
 * Today as "YYYY-MM-DD" using LOCAL calendar components — matching the
 * Phase 8 rule that deadlines must not silently shift between views.
 */
export function localTodayISO(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Stable idempotency key for notification state. */
export function alertKey(kind: AlertKind, id: string, dueDate: string): string {
  return `${kind}:${id}:${dueDate}`;
}

function bucketFor(daysRemaining: number): { bucket: AlertBucket; severity: AlertSeverity } | null {
  if (daysRemaining < 0) return { bucket: "overdue", severity: "critical" };
  if (daysRemaining === 0) return { bucket: "today", severity: "high" };
  if (daysRemaining <= 7) return { bucket: "next7", severity: "medium" };
  if (daysRemaining <= 30) return { bucket: "next30", severity: "low" };
  return null; // Beyond the 30-day alert horizon.
}

export function computeDeadlineAlerts(
  items: readonly AlertSourceItem[],
  options: ComputeAlertsOptions = {},
): DeadlineAlertsResult {
  const today = options.today ?? localTodayISO();
  if (!isISODateString(today)) throw new Error(`Invalid options.today: "${today}".`);
  const includeCompleted = options.includeCompleted === true;

  const alerts: DeadlineAlert[] = [];
  let skipped = 0;

  for (const item of items) {
    if (item.completed === true && !includeCompleted) continue;
    const valid =
      typeof item.id === "string" &&
      item.id.length > 0 &&
      typeof item.title === "string" &&
      item.title.length > 0 &&
      isISODateString(item.dueDate);
    if (!valid) {
      skipped += 1;
      continue;
    }
    const daysRemaining = diffInDays(today, item.dueDate);
    const rule = bucketFor(daysRemaining);
    if (!rule) continue;
    alerts.push({
      key: alertKey(item.kind, item.id, item.dueDate),
      id: item.id,
      title: item.title,
      kind: item.kind,
      projectId: item.projectId ?? null,
      projectName: item.projectName ?? null,
      dueDate: item.dueDate,
      daysRemaining,
      bucket: rule.bucket,
      severity: rule.severity,
      priority: item.priority ?? null,
      url: item.url ?? null,
    });
  }

  alerts.sort(compareAlerts);
  return { alerts, skipped };
}

const BUCKET_RANK: Record<AlertBucket, number> = {
  overdue: 0,
  today: 1,
  next7: 2,
  next30: 3,
};

function compareAlerts(a: DeadlineAlert, b: DeadlineAlert): number {
  const rank = BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket];
  if (rank !== 0) return rank;
  if (a.bucket === "overdue") return a.daysRemaining - b.daysRemaining; // Most overdue first.
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export const ALERT_BUCKETS: readonly AlertBucket[] = ["overdue", "today", "next7", "next30"];

export function groupAlertsByBucket(
  alerts: readonly DeadlineAlert[],
): Record<AlertBucket, DeadlineAlert[]> {
  const grouped: Record<AlertBucket, DeadlineAlert[]> = {
    overdue: [],
    today: [],
    next7: [],
    next30: [],
  };
  for (const alert of alerts) grouped[alert.bucket].push(alert);
  return grouped;
}

export function countAlertsByBucket(alerts: readonly DeadlineAlert[]): Record<AlertBucket, number> {
  const counts: Record<AlertBucket, number> = { overdue: 0, today: 0, next7: 0, next30: 0 };
  for (const alert of alerts) counts[alert.bucket] += 1;
  return counts;
}

const MONTH_NAMES: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

/** Deterministic date formatting straight from the ISO parts (no timezone drift). */
export function formatAlertDate(iso: string): string {
  const parts = parseISODateParts(iso);
  if (!parts) return iso;
  const monthName = MONTH_NAMES[parts.month] ?? "";
  return `${parts.day} ${monthName} ${parts.year}`;
}

export function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const count = Math.abs(daysRemaining);
    return count === 1 ? "1 day overdue" : `${count} days overdue`;
  }
  if (daysRemaining === 0) return "Due today";
  if (daysRemaining === 1) return "Due tomorrow";
  return `In ${daysRemaining} days`;
}