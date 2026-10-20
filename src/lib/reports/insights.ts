// رؤى مبنية على قواعد شفافة من بيانات فعلية — مفيش AI ومفيش تنبؤات
import { diffDays, startOfWeekISO, formatArabicDate } from "@/lib/timeline/dates";
import { formatMoneyMinor } from "@/components/timeline/shared";
import type {
  CurrencyTotal,
  QualitySnapshot,
  ReportInsight,
  ReportTask,
} from "@/types/reports";
import type { Deliverable, Milestone, PaymentView, ScheduleProject, TimelineEvent } from "@/types/timeline";

const SEVERITY_ORDER: Record<ReportInsight["severity"], number> = { high: 0, medium: 1, low: 2 };

export function buildReportInsights(input: {
  tasks: ReportTask[];
  deliverables: Deliverable[];
  milestones: Milestone[];
  payments: PaymentView[];
  events: TimelineEvent[];
  outstanding: CurrencyTotal[];
  quality: QualitySnapshot;
  projects: ScheduleProject[];
  today: string;
}): ReportInsight[] {
  const { tasks, deliverables, milestones, payments, events, outstanding, quality, projects, today } = input;
  const insights: ReportInsight[] = [];
  const projectName = new Map(projects.map((p) => [p.id, p.name] as const));
  const nameOf = (id: string) => projectName.get(id) ?? id;

  // (1) مهام متأخرة عالية الأولوية لكل مشروع
  const overdueHigh = new Map<string, number>();
  for (const t of tasks) {
    if (t.done || !t.dueDate || t.dueDate >= today) continue;
    if (t.priority !== "high" && t.priority !== "critical") continue;
    overdueHigh.set(t.projectId, (overdueHigh.get(t.projectId) ?? 0) + 1);
  }
  for (const [projectId, count] of overdueHigh) {
    insights.push({
      id: `overdue-high:${projectId}`,
      severity: "high",
      title: "مهام متأخرة عالية الأولوية",
      detail: `«${nameOf(projectId)}» عندها ${count} مهمة متأخرة عالية/حرجة الأولوية`,
      projectId,
      target: { tab: "projects", projectId },
    });
  }

  // (2) مخرجات مستحقة خلال 7 أيام
  let delivCount = 0;
  for (const d of deliverables) {
    if (d.status === "accepted" || d.status === "cancelled") continue;
    const days = diffDays(today, d.dueDate);
    if (days < 0 || days > 7) continue;
    if (delivCount >= 5) break;
    delivCount++;
    insights.push({
      id: `deliverable-due:${d.id}`,
      severity: "medium",
      title: "مخرج قارب على الاستحقاق",
      detail: `مخرج «${d.title}» في «${nameOf(d.projectId)}» مستحق خلال ${days} يوم (${d.status === "delivered" ? "بانتظار قرار القبول" : "لسه في التنفيذ"})`,
      projectId: d.projectId,
      target: { tab: "projects", projectId: d.projectId },
    });
  }

  // (3) جودة: اختبارات فاشلة / بوابة معطلة
  if (quality.available && quality.failed > 0) {
    insights.push({
      id: "quality-failed",
      severity: "high",
      title: "اختبارات فاشلة",
      detail: `في ${quality.failed} اختبار فاشل — بوابة الجودة مش هتعدي والفحوصات محتاجة مراجعة`,
      target: { tab: "quality" },
    });
  }
  for (const g of quality.gates) {
    if (g.status !== "blocked") continue;
    insights.push({
      id: `quality-gate:${g.id}`,
      severity: "high",
      title: "بوابة جودة معطّلة",
      detail: `بوابة «${g.name}» حالة معلّقة${g.detail ? ` — ${g.detail}` : ""}`,
      projectId: g.projectId,
      target: { tab: "quality" },
    });
  }

  // (4) التزامات دفع متأخرة (غير محصّلة)
  let payCount = 0;
  for (const p of payments) {
    if (p.cancelled || p.fullyPaid || !(p.dueDate < today)) continue;
    const remaining = p.amountMinor - p.paidMinor;
    if (remaining <= 0) continue;
    if (payCount >= 6) break;
    payCount++;
    insights.push({
      id: `payment-overdue:${p.id}`,
      severity: "high",
      title: "التزام دفع متأخر",
      detail: `«${p.title}» في «${nameOf(p.projectId)}» متأخر — متبقي ${formatMoneyMinor(p.currency, remaining)} من إجمالي ${formatMoneyMinor(p.currency, p.amountMinor)}`,
      projectId: p.projectId,
      target: { tab: "financial", projectId: p.projectId },
    });
  }

  // (5) مستحقات غير محصلة لكل عملة
  let recvCount = 0;
  for (const t of outstanding) {
    if (t.minor <= 0) continue;
    if (recvCount >= 4) break;
    recvCount++;
    insights.push({
      id: `receivables:${t.currency}`,
      severity: "medium",
      title: "مستحقات غير محصلة",
      detail: `في مستحقات مفتوحة بعملة ${t.currency} بقيمة ${formatMoneyMinor(t.currency, t.minor)}`,
      target: { tab: "financial" },
    });
  }

  // (6) تكديز مستحقات في نفس الأسبوع
  const weekBuckets = new Map<string, number>();
  for (const e of events) {
    if (e.done) continue;
    const wk = startOfWeekISO(e.date);
    weekBuckets.set(wk, (weekBuckets.get(wk) ?? 0) + 1);
  }
  let clusterCount = 0;
  for (const [wk, count] of [...weekBuckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (count < 3) continue;
    if (clusterCount >= 3) break;
    clusterCount++;
    insights.push({
      id: `cluster-week:${wk}`,
      severity: "medium",
      title: "أسبوع محمّل بمستحقات",
      detail: `${count} أحداث مستحقة في الأسبوع اللي بيبدأ ${formatArabicDate(wk)}`,
      target: { tab: "productivity" },
    });
  }

  // (7) معالم فات موعدها ومازالت مخططة
  let msCount = 0;
  for (const m of milestones) {
    if (m.status !== "planned" || !(m.date < today)) continue;
    if (msCount >= 5) break;
    msCount++;
    insights.push({
      id: `milestone-missed:${m.id}`,
      severity: "medium",
      title: "معلم فات موعده",
      detail: `معلم «${m.title}» في «${nameOf(m.projectId)}» تاريخه ${formatArabicDate(m.date)} ومازال مخطط بدون إكمال`,
      projectId: m.projectId,
      target: { tab: "projects", projectId: m.projectId },
    });
  }

  return insights.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title, "ar")
  );
}