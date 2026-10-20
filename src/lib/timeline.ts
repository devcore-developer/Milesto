/**
 * Milesto — Timeline & Deliverables (Phase 8, hardened in Phase 10)
 *
 * Pure timeline domain layer: types, validation, status transitions,
 * overdue detection, dependency-cycle checks, calendar grids and the
 * composition of derived timeline events.
 *
 * Design rules (Phase 10 audit):
 * - Dates are plain "YYYY-MM-DD" strings compared lexically — no timezone
 *   drift, no Date-object rounding surprises.
 * - "today" is always injected as a parameter, so every function here is
 *   deterministic and directly unit-testable.
 * - Derived data (overdue flags, composed events) is NEVER stored; it is
 *   recomputed from the source records on every read, so it can never go
 *   stale or disagree with the underlying finance/execution data.
 * - Statuses move through explicit transitions only — no silent jumps.
 */

import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type MilestoneStatus = "planned" | "in-progress" | "done" | "at-risk" | "cancelled";

export type DeliverableStatus = "pending" | "in-progress" | "submitted" | "approved";

export type TimelineEventKind = "milestone" | "deliverable" | "payment" | "custom";

export type TimelineEventStatus = "planned" | "done" | "cancelled";

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  /** ISO date (YYYY-MM-DD) this milestone is due. */
  dueDate: string;
  status: MilestoneStatus;
  description?: string;
  /** ids of other milestones that must complete first. */
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimelineDeliverable {
  id: string;
  projectId: string;
  name: string;
  /** Optional until a delivery date is agreed. */
  dueDate?: string;
  status: DeliverableStatus;
  description?: string;
  phaseId?: string;
  /** ids of other deliverables that must be approved first. */
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  kind: TimelineEventKind;
  status: TimelineEventStatus;
  projectId?: string;
  description?: string;
  /** Set when the event is derived from another record (never directly editable). */
  sourceKind?: Exclude<TimelineEventKind, "custom">;
  sourceId?: string;
  /** Computed at read time: due date passed while not finished. */
  overdue?: boolean;
  createdAt?: string;
}

/** Minimal structural shape of a payment obligation used for derived events. */
export interface PaymentDueInput {
  id: string;
  projectId: string;
  /** Milestone/instalment label, e.g. "Milestone 2 — UI delivery". */
  title: string;
  dueDate: string;
  cancelled?: boolean;
}

export interface BuildTimelineEventsInput {
  milestones: readonly Milestone[];
  deliverables: readonly TimelineDeliverable[];
  customEvents: readonly TimelineEvent[];
  paymentDues?: readonly PaymentDueInput[];
  today: string;
}

/** Persisted shape (TimelineProvider keeps only these three arrays). */
export interface StoredTimelineState {
  milestones: Milestone[];
  deliverables: TimelineDeliverable[];
  customEvents: TimelineEvent[];
}

/* ---------------------------------------------------------------------------
 * Date primitives (string-based, leap-year aware, timezone-free)
 * ------------------------------------------------------------------------- */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month; `month` is 1-based. */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1] ?? 30;
}

