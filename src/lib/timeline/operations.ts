// عمليات سجلات نقية (بدون React) — نفس أسلوب طبقة الحسابات في المالية
import { assertValidDeliverableTransition } from "@/lib/timeline/validations";
import type {
  Deliverable,
  DeliverableInput,
  DeliverableStatus,
  Milestone,
  MilestoneInput,
} from "@/types/timeline";

function nowISO(): string {
  return new Date().toISOString();
}

function genId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDeliverableRecord(input: DeliverableInput, id?: string): Deliverable {
  const now = nowISO();
  return {
    ...input,
    id: id ?? genId(),
    status: "planned",
    statusHistory: [{ status: "planned", at: now }],
    createdAt: now,
    updatedAt: now,
  };
}

export interface TransitionOptions {
  note?: string;
  actualDeliveryDate?: string;
}

export function transitionDeliverableRecord(
  d: Deliverable,
  next: DeliverableStatus,
  opts: TransitionOptions = {}
): Deliverable {
  assertValidDeliverableTransition(d.status, next);
  const at = nowISO();
  const history = [...d.statusHistory, { status: next, at, note: opts.note }];
  let actualDeliveryDate = d.actualDeliveryDate;
  if (next === "delivered") {
    // أول تسليم بيتسجل — وبيتحفظ حتى لو اترفض ورجع للتنفيذ
    actualDeliveryDate = opts.actualDeliveryDate ?? actualDeliveryDate ?? at.slice(0, 10);
  }
  if (next === "accepted" && !actualDeliveryDate) {
    actualDeliveryDate = at.slice(0, 10);
  }
  return { ...d, status: next, actualDeliveryDate, statusHistory: history, updatedAt: at };
}

export type DeliverablePatch = Partial<
  Omit<Deliverable, "id" | "projectId" | "status" | "statusHistory" | "createdAt" | "updatedAt">
>;

// compactPatch: المفاتيح undefined مش بتمسح القيم الموجودة، والنص الفاضي بيمسح بقصد
export function updateDeliverableRecord(d: Deliverable, patch: DeliverablePatch): Deliverable {
  const next: Record<string, unknown> = { ...d };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    next[k] = v;
  }
  return { ...(next as unknown as Deliverable), updatedAt: nowISO() };
}

export function deliverableInputToPatch(input: DeliverableInput): DeliverablePatch {
  return {
    title: input.title,
    description: input.description,
    type: input.type,
    phaseId: input.phaseId,
    taskId: input.taskId,
    plannedStartDate: input.plannedStartDate,
    dueDate: input.dueDate,
    actualDeliveryDate: input.actualDeliveryDate,
    priority: input.priority,
    assignee: input.assignee,
    acceptanceCriteria: input.acceptanceCriteria,
    notes: input.notes,
    links: input.links,
  };
}

export function createMilestoneRecord(input: MilestoneInput, id?: string): Milestone {
  const now = nowISO();
  return {
    ...input,
    id: id ?? genId(),
    status: "planned",
    relatedTaskIds: [...input.relatedTaskIds],
    relatedDeliverableIds: [...input.relatedDeliverableIds],
    blockedByTaskIds: [...input.blockedByTaskIds],
    createdAt: now,
    updatedAt: now,
  };
}

export type MilestonePatch = Partial<
  Pick<Milestone, "title" | "description" | "date" | "relatedTaskIds" | "relatedDeliverableIds" | "blockedByTaskIds">
>;

// التعديل مايلمسش status ولا completedAt — تاريخ الإكمال التاريخي بيتحفظ
export function updateMilestoneRecord(m: Milestone, patch: MilestonePatch): Milestone {
  const next: Record<string, unknown> = { ...m };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    next[k] = v;
  }
  return { ...(next as unknown as Milestone), updatedAt: nowISO() };
}

export function completeMilestoneRecord(m: Milestone, note?: string, completedOn?: string): Milestone {
  if (m.status === "completed") throw new Error("المعلم مكتمل بالفعل");
  if (m.status === "archived") throw new Error("مش ممكن إكمال معلم مؤرشف");
  const completedAt = completedOn ?? nowISO().slice(0, 10);
  return {
    ...m,
    status: "completed",
    completedAt,
    completionNote: note ?? m.completionNote,
    updatedAt: nowISO(),
  };
}

export function archiveMilestoneRecord(m: Milestone): Milestone {
  if (m.status === "archived") throw new Error("المعلم مؤرشف بالفعل");
  return { ...m, status: "archived", updatedAt: nowISO() };
}