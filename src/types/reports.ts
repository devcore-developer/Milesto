// Phase 9 — Reports & Insights
// كل المجاميع بتتبني من السجلات الحقيقية — مفيش reconstruct للتاريخ من الحالة الحالية
import type { DeliverablePriority, Deliverable, Milestone, SchedulePhase, ScheduleProject, TimelineEvent, PaymentView } from "@/types/timeline";
import type { FinanceExpense, FinanceObligation, FinanceTransaction, ProjectFinanceProfile } from "@/types/finance";

export type { Deliverable, Milestone, SchedulePhase, ScheduleProject, TimelineEvent, PaymentView };
export type { FinanceExpense, FinanceObligation, FinanceTransaction, ProjectFinanceProfile };

export interface ReportTask {
  id: string;
  projectId: string;
  phaseId?: string;
  title: string;
  status: string;
  priority: DeliverablePriority;
  startDate?: string;
  dueDate?: string;
  done: boolean;
  completedAt?: string; // تاريخ الإكمال الفعلي — أساس تحليل الالتزام بالمواعيد
  assignee?: string;
  weight?: number; // لو الموديل بتاعك فيه أوزان مهام
  dependencies: string[];
}

export interface ReportNote {
  id: string;
  projectId?: string;
  title?: string;
  content?: string;
  updatedAt?: string;
}

export interface CurrencyTotal {
  currency: string;
  minor: number;
}

export interface MonthlyCashRow {
  month: string; // "YYYY-MM"
  currency: string;
  inflowMinor: number;
  outflowMinor: number;
  netMinor: number;
}

export interface CategoryTotal {
  category: string;
  currency: string;
  minor: number;
}

export interface ProjectFinancialRow {
  projectId: string;
  projectName: string;
  contracted: CurrencyTotal[];
  collected: CurrencyTotal[];
  outstanding: CurrencyTotal[];
  expensesPaid: CurrencyTotal[];
  expensesUnpaid: CurrencyTotal[];
  netCash: CurrencyTotal[];
}

export interface FinancialSummary {
  // مقاييس تعاقدية (حالة حالية — مش متأثرة بفلتر التاريخ)
  contracted: CurrencyTotal[];
  contractedFallbackProjects: number; // مشاريع اتحسب تعاقدها من الالتزامات لعدم وجود profile
  outstanding: CurrencyTotal[];
  overdueReceivables: CurrencyTotal[];
  // مقاييس كاش (بتستجيب لفلتر التاريخ)
  collected: CurrencyTotal[];
  expensesPaid: CurrencyTotal[];
  expensesUnpaid: CurrencyTotal[];
  netCash: CurrencyTotal[];
  monthly: MonthlyCashRow[];
  expensesByCategory: CategoryTotal[];
  projects: ProjectFinancialRow[];
}

export interface ProjectProgressRow {
  projectId: string;
  projectName: string;
  progress: number; // 0..100
  tasksTotal: number;
  tasksDone: number;
  weighted: boolean; // هل الحساب استخدم أوزان فعلية؟
  hasTasks: boolean;
  overdueTasks: number;
}

export interface PortfolioSummary {
  projectsTotal: number;
  projectsActive: number;
  projectsAtRisk: number;
  approachingDeadline: number; // خلال 14 يوم
  tasksTotal: number;
  tasksCompleted: number;
  tasksActive: number;
  tasksOverdue: number;
  tasksBlocked: number; // نشطة معتمدة على مهام غير مكتملة ( subset من active )
  deliverablesTotal: number;
  deliverablesActive: number;
  deliverablesDelivered: number; // بانتظار قرار القبول
  deliverablesAccepted: number;
  deliverablesRejected: number;
  deliverablesCancelled: number;
  acceptanceRate: number | null; // مقبول ÷ (مقبول + مرفوض) — null لو مفيش قرار اتخد
  overallProgress: number | null; // متوسط تقدم المشاريع اللي ليها مهام — null لو مفيش مهام
  projectsProgress: ProjectProgressRow[];
}

export interface QualityGateView {
  id: string;
  name: string;
  projectId?: string;
  status: "passed" | "failed" | "blocked" | "unknown";
  detail?: string;
}

export interface QualitySnapshot {
  available: boolean;
  // المقامات معرّفة صراحة:
  casesTotal: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notExecuted: number;
  executed: number; // = passed + failed بالظبط
  passRate: number | null; // passed ÷ executed — المحجوبة/المتخطاة/غير المنفذة مش في المقام
  coverage: number | null; // (passed+failed+blocked+skipped) ÷ casesTotal
  bugsTotal: number;
  bugsOpen: number;
  bugsBySeverity: { severity: string; count: number }[];
  bugsByStatus: { status: string; count: number }[];
  bugsByProject: { projectId: string; projectName: string; total: number; open: number }[];
  retestsTotal: number;
  retestsPassed: number;
  retestsAvailable: boolean;
  gates: QualityGateView[];
  byProject: {
    projectId: string;
    projectName: string;
    casesTotal: number;
    passed: number;
    failed: number;
    passRate: number | null;
  }[];
}

export interface ProductivitySummary {
  hasCompletionDates: boolean;
  completionTrend: { period: string; label: string; completed: number }[];
  onTime: number;
  late: number;
  noCompletionDate: number;
  overdueByPriority: { priority: DeliverablePriority; count: number }[];
  overdueByProject: { projectId: string; projectName: string; count: number }[];
  phaseDurations: { projectId: string; projectName: string; phaseId: string; phaseName: string; days: number }[];
  workload: { assignee: string; total: number; done: number; overdue: number }[];
  workloadAvailable: boolean;
}

export interface ReportInsight {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  projectId?: string;
  target: { tab: Exclude<ReportTab, "builder">; projectId?: string };
}

export type ReportTab = "overview" | "projects" | "productivity" | "quality" | "financial" | "builder";
export type ReportType = Exclude<ReportTab, "builder">;

export interface ReportFilters {
  projectId: string | "all";
  dateFrom?: string;
  dateTo?: string;
  expenseCategory?: string;
  itemStatus?: string; // بيأثر على جداول المهام — مش على المجاميع
}

export interface ReportConfig {
  id: string;
  name: string;
  reportType: ReportType;
  sections: string[];
  filters: ReportFilters;
  createdAt: string;
  updatedAt: string;
}