/** Strict validation: correct shape AND a real calendar date (incl. leap years). */
export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/** Local-clock "today" as YYYY-MM-DD (matches the app's established helper). */
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Adds days to an ISO date using UTC arithmetic — DST-safe by construction. */
export function addDaysISO(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Signed day difference: to − from (negative when `to` is earlier). */
export function diffInDays(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime();
  const to = new Date(`${toIso.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** "2024-08-15" → "2024-08". Invalid input yields "". */
export function monthOf(iso: string): string {
  return ISO_DATE_PATTERN.test(iso) ? iso.slice(0, 7) : "";
}

/**
 * Adds months, clamping the day when the target month is shorter
 * (2024-01-31 + 1 month → 2024-02-29). Accepts "YYYY-MM" too (day defaults to 01).
 */
export function addMonthsISO(iso: string, months: number): string {
  const normalized = iso.length === 7 ? `${iso}-01` : iso;
  if (!ISO_DATE_PATTERN.test(normalized)) return iso;
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));
  const day = Number(normalized.slice(8, 10));
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (((total % 12) + 12) % 12) + 1; // 1..12
  const newDay = Math.min(Math.max(day, 1), daysInMonth(newYear, newMonth));
  const y = String(newYear).padStart(4, "0");
  const m = String(newMonth).padStart(2, "0");
  const d = String(newDay).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Number of months between two ISO dates inclusive of both endpoints. */
export function monthSpan(fromIso: string, toIso: string): number {
  const from = monthOf(fromIso);
  const to = monthOf(toIso);
  if (!from || !to) return 0;
  const fromIndex = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1;
  const toIndex = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7)) - 1;
  return toIndex - fromIndex + 1;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "2024-02-29" → "29 Feb 2024". Falls back to the raw string when invalid. */
export function formatTimelineDate(iso: string | undefined): string {
  if (!iso || !isISODate(iso)) return iso ?? "—";
  const year = iso.slice(0, 4);
  const month = MONTH_NAMES[Number(iso.slice(5, 7)) - 1] ?? "";
  const day = String(Number(iso.slice(8, 10)));
  return `${day} ${month} ${year}`;
}

/** "2024-02" → "Feb 2024". */
export function formatMonthLabel(month: string): string {
  const year = month.slice(0, 4);
  const index = Number(month.slice(5, 7)) - 1;
  const name = MONTH_NAMES[index];
  if (!year || !name) return month;
  return `${name} ${year}`;
}

/* ---------------------------------------------------------------------------
 * Status transitions (explicit, auditable)
 * ------------------------------------------------------------------------- */

export const MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  planned: ["in-progress", "at-risk", "cancelled"],
  "in-progress": ["done", "at-risk", "cancelled"],
  done: [],
  "at-risk": ["in-progress", "done", "cancelled"],
  cancelled: [],
};

export const DELIVERABLE_TRANSITIONS: Record<DeliverableStatus, DeliverableStatus[]> = {
  pending: ["in-progress"],
  "in-progress": ["submitted"],
  submitted: ["approved", "in-progress"], // rework loop is explicit
  approved: [],
};

export function canTransitionMilestone(from: MilestoneStatus, to: MilestoneStatus): boolean {
  if (from === to) return false;
  return MILESTONE_TRANSITIONS[from].includes(to);
}

export function canTransitionDeliverable(from: DeliverableStatus, to: DeliverableStatus): boolean {
  if (from === to) return false;
  return DELIVERABLE_TRANSITIONS[from].includes(to);
}

/* ---------------------------------------------------------------------------
 * Overdue detection
 * ------------------------------------------------------------------------- */

export function isMilestoneOverdue(milestone: Milestone, today: string): boolean {
  return (
    milestone.status !== "done" && milestone.status !== "cancelled" && milestone.dueDate < today
  );
}

export function isDeliverableOverdue(deliverable: TimelineDeliverable, today: string): boolean {
  if (deliverable.status === "approved") return false;
  if (!deliverable.dueDate) return false;
  return deliverable.dueDate < today;
}

/* ---------------------------------------------------------------------------
 * Dependency integrity
 * ------------------------------------------------------------------------- */

/**
 * Returns one example dependency cycle (list of ids, closing back on itself),
 * or null when the graph is acyclic. Unknown dependency ids are ignored here
 * (they are a separate validation concern, not a cycle).
 */
export function detectDependencyCycle<T extends { id: string; dependencies?: string[] }>(
  items: readonly T[]
): string[] | null {
  const byId = new Map<string, T>();
  for (const item of items) byId.set(item.id, item);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  let found: string[] | null = null;

  const visit = (id: string, path: readonly string[]): void => {
    if (found) return;
    const state = color.get(id) ?? WHITE;
    if (state === GRAY) {
      const start = path.indexOf(id);
      const cyclePath = start >= 0 ? path.slice(start) : [];
      found = [...cyclePath, id];
      return;
    }
    if (state === BLACK) return;
    color.set(id, GRAY);
    const item = byId.get(id);
    const deps = item?.dependencies ?? [];
    for (const dep of deps) {
      if (!byId.has(dep)) continue;
      visit(dep, [...path, id]);
      if (found) return;
    }
    color.set(id, BLACK);
  };

  for (const item of items) {
    visit(item.id, []);
    if (found) break;
  }
  return found;
}

/** Dependency ids that do not exist in the given collection. */
export function unknownDependencies<T extends { id: string; dependencies?: string[] }>(
  items: readonly T[]
): string[] {
  const ids = new Set(items.map((item) => item.id));
  const missing: string[] = [];
  for (const item of items) {
    for (const dep of item.dependencies ?? []) {
      if (!ids.has(dep) && !missing.includes(dep)) missing.push(dep);
    }
  }
  return missing;
}

/* ---------------------------------------------------------------------------
 * Derived timeline events
 * ------------------------------------------------------------------------- */

/** Derived ids use this prefix so custom-event mutations can reject them. */
export const DERIVED_EVENT_PREFIX = "evt:";

export function buildTimelineEvents(input: BuildTimelineEventsInput): TimelineEvent[] {
  const { today } = input;
  const events: TimelineEvent[] = [];

  for (const milestone of input.milestones) {
    const cancelled = milestone.status === "cancelled";
    events.push({
      id: `${DERIVED_EVENT_PREFIX}milestone:${milestone.id}`,
      title: milestone.title,
      date: milestone.dueDate,
      kind: "milestone",
      status: cancelled ? "cancelled" : milestone.status === "done" ? "done" : "planned",
      projectId: milestone.projectId,
      description: milestone.description,
      sourceKind: "milestone",
      sourceId: milestone.id,
      overdue: isMilestoneOverdue(milestone, today),
    });
  }

  for (const deliverable of input.deliverables) {
    if (!deliverable.dueDate) continue; // no agreed date yet → nothing to place
    events.push({
      id: `${DERIVED_EVENT_PREFIX}deliverable:${deliverable.id}`,
      title: deliverable.name,
      date: deliverable.dueDate,
      kind: "deliverable",
      status: deliverable.status === "approved" ? "done" : "planned",
      projectId: deliverable.projectId,
      description: deliverable.description,
      sourceKind: "deliverable",
      sourceId: deliverable.id,
      overdue: isDeliverableOverdue(deliverable, today),
    });
  }

  for (const payment of input.paymentDues ?? []) {
    if (payment.cancelled) continue; // cancelled obligations are audit-only
    events.push({
      id: `${DERIVED_EVENT_PREFIX}payment:${payment.id}`,
      title: payment.title,
      date: payment.dueDate,
      kind: "payment",
      status: "planned",
      projectId: payment.projectId,
      sourceKind: "payment",
      sourceId: payment.id,
      overdue: payment.dueDate < today,
    });
  }

  for (const custom of input.customEvents) {
    events.push({
      ...custom,
      overdue: custom.status === "planned" && custom.date < today,
    });
  }

  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

/* ---------------------------------------------------------------------------
 * Calendar grid
 * ------------------------------------------------------------------------- */

export interface CalendarCell {
  date: string;
  /** False for padding days borrowed from the previous/next month. */
  inMonth: boolean;
}

/**
 * Weeks (Sunday-first) covering the whole month, 5 or 6 rows of 7 days.
 * `monthIndex` is 0-based (JS convention).
 */
export function buildMonthMatrix(year: number, monthIndex: number): CalendarCell[][] {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return [];
  }
  const monthKey = `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}`;
  const firstIso = `${monthKey}-01`;
  const startOffset = new Date(`${firstIso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const cursorStart = addDaysISO(firstIso, -startOffset);

  const weeks: CalendarCell[][] = [];
  let cursor = cursorStart;
  do {
    const week: CalendarCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      week.push({ date: cursor, inMonth: monthOf(cursor) === monthKey });
      cursor = addDaysISO(cursor, 1);
    }
    weeks.push(week);
  } while (monthOf(cursor) === monthKey);

  return weeks;
}

/* ---------------------------------------------------------------------------
 * Input validation (shared by provider and dialogs)
 * ------------------------------------------------------------------------- */

export const milestoneInputSchema = z.object({
  projectId: z.string().trim().min(1, "A project is required"),
  title: z.string().trim().min(1, "Title is required").max(120, "Title is too long"),
  dueDate: z.string().refine(isISODate, "Due date must be a real date (YYYY-MM-DD)"),
  status: z.enum(["planned", "in-progress", "done", "at-risk", "cancelled"]).default("planned"),
  description: z.string().trim().max(2000).optional(),
  dependencies: z.array(z.string().trim().min(1)).optional(),
});

export const milestonePatchSchema = milestoneInputSchema.partial();

export const deliverableInputSchema = z.object({
  projectId: z.string().trim().min(1, "A project is required"),
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  dueDate: z
    .string()
    .refine(isISODate, "Due date must be a real date (YYYY-MM-DD)")
    .optional(),
  status: z.enum(["pending", "in-progress", "submitted", "approved"]).default("pending"),
  description: z.string().trim().max(2000).optional(),
  phaseId: z.string().trim().min(1).optional(),
  dependencies: z.array(z.string().trim().min(1)).optional(),
});

export const deliverablePatchSchema = deliverableInputSchema.partial();

export const customEventInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Title is too long"),
  date: z.string().refine(isISODate, "Date must be a real date (YYYY-MM-DD)"),
  projectId: z.string().trim().min(1).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const customEventPatchSchema = customEventInputSchema.partial().extend({
  /** Planned → done/cancelled is the only lifecycle a custom event has. */
  status: z.enum(["planned", "done", "cancelled"]).optional(),
});

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/* ---------------------------------------------------------------------------
 * Sequential ids (same convention as the rest of the app)
 * ------------------------------------------------------------------------- */

export function nextTimelineId(prefix: string, ids: readonly string[]): string {
  let max = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of ids) {
    const match = pattern.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}