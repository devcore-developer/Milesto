import type {
  DeliverablePriority,
  DeliverableStatus,
  DeliverableType,
  MilestoneStatus,
  TimelineEventKind,
} from "@/types/timeline";

export type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral" | "outline";

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  ready_for_review: "جاهز للمراجعة",
  delivered: "تم التسليم",
  accepted: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

// انتقالات واضحة ومسموحة فقط — rejected يرجع للتنفيذ وتاريخه محفوظ،
// وaccepted مابيحصلش أوتوماتيك بعد delivered
export const ALLOWED_DELIVERABLE_TRANSITIONS: Record<DeliverableStatus, DeliverableStatus[]> = {
  planned: ["in_progress", "ready_for_review", "cancelled"],
  in_progress: ["planned", "ready_for_review", "cancelled"],
  ready_for_review: ["delivered", "in_progress", "cancelled"],
  delivered: ["accepted", "rejected", "in_progress"],
  rejected: ["in_progress", "planned", "cancelled"],
  accepted: [],
  cancelled: [],
};

export function canDeliverableTransition(from: DeliverableStatus, to: DeliverableStatus): boolean {
  return (ALLOWED_DELIVERABLE_TRANSITIONS[from] ?? []).includes(to);
}

export const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  website: "موقع إلكتروني",
  feature: "ميزة",
  document: "مستند",
  design: "تصميم",
  report: "تقرير",
  deployment: "نشر/تشغيل",
  presentation: "عرض تقديمي",
  other: "أخرى",
};

export const DELIVERABLE_TYPES = Object.keys(DELIVERABLE_TYPE_LABELS) as DeliverableType[];

export const PRIORITY_LABELS: Record<DeliverablePriority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

export const PRIORITY_ORDER: Record<DeliverablePriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const PRIORITIES = Object.keys(PRIORITY_LABELS) as DeliverablePriority[];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  planned: "مخطط",
  completed: "مكتمل",
  archived: "مؤرشف",
};

export const EVENT_KIND_LABELS: Record<TimelineEventKind, string> = {
  task_start: "بداية مهمة",
  task_due: "استحقاق مهمة",
  phase_end: "نهاية مرحلة",
  milestone: "معلم رئيسي",
  deliverable_due: "استحقاق مخرج",
  payment_due: "موعد دفعة",
};

export function statusBadgeVariant(status: DeliverableStatus): BadgeVariant {
  switch (status) {
    case "accepted": return "success";
    case "rejected": return "danger";
    case "ready_for_review": return "warning";
    case "in_progress":
    case "delivered": return "info";
    case "cancelled": return "neutral";
    default: return "outline";
  }
}

export function milestoneBadgeVariant(status: MilestoneStatus): BadgeVariant {
  if (status === "completed") return "success";
  if (status === "archived") return "neutral";
  return "outline";
}

export function priorityBadgeVariant(priority: DeliverablePriority): BadgeVariant {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

export const KIND_DOT_CLASSES: Record<TimelineEventKind, string> = {
  task_start: "bg-teal-500",
  task_due: "bg-sky-500",
  phase_end: "bg-indigo-500",
  milestone: "bg-amber-500",
  deliverable_due: "bg-rose-500",
  payment_due: "bg-violet-500",
};