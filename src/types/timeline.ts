// Phase 8 — Timeline & Deliverables
// كل التواريخ strings بصيغة "YYYY-MM-DD" — بدون تحويلات timezone

export type DeliverableType =
  | "website"
  | "feature"
  | "document"
  | "design"
  | "report"
  | "deployment"
  | "presentation"
  | "other";

export type DeliverableStatus =
  | "planned"
  | "in_progress"
  | "ready_for_review"
  | "delivered"
  | "accepted"
  | "rejected"
  | "cancelled";

export type DeliverablePriority = "low" | "medium" | "high" | "critical";

export type MilestoneStatus = "planned" | "completed" | "archived";

export type TimelineEventKind =
  | "task_start"
  | "task_due"
  | "phase_end"
  | "milestone"
  | "deliverable_due"
  | "payment_due";

export interface DeliverableLink {
  label: string;
  url: string;
}

export interface DeliverableStatusEntry {
  status: DeliverableStatus;
  at: string; // ISO datetime
  note?: string;
}

export interface Deliverable {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: DeliverableType;
  phaseId?: string;
  taskId?: string;
  plannedStartDate: string;
  dueDate: string;
  actualDeliveryDate?: string;
  status: DeliverableStatus;
  priority: DeliverablePriority;
  assignee?: string;
  acceptanceCriteria?: string;
  notes?: string;
  links: DeliverableLink[];
  statusHistory: DeliverableStatusEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  date: string;
  status: MilestoneStatus;
  completedAt?: string; // تاريخ الإكمال التاريخي — بيتحفظ حتى لو ميعاد المعلم اتعدل
  completionNote?: string;
  relatedTaskIds: string[];
  relatedDeliverableIds: string[];
  blockedByTaskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string; // `${kind}:${refId}` — مضمون التفرد (مفيش سجلات مزدوجة)
  kind: TimelineEventKind;
  date: string;
  title: string;
  projectId: string;
  projectName: string;
  refId: string;
  refKind: "task" | "phase" | "milestone" | "deliverable" | "obligation";
  priority: DeliverablePriority;
  done: boolean; // دفعة محصّلة بالكامل أو مهمة مكتملة
  payment?: {
    currency: string;
    amountMinor: number;
    paidMinor: number;
    fullyPaid: boolean;
  };
}

export interface TimelineFilters {
  projectId: string | "all";
  kinds: TimelineEventKind[]; // فاضية = الكل
  priorities: DeliverablePriority[]; // فاضية = الكل
  dateFrom?: string;
  dateTo?: string;
  scope: "active" | "all";
}

export type DeadlineBucket = "overdue" | "today" | "next7" | "next30" | "later";

// نُسخ مجدولة مبسّطة — بتتبني من بيانات المشاريع الحقيقية عبر الـ adapters
export interface ScheduleProject {
  id: string;
  name: string;
  status?: string;
  startDate?: string;
  dueDate?: string;
}

export interface SchedulePhase {
  id: string;
  projectId: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface ScheduleTask {
  id: string;
  projectId: string;
  phaseId?: string;
  title: string;
  status: string;
  priority: DeliverablePriority;
  startDate?: string;
  dueDate?: string;
  dependencies: string[];
  done: boolean;
}

export interface PaymentView {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  currency: string;
  amountMinor: number;
  paidMinor: number;
  fullyPaid: boolean;
  cancelled: boolean;
}

export interface ScheduleData {
  projects: ScheduleProject[];
  phases: SchedulePhase[];
  tasks: ScheduleTask[];
  payments: PaymentView[];
}

export interface AwaitingReviewItem {
  deliverableId: string;
  title: string;
  projectId: string;
  projectName: string;
  status: DeliverableStatus;
  dueDate?: string;
}

export interface AtRiskItem {
  taskId: string;
  title: string;
  projectId: string;
  projectName: string;
  dueDate?: string;
  daysLeft?: number;
  blockedBy: string[];
  risk: number; // 0..100 — تقدير تقريبي موثّق وليس تنبؤًا
}

export interface UnscheduledItem {
  taskId: string;
  title: string;
  projectId: string;
  projectName: string;
}

export interface RecentCompletedItem {
  deliverableId: string;
  title: string;
  projectId: string;
  projectName: string;
  actualDeliveryDate: string;
  status: DeliverableStatus;
}

export interface DeadlineInsights {
  today: string;
  overdue: TimelineEvent[];
  dueToday: TimelineEvent[];
  next7: TimelineEvent[];
  next30: TimelineEvent[];
  upcomingMilestones: TimelineEvent[];
  awaitingReview: AwaitingReviewItem[];
  atRisk: AtRiskItem[];
  unscheduled: UnscheduledItem[];
  recentCompleted: RecentCompletedItem[];
  counts: { overdue: number; today: number; next7: number; next30: number };
}

export type ConflictType =
  | "circular_dependency"
  | "blocked_task"
  | "schedule_before_prerequisite"
  | "overloaded_day"
  | "clustered_high_priority";

export interface ConflictRef {
  kind: string;
  id: string;
  label: string;
}

export interface ScheduleConflict {
  id: string;
  type: ConflictType;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  projectId?: string;
  date?: string;
  refs: ConflictRef[];
}

export interface DeliverableInput {
  projectId: string;
  title: string;
  description?: string;
  type: DeliverableType;
  phaseId?: string;
  taskId?: string;
  plannedStartDate: string;
  dueDate: string;
  actualDeliveryDate?: string;
  priority: DeliverablePriority;
  assignee?: string;
  acceptanceCriteria?: string;
  notes?: string;
  links: DeliverableLink[];
}

export interface DeliverableFormValues {
  title: string;
  description: string;
  projectId: string;
  type: string;
  phaseId: string;
  taskId: string;
  plannedStartDate: string;
  dueDate: string;
  actualDeliveryDate: string;
  priority: string;
  assignee: string;
  acceptanceCriteria: string;
  notes: string;
  links: { label: string; url: string }[];
}

export interface MilestoneInput {
  projectId: string;
  title: string;
  description?: string;
  date: string;
  relatedTaskIds: string[];
  relatedDeliverableIds: string[];
  blockedByTaskIds: string[];
}

export interface MilestoneFormValues {
  title: string;
  description: string;
  projectId: string;
  date: string;
  relatedTaskIds: string[];
  relatedDeliverableIds: string[];
  blockedByTaskIds: string[];
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };