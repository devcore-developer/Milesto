import { isISODate } from "@/lib/timeline/dates";
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  canDeliverableTransition,
  DELIVERABLE_STATUS_LABELS,
} from "@/lib/timeline/status";
import type {
  DeliverableFormValues,
  DeliverableInput,
  DeliverableStatus,
  MilestoneFormValues,
  MilestoneInput,
  ValidationResult,
} from "@/types/timeline";

function cleanOptional(raw: string): string | undefined {
  const v = raw.trim();
  return v === "" ? undefined : v;
}

function isValidUrl(raw: string): boolean {
  return /^https?:\/\/\S+$/.test(raw.trim());
}

export function validateDeliverableForm(values: DeliverableFormValues): ValidationResult<DeliverableInput> {
  const title = values.title.trim();
  if (title === "") return { ok: false, error: "العنوان مطلوب" };

  const projectId = values.projectId.trim();
  if (projectId === "") return { ok: false, error: "اختار المشروع" };

  const type = values.type as DeliverableInput["type"];
  if (!DELIVERABLE_TYPES.includes(type)) return { ok: false, error: "نوع المخرج غير صالح" };

  const priority = values.priority as DeliverableInput["priority"];
  if (!PRIORITIES.includes(priority)) return { ok: false, error: "الأولوية غير صالحة" };

  if (!isISODate(values.plannedStartDate)) return { ok: false, error: "تاريخ البدء المخطط غير صالح" };
  if (!isISODate(values.dueDate)) return { ok: false, error: "تاريخ الاستحقاق غير صالح" };
  if (values.dueDate < values.plannedStartDate) {
    return { ok: false, error: "تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ البدء المخطط" };
  }

  const actualRaw = values.actualDeliveryDate.trim();
  if (actualRaw !== "" && !isISODate(actualRaw)) return { ok: false, error: "تاريخ التسليم الفعلي غير صالح" };

  const links = [];
  for (const link of values.links) {
    const label = link.label.trim();
    const url = link.url.trim();
    if (label === "" && url === "") continue;
    if (label === "") return { ok: false, error: "اكتب اسم للرابط" };
    if (!isValidUrl(url)) return { ok: false, error: "الروابط لازم تبدأ بـ http:// أو https://" };
    links.push({ label, url });
  }

  const value: DeliverableInput = {
    projectId,
    title,
    description: cleanOptional(values.description),
    type,
    phaseId: cleanOptional(values.phaseId),
    taskId: cleanOptional(values.taskId),
    plannedStartDate: values.plannedStartDate,
    dueDate: values.dueDate,
    actualDeliveryDate: actualRaw === "" ? undefined : actualRaw,
    priority,
    assignee: cleanOptional(values.assignee),
    acceptanceCriteria: cleanOptional(values.acceptanceCriteria),
    notes: cleanOptional(values.notes),
    links,
  };
  return { ok: true, value };
}

export function validateMilestoneForm(values: MilestoneFormValues): ValidationResult<MilestoneInput> {
  const title = values.title.trim();
  if (title === "") return { ok: false, error: "العنوان مطلوب" };

  const projectId = values.projectId.trim();
  if (projectId === "") return { ok: false, error: "اختار المشروع" };

  if (!isISODate(values.date)) return { ok: false, error: "تاريخ المعلم غير صالح" };

  const pickIds = (ids: string[]) => Array.from(new Set(ids.filter((id) => typeof id === "string" && id !== "")));

  const value: MilestoneInput = {
    projectId,
    title,
    description: cleanOptional(values.description),
    date: values.date,
    relatedTaskIds: pickIds(values.relatedTaskIds),
    relatedDeliverableIds: pickIds(values.relatedDeliverableIds),
    blockedByTaskIds: pickIds(values.blockedByTaskIds),
  };
  return { ok: true, value };
}

export function assertValidDeliverableTransition(from: DeliverableStatus, to: DeliverableStatus): void {
  if (from === to) throw new Error("المخرج بالفعل في الحالة دي");
  if (!canDeliverableTransition(from, to)) {
    throw new Error(
      `انتقال غير مسموح: من «${DELIVERABLE_STATUS_LABELS[from]}» إلى «${DELIVERABLE_STATUS_LABELS[to]}»`
    );
  }
}

export function typeLabelOrThrow(type: string): string {
  const labels = DELIVERABLE_TYPE_LABELS as Record<string, string | undefined>;
  return labels[type] ?? type;
}

export function priorityLabelOrThrow(priority: string): string {
  const labels = PRIORITY_LABELS as Record<string, string | undefined>;
  return labels[priority] ?? priority;
}