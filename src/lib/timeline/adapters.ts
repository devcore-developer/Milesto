// طبقة التكامل مع الموديلات الموجودة — قراءة دفاعية بدون أي افتراض صارم
// عن شكل Project/Task/Phase القديم. لو اسم حقل مختلف عندك، بتصلحه هنا وبس.
import type { FinanceObligation, FinanceTransaction } from "@/types/finance";
import type {
  DeliverablePriority,
  PaymentView,
  ScheduleData,
  SchedulePhase,
  ScheduleProject,
  ScheduleTask,
} from "@/types/timeline";

export function readArray<T>(source: unknown, key: string): T[] {
  if (source == null) return [];
  if (Array.isArray(source)) return source as T[];
  if (typeof source !== "object") return [];
  const rec = source as Record<string, unknown>;
  const direct = rec[key];
  if (Array.isArray(direct)) return direct as T[];
  const nested = rec["dataset"] ?? rec["state"];
  if (nested && typeof nested === "object") {
    const arr = (nested as Record<string, unknown>)[key];
    if (Array.isArray(arr)) return arr as T[];
  }
  return [];
}

function readString(source: unknown, key: string): string | undefined {
  if (source == null || typeof source !== "object") return undefined;
  const v = (source as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function readBool(source: unknown, key: string): boolean {
  if (source == null || typeof source !== "object") return false;
  return (source as Record<string, unknown>)[key] === true;
}

function dateOrUndef(raw: string | undefined): string | undefined {
  return raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : undefined;
}

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export const TASK_DONE_STATUSES: ReadonlySet<string> = new Set(["done", "completed"]);

export function isDoneTaskStatus(status?: string): boolean {
  return typeof status === "string" && TASK_DONE_STATUSES.has(status);
}

export function normalizePriority(raw: unknown): DeliverablePriority {
  const s = typeof raw === "string" ? raw.toLowerCase() : "";
  if (s === "low") return "low";
  if (s === "high") return "high";
  if (s === "critical" || s === "urgent") return "critical";
  return "medium";
}

function adaptTask(t: Record<string, unknown>, fallbackProjectId: string): ScheduleTask {
  const id = readString(t, "id") ?? "";
  const depsRaw = readArray<unknown>(t, "dependencies");
  const deps = dedupe(
    depsRaw
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object") return readString(d, "id");
        return undefined;
      })
      .filter((x): x is string => typeof x === "string" && x !== "")
  ).filter((d) => d !== id); // منع self-dependency من المصدر
  const status = readString(t, "status") ?? "";
  return {
    id,
    projectId: readString(t, "projectId") ?? fallbackProjectId,
    phaseId: readString(t, "phaseId"),
    title: readString(t, "title") ?? readString(t, "name") ?? "",
    status,
    priority: normalizePriority(readString(t, "priority")),
    startDate: dateOrUndef(readString(t, "startDate")),
    dueDate: dateOrUndef(readString(t, "dueDate") ?? readString(t, "endDate")),
    dependencies: deps,
    done: isDoneTaskStatus(status) || readBool(t, "completed"),
  };
}

export function adaptSchedule(projectsRaw: unknown): ScheduleData {
  const projects: ScheduleProject[] = [];
  const phases: SchedulePhase[] = [];
  const tasks: ScheduleTask[] = [];
  const seenTasks = new Set<string>();
  const seenPhases = new Set<string>();

  const collectTask = (t: Record<string, unknown>, fallbackProjectId: string) => {
    const id = readString(t, "id");
    if (!id || seenTasks.has(id)) return;
    seenTasks.add(id);
    tasks.push(adaptTask(t, fallbackProjectId));
  };
  const collectPhase = (ph: Record<string, unknown>, fallbackProjectId: string) => {
    const id = readString(ph, "id");
    if (!id || seenPhases.has(id)) return;
    seenPhases.add(id);
    phases.push({
      id,
      projectId: readString(ph, "projectId") ?? fallbackProjectId,
      name: readString(ph, "name") ?? readString(ph, "title") ?? id,
      startDate: dateOrUndef(readString(ph, "startDate")),
      endDate: dateOrUndef(readString(ph, "endDate") ?? readString(ph, "dueDate")),
    });
  };

  // (أ) مهام/مراحل مخزنة على مستوى الـ context نفسه
  for (const t of readArray<Record<string, unknown>>(projectsRaw, "tasks")) collectTask(t, readString(t, "projectId") ?? "");
  for (const ph of readArray<Record<string, unknown>>(projectsRaw, "phases")) collectPhase(ph, readString(ph, "projectId") ?? "");

  // (ب) مهام/مراحل nested جوه كل مشروع
  for (const p of readArray<Record<string, unknown>>(projectsRaw, "projects")) {
    const id = readString(p, "id");
    if (!id) continue;
    projects.push({
      id,
      name: readString(p, "name") ?? readString(p, "title") ?? id,
      status: readString(p, "status"),
      startDate: dateOrUndef(readString(p, "startDate")),
      dueDate: dateOrUndef(readString(p, "dueDate") ?? readString(p, "endDate")),
    });
    for (const ph of readArray<Record<string, unknown>>(p, "phases")) collectPhase(ph, id);
    for (const t of readArray<Record<string, unknown>>(p, "tasks")) collectTask(t, id);
  }

  return { projects, phases, tasks, payments: [] };
}

// المجموع المحصّل لكل التزام = المدفوعات الفعّالة − المرتجعات (الملغاة/المبطلات مستثناة)
export function buildPaymentViews(obligations: FinanceObligation[], transactions: FinanceTransaction[]): PaymentView[] {
  const netByObligation = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.voidedAt) continue;
    if (tx.type !== "payment" && tx.type !== "refund") continue;
    const signed = tx.type === "payment" ? tx.amountMinor : -tx.amountMinor;
    netByObligation.set(tx.obligationId, (netByObligation.get(tx.obligationId) ?? 0) + signed);
  }
  return obligations.map((o) => {
    const net = netByObligation.get(o.id) ?? 0;
    const cancelled = Boolean(o.cancelledAt);
    const fullyPaid = !cancelled && o.amountMinor > 0 && net >= o.amountMinor;
    return {
      id: o.id,
      projectId: o.projectId,
      title: o.title || "دفعة",
      dueDate: o.dueDate,
      currency: o.currency,
      amountMinor: o.amountMinor,
      paidMinor: Math.max(0, net),
      fullyPaid,
      cancelled,
    };
  });
}