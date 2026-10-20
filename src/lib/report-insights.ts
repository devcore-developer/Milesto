// ============================================================
// Milesto — محرك حسابات التقارير والـ Insights
// دوال خالصة بدون أي اعتماديات — آمنة على السيرفر وفي الاختبارات
// ============================================================

export type Row = { [key: string]: any };

export type ReportFilters = {
  projectId?: string;
  status?: string;
  query?: string;
};

export type Tone = "success" | "danger" | "warning" | "info" | "neutral";

// ---------- أرقام ومبالغ ----------

export function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function minorToMajor(v: unknown): number {
  return toNum(v) / 100;
}

export function formatMoney(...args: unknown[]): string {
  const value = args[0];
  const currencyArg = args[1];
  const obj = value !== null && typeof value === "object" ? (value as Row) : null;
  const minor =
    typeof value === "number"
      ? value
      : toNum(obj ? (obj.amountMinor ?? obj.amount ?? obj.totalMinor ?? obj.total) : value);
  const cur =
    typeof currencyArg === "string" && currencyArg
      ? currencyArg
      : String(obj?.currency ?? "EGP");
  const major = minor / 100;
  return `${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

// ---------- تواريخ (نصوص YYYY-MM-DD) ----------

function utcMs(iso: string): number {
  const parts = iso.split("-").map(Number);
  return Date.UTC(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1);
}

export function isValidISO(v: unknown): boolean {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((utcMs(toISO) - utcMs(fromISO)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(utcMs(iso) + n * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ---------- الحالات ----------

export function normalizeStatus(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export const STATUS_LABEL: Record<string, string> = {
  todo: "لم تبدأ",
  not_started: "لم تبدأ",
  pending: "معلّقة",
  planned: "مخططة",
  draft: "مسودة",
  backlog: "قائمة الانتظار",
  in_progress: "قيد التنفيذ",
  doing: "قيد التنفيذ",
  active: "نشطة",
  ongoing: "جارية",
  review: "في المراجعة",
  in_review: "في المراجعة",
  testing: "قيد الاختبار",
  waiting: "في الانتظار",
  blocked: "متوقفة",
  at_risk: "على الخطر",
  done: "منجزة",
  completed: "منجزة",
  complete: "منجزة",
  finished: "منجزة",
  accepted: "مقبولة",
  delivered: "مسلّمة",
  cancelled: "ملغاة",
  canceled: "ملغاة",
  rejected: "مرفوضة",
  failed: "فاشلة",
  archived: "مؤرشفة",
  overdue: "متأخرة",
};

export function statusLabel(v: unknown): string {
  const k = normalizeStatus(v);
  if (!k) return "—";
  return STATUS_LABEL[k] ?? String(v);
}

export const STATUS_TONE: Record<string, Tone> = {
  todo: "neutral",
  not_started: "neutral",
  pending: "warning",
  planned: "info",
  draft: "neutral",
  backlog: "neutral",
  in_progress: "info",
  doing: "info",
  active: "success",
  ongoing: "info",
  review: "warning",
  in_review: "warning",
  testing: "info",
  waiting: "warning",
  blocked: "danger",
  at_risk: "danger",
  done: "success",
  completed: "success",
  complete: "success",
  finished: "success",
  accepted: "success",
  delivered: "success",
  cancelled: "danger",
  canceled: "danger",
  rejected: "danger",
  failed: "danger",
  archived: "neutral",
  overdue: "danger",
};

export function statusTone(v: unknown): Tone {
  return STATUS_TONE[normalizeStatus(v)] ?? "neutral";
}

export function isDoneStatus(v: unknown): boolean {
  const k = normalizeStatus(v);
  return k === "done" || k === "completed" || k === "complete" || k === "accepted" || k === "delivered" || k === "finished";
}

export function isClosedStatus(v: unknown): boolean {
  const k = normalizeStatus(v);
  return isDoneStatus(k) || k === "archived" || k === "cancelled" || k === "canceled";
}

// ---------- تسميات ----------

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: "عاجل",
  critical: "حرج",
  high: "مرتفع",
  medium: "متوسط",
  normal: "عادي",
  low: "منخفض",
};

export function priorityLabel(v: unknown): string {
  const k = normalizeStatus(v);
  return PRIORITY_LABEL[k] ?? (k ? String(v) : "—");
}

export const TYPE_LABEL: Record<string, string> = {
  document: "مستند",
  report: "تقرير",
  design: "تصميم",
  code: "كود",
  review: "مراجعة",
  approval: "اعتماد",
  material: "مادة",
  service: "خدمة",
  meeting: "اجتماع",
  other: "أخرى",
};

export function typeLabel(v: unknown): string {
  const k = normalizeStatus(v);
  return TYPE_LABEL[k] ?? (k ? String(v) : "—");
}

// ---------- قراءة آمنة من الكائنات ----------

export function pickStr(o: Row | null | undefined, ...keys: string[]): string | undefined {
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function pickArr(o: Row | null | undefined, ...keys: string[]): string[] | undefined {
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v.map((x) => String(x));
  }
  return undefined;
}

// ---------- الموديلات ----------

export interface MilestoneView {
  id: string;
  projectId?: string;
  title?: string;
  status?: string;
  date?: string;
  completedAt?: string;
  relatedTaskIds?: string[];
  relatedDeliverableIds?: string[];
  blockedByTaskIds?: string[];
  notes?: string;
}

export interface DeliverableView {
  id: string;
  projectId?: string;
  milestoneId?: string;
  title?: string;
  type?: string;
  status?: string;
  dueDate?: string;
  plannedStartDate?: string;
  priority?: string;
  assignee?: string;
  notes?: string;
}

export function toMilestoneViews(list: unknown): MilestoneView[] {
  if (!Array.isArray(list)) return [];
  return list.map((raw: Row) => {
    const m = (raw ?? {}) as Row;
    return {
      id: String(m.id ?? ""),
      projectId: pickStr(m, "projectId", "project_id"),
      title: pickStr(m, "title", "name", "label"),
      status: m.status != null ? String(m.status) : undefined,
      date: pickStr(m, "date", "dueDate", "targetDate"),
      completedAt: pickStr(m, "completedAt", "completed_at"),
      relatedTaskIds: pickArr(m, "relatedTaskIds", "taskIds"),
      relatedDeliverableIds: pickArr(m, "relatedDeliverableIds", "deliverableIds"),
      blockedByTaskIds: pickArr(m, "blockedByTaskIds", "blockedBy"),
      notes: pickStr(m, "notes", "note", "description"),
    };
  });
}

export function toDeliverableViews(list: unknown): DeliverableView[] {
  if (!Array.isArray(list)) return [];
  return list.map((raw: Row) => {
    const d = (raw ?? {}) as Row;
    return {
      id: String(d.id ?? ""),
      projectId: pickStr(d, "projectId", "project_id"),
      milestoneId: pickStr(d, "milestoneId", "milestone_id"),
      title: pickStr(d, "title", "name", "label"),
      type: d.type != null ? String(d.type) : undefined,
      status: d.status != null ? String(d.status) : undefined,
      dueDate: pickStr(d, "dueDate", "due", "deadline"),
      plannedStartDate: pickStr(d, "plannedStartDate", "planned_start", "startDate", "start"),
      priority: d.priority != null ? String(d.priority) : undefined,
      assignee: pickStr(d, "assignee", "owner"),
      notes: pickStr(d, "notes", "note", "description"),
    };
  });
}

// ---------- الاستحقاقات ----------

export type DeadlineKind = "milestone" | "deliverable";

export interface DeadlineItem {
  id: string;
  kind: DeadlineKind;
  title: string;
  dueDate?: string;
  status?: string;
  projectId?: string;
  projectName?: string;
}

export function deadlineItems(
  projects: Row[],
  milestones: MilestoneView[],
  deliverables: DeliverableView[],
): DeadlineItem[] {
  const names = new Map<string, string>();
  for (const p of projects) {
    const id = String(p?.id ?? "");
    if (id) names.set(id, pickStr(p, "title", "name") ?? "—");
  }
  const out: DeadlineItem[] = [];
  for (const m of milestones) {
    out.push({
      id: `milestone:${m.id}`,
      kind: "milestone",
      title: m.title ?? "مرحلة بدون عنوان",
      dueDate: m.date,
      status: m.status,
      projectId: m.projectId,
      projectName: m.projectId ? names.get(m.projectId) : undefined,
    });
  }
  for (const d of deliverables) {
    out.push({
      id: `deliverable:${d.id}`,
      kind: "deliverable",
      title: d.title ?? "تسليم بدون عنوان",
      dueDate: d.dueDate,
      status: d.status,
      projectId: d.projectId,
      projectName: d.projectId ? names.get(d.projectId) : undefined,
    });
  }
  return out;
}

export type DeadlineBucket = "overdue" | "next7" | "next30" | "later" | "no_date";

export const DEADLINE_BUCKET_LABEL: Record<DeadlineBucket, string> = {
  overdue: "متأخرة",
  next7: "خلال 7 أيام",
  next30: "خلال 30 يوم",
  later: "لاحقًا",
  no_date: "بدون تاريخ",
};

export function deadlineBucket(dueDate: unknown, today: string): DeadlineBucket {
  if (typeof dueDate !== "string" || !isValidISO(dueDate)) return "no_date";
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return "overdue";
  if (diff <= 7) return "next7";
  if (diff <= 30) return "next30";
  return "later";
}

export function groupDeadlines(
  items: DeadlineItem[],
  today: string,
): Record<DeadlineBucket, DeadlineItem[]> {
  const out: Record<DeadlineBucket, DeadlineItem[]> = {
    overdue: [],
    next7: [],
    next30: [],
    later: [],
    no_date: [],
  };
  for (const it of items) out[deadlineBucket(it.dueDate, today)].push(it);
  (Object.keys(out) as DeadlineBucket[]).forEach((k) => {
    out[k].sort((a, b) =>
      String(a.dueDate ?? "9999-12-31").localeCompare(String(b.dueDate ?? "9999-12-31")),
    );
  });
  return out;
}

export function completionRate(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

// ---------- التعارضات ----------

export interface TimelineConflict {
  id: string;
  day: string;
  projectId?: string;
  projectName?: string;
  message: string;
  refs: DeadlineItem[];
}

export function detectConflicts(items: DeadlineItem[], today: string): TimelineConflict[] {
  const dated = items.filter((i) => isValidISO(i.dueDate));
  const byDayProject = new Map<string, DeadlineItem[]>();
  for (const it of dated) {
    const key = `${it.projectId ?? "—"}|${it.dueDate}`;
    const arr = byDayProject.get(key) ?? [];
    arr.push(it);
    byDayProject.set(key, arr);
  }
  const out: TimelineConflict[] = [];
  for (const [key, arr] of Array.from(byDayProject.entries())) {
    if (arr.length < 2) continue;
    const day = key.split("|")[1] ?? "";
    out.push({
      id: `clash:${key}`,
      day,
      projectId: arr[0]?.projectId,
      projectName: arr[0]?.projectName,
      message: `${arr.length} عناصر ليها نفس تاريخ الاستحقاق في نفس المشروع`,
      refs: arr,
    });
  }
  for (const it of dated) {
    if (deadlineBucket(it.dueDate, today) === "overdue" && !isClosedStatus(it.status)) {
      out.push({
        id: `late:${it.id}`,
        day: String(it.dueDate),
        projectId: it.projectId,
        projectName: it.projectName,
        message: "عنصر عدّى تاريخ استحقاقه ولسه مش منجز",
        refs: [it],
      });
    }
  }
  return out;
}

// ---------- الرؤى ----------

export interface TimelineInsight {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
}

export function buildInsights(items: DeadlineItem[], today: string): TimelineInsight[] {
  const groups = groupDeadlines(items, today);
  const out: TimelineInsight[] = [];
  const overdueActive = groups.overdue.filter((i) => !isClosedStatus(i.status));
  if (overdueActive.length > 0) {
    out.push({
      id: "overdue",
      tone: "danger",
      title: `${overdueActive.length} عناصر متأخرة`,
      detail: "عناصر عدّى تاريخ استحقاقها ولسه مش منجزة — محتاجة إعادة جدولة أو إغلاق.",
    });
  }
  if (groups.next7.length > 0) {
    out.push({
      id: "next7",
      tone: "warning",
      title: `${groups.next7.length} استحقاقات خلال 7 أيام`,
      detail: "ركّز على الأسبوع الحالي قبل ما العناصر دي تبقى متأخرة.",
    });
  }
  if (groups.next30.length > 0) {
    out.push({
      id: "next30",
      tone: "info",
      title: `${groups.next30.length} استحقاق خلال 30 يوم`,
      detail: "خطة الشهر الجاي عليها الحمل ده من الاستحقاقات.",
    });
  }
  const done = items.filter((i) => isDoneStatus(i.status)).length;
  if (items.length > 0) {
    const rate = completionRate(done, items.length);
    out.push({
      id: "rate",
      tone: rate >= 70 ? "success" : "warning",
      title: `نسبة الإنجاز ${rate}%`,
      detail: `${done} من ${items.length} عنصر مكتمل.`,
    });
  }
  if (out.length === 0) {
    out.push({
      id: "empty",
      tone: "neutral",
      title: "مفيش استحقاقات مسجلة",
      detail: "ضيف تواريخ استحقاق للمراحل والتسليمات عشان تظهر التحليلات.",
    });
  }
  return out;
}

// ---------- تقارير ----------

export function countBy<T>(items: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = key(it) || "—";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export interface ProjectPerformanceRow {
  projectId: string;
  projectName: string;
  milestonesTotal: number;
  milestonesDone: number;
  deliverablesTotal: number;
  deliverablesDone: number;
  overdue: number;
  progress: number;
}

export function projectPerformance(
  projects: Row[],
  milestones: MilestoneView[],
  deliverables: DeliverableView[],
  today: string,
): ProjectPerformanceRow[] {
  const nameById = new Map<string, string>();
  const ids = new Set<string>();
  for (const p of projects) {
    const id = String(p?.id ?? "");
    if (!id) continue;
    ids.add(id);
    nameById.set(id, pickStr(p, "title", "name") ?? "—");
  }
  for (const m of milestones) if (m.projectId) ids.add(m.projectId);
  for (const d of deliverables) if (d.projectId) ids.add(d.projectId);

  const rows: ProjectPerformanceRow[] = [];
  for (const id of ids) {
    const ms = milestones.filter((m) => m.projectId === id);
    const ds = deliverables.filter((d) => d.projectId === id);
    const msDone = ms.filter((m) => isDoneStatus(m.status) || isValidISO(m.completedAt)).length;
    const dsDone = ds.filter((d) => isDoneStatus(d.status)).length;
    const overdue = [...ms, ...ds].filter((x) => {
      const due = (x as DeliverableView).dueDate ?? (x as MilestoneView).date;
      return deadlineBucket(due, today) === "overdue" && !isClosedStatus(x.status);
    }).length;
    const total = ms.length + ds.length;
    const done = msDone + dsDone;
    rows.push({
      projectId: id,
      projectName: nameById.get(id) ?? "—",
      milestonesTotal: ms.length,
      milestonesDone: msDone,
      deliverablesTotal: ds.length,
      deliverablesDone: dsDone,
      overdue,
      progress: completionRate(done, total),
    });
  }
  return rows.sort((a, b) => b.progress - a.progress);
}

export interface ProjectFinanceRow {
  projectId: string;
  projectName: string;
  expensesTotalMinor: number;
  obligationsTotalMinor: number;
  obligationsRemainingMinor: number;
  currency: string;
}

export function obligationRemainingMinor(o: Row): number {
  if (!o || o.cancelledAt || o.cancelled) return 0;
  const total = toNum(o.amountMinor ?? o.amount);
  const paid = toNum(o.paidMinor ?? o.paidAmount ?? o.paid ?? o.settledMinor);
  return Math.max(0, total - paid);
}

export function projectFinanceRows(
  projects: Row[],
  expenses: Row[],
  obligations: Row[],
): ProjectFinanceRow[] {
  const ids = new Set<string>();
  const nameById = new Map<string, string>();
  for (const p of projects) {
    const id = String(p?.id ?? "");
    if (!id) continue;
    ids.add(id);
    nameById.set(id, pickStr(p, "title", "name") ?? "—");
  }
  const expBy = new Map<string, number>();
  const obBy = new Map<string, number>();
  const obRemBy = new Map<string, number>();
  const curBy = new Map<string, string>();
  for (const e of expenses) {
    const pid = String(e?.projectId ?? e?.project_id ?? "");
    if (!pid) continue;
    ids.add(pid);
    expBy.set(pid, (expBy.get(pid) ?? 0) + toNum(e?.amountMinor ?? e?.amount));
    if (!curBy.has(pid)) curBy.set(pid, String(e?.currency ?? "EGP"));
  }
  for (const o of obligations) {
    const pid = String(o?.projectId ?? o?.project_id ?? "");
    if (!pid) continue;
    ids.add(pid);
    obBy.set(pid, (obBy.get(pid) ?? 0) + toNum(o?.amountMinor ?? o?.amount));
    if (!o?.cancelledAt && !o?.cancelled) {
      obRemBy.set(pid, (obRemBy.get(pid) ?? 0) + obligationRemainingMinor(o));
    }
    if (!curBy.has(pid)) curBy.set(pid, String(o?.currency ?? "EGP"));
  }
  return Array.from(ids)
    .map((id) => ({
      projectId: id,
      projectName: nameById.get(id) ?? "—",
      expensesTotalMinor: expBy.get(id) ?? 0,
      obligationsTotalMinor: obBy.get(id) ?? 0,
      obligationsRemainingMinor: obRemBy.get(id) ?? 0,
      currency: curBy.get(id) ?? "EGP",
    }))
    .sort(
      (a, b) =>
        b.expensesTotalMinor + b.obligationsTotalMinor - (a.expensesTotalMinor + a.obligationsTotalMinor),
    );
}

export interface MonthPoint {
  month: string;
  totalMinor: number;
}

export function monthlySeries(expenses: Row[], months: number, today: string): MonthPoint[] {
  const [ty, tm] = today.split("-").map(Number);
  const out: MonthPoint[] = [];
  const count = months > 0 ? months : 6;
  for (let i = count - 1; i >= 0; i--) {
    let y = ty || 1970;
    let m = (tm || 1) - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const key = `${y}-${String(m).padStart(2, "0")}`;
    let total = 0;
    for (const e of expenses) {
      const paidOn = String(e?.paidOn ?? e?.date ?? "");
      if (paidOn.startsWith(key)) total += toNum(e?.amountMinor ?? e?.amount);
    }
    out.push({ month: key, totalMinor: total });
  }
  return out;
}

export interface QualityReport {
  blockedMilestones: MilestoneView[];
  unassignedDeliverables: DeliverableView[];
  missingDueDate: DeliverableView[];
  completionRatePct: number;
}

export function qualityReport(
  milestones: MilestoneView[],
  deliverables: DeliverableView[],
): QualityReport {
  return {
    blockedMilestones: milestones.filter(
      (m) => (m.blockedByTaskIds?.length ?? 0) > 0 && !isClosedStatus(m.status),
    ),
    unassignedDeliverables: deliverables.filter((d) => !d.assignee && !isClosedStatus(d.status)),
    missingDueDate: deliverables.filter((d) => !isValidISO(d.dueDate) && !isClosedStatus(d.status)),
    completionRatePct: completionRate(
      deliverables.filter((d) => isDoneStatus(d.status)).length,
      deliverables.length,
    ),
  };
}

export interface ProductivityReport {
  completedLast30: number;
  completedPrev30: number;
  trendPct: number;
  weekly: Array<{ label: string; completed: number }>;
  byPriority: Record<string, number>;
}

export function productivityReport(
  milestones: MilestoneView[],
  deliverables: DeliverableView[],
  today: string,
): ProductivityReport {
  const completedDates: string[] = [];
  for (const m of milestones) if (isValidISO(m.completedAt)) completedDates.push(m.completedAt as string);
  const inRange = (iso: string, from: number, to: number) => {
    const diff = daysBetween(today, iso);
    return diff >= from && diff <= to;
  };
  const last30 = completedDates.filter((iso) => inRange(iso, -29, 0)).length;
  const prev30 = completedDates.filter((iso) => inRange(iso, -59, -30)).length;
  const trendPct = prev30 === 0 ? (last30 > 0 ? 100 : 0) : Math.round(((last30 - prev30) / prev30) * 100);
  const weekly: Array<{ label: string; completed: number }> = [];
  for (let w = 3; w >= 0; w--) {
    const from = -(w * 7 + 6);
    const to = -(w * 7);
    weekly.push({
      label: w === 0 ? "الأسبوع الحالي" : `قبل ${w} أسبوع`,
      completed: completedDates.filter((iso) => inRange(iso, from, to)).length,
    });
  }
  const byPriority = countBy(
    deliverables.filter((d) => !isClosedStatus(d.status)),
    (d) => d.priority ?? "—",
  );
  return { completedLast30: last30, completedPrev30: prev30, trendPct, weekly, byPriority };
}