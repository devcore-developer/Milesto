import { describe, expect, it } from "vitest";
import {
  addDays,
  buildInsights,
  completionRate,
  daysBetween,
  deadlineBucket,
  detectConflicts,
  formatMoney,
  groupDeadlines,
  isValidISO,
  monthlySeries,
  normalizeStatus,
  projectFinanceRows,
  projectPerformance,
  qualityReport,
  statusLabel,
  statusTone,
  productivityReport,
  toMilestoneViews,
} from "@/lib/report-insights";

describe("تطبيع الحالات", () => {
  it("يوحّد الكباب والسنيك", () => {
    expect(normalizeStatus("In-Progress")).toBe("in_progress");
    expect(normalizeStatus("in progress")).toBe("in_progress");
  });

  it("يرجّع تسمية عربية معروفة", () => {
    expect(statusLabel("in-progress")).toBe("قيد التنفيذ");
    expect(statusLabel("done")).toBe("منجزة");
  });

  it("الحالة المجهولة ترجع النص الأصلي واللون محايد", () => {
    expect(statusLabel("weird")).toBe("weird");
    expect(statusTone("weird")).toBe("neutral");
    expect(statusTone("done")).toBe("success");
  });
});

describe("التواريخ", () => {
  it("يتحقق من صيغة ISO والسنة الكبيسة", () => {
    expect(isValidISO("2024-02-29")).toBe(true);
    expect(isValidISO("2023-02-29")).toBe(false);
    expect(isValidISO("2024-13-01")).toBe(false);
    expect(isValidISO("2024-1-1")).toBe(false);
  });

  it("يضيف أيام ويتعامل مع نهاية الشهر", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("يحسب الفرق بين تاريخين", () => {
    expect(daysBetween("2024-01-01", "2024-01-08")).toBe(7);
  });
});

describe("الاستحقاقات", () => {
  it("يصنّف الاستحقاق في التند الصحيح", () => {
    expect(deadlineBucket("2024-01-05", "2024-01-01")).toBe("next7");
    expect(deadlineBucket("2023-12-25", "2024-01-01")).toBe("overdue");
    expect(deadlineBucket("2024-01-20", "2024-01-01")).toBe("next30");
    expect(deadlineBucket("2024-03-15", "2024-01-01")).toBe("later");
    expect(deadlineBucket(undefined, "2024-01-01")).toBe("no_date");
  });

  it("يجمع العناصر في تندات", () => {
    const items = [
      { id: "1", kind: "deliverable" as const, title: "أ", dueDate: "2024-01-05" },
      { id: "2", kind: "milestone" as const, title: "ب", dueDate: "2024-01-20" },
      { id: "3", kind: "deliverable" as const, title: "ج" },
    ];
    const groups = groupDeadlines(items, "2024-01-01");
    expect(groups.next7).toHaveLength(1);
    expect(groups.next30).toHaveLength(1);
    expect(groups.no_date).toHaveLength(1);
  });
});

describe("المبالغ", () => {
  it("يحوّل الوحدات الصغرى لنص مبلغ", () => {
    expect(formatMoney(1500)).toBe("15.00 EGP");
    expect(formatMoney(123456, "USD")).toBe("1,234.56 USD");
  });
});

describe("نسب الإنجاز", () => {
  it("يحسب النسبة بأمان", () => {
    expect(completionRate(3, 4)).toBe(75);
    expect(completionRate(0, 0)).toBe(0);
  });
});

describe("السلسلة الشهرية", () => {
  it("يجمع المصروفات بالشهر", () => {
    const expenses = [
      { paidOn: "2024-01-05", amountMinor: 1000 },
      { paidOn: "2023-12-02", amountMinor: 2500 },
    ];
    const series = monthlySeries(expenses, 2, "2024-01-31");
    expect(series).toEqual([
      { month: "2023-12", totalMinor: 2500 },
      { month: "2024-01", totalMinor: 1000 },
    ]);
  });
});

describe("الصفوف المالية", () => {
  it("يحسب المصروفات والالتزامات والمتبقي لكل مشروع", () => {
    const rows = projectFinanceRows(
      [{ id: "p1", title: "مشروع أ" }],
      [{ projectId: "p1", amountMinor: 5000, currency: "EGP" }],
      [{ projectId: "p1", amountMinor: 10000, paidMinor: 2500 }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].expensesTotalMinor).toBe(5000);
    expect(rows[0].obligationsTotalMinor).toBe(10000);
    expect(rows[0].obligationsRemainingMinor).toBe(7500);
    expect(rows[0].currency).toBe("EGP");
  });
});

describe("أداء المشاريع", () => {
  it("يحسب المنجز والمتأخر ونسبة التقدم", () => {
    const rows = projectPerformance(
      [{ id: "p1", title: "P" }],
      [
        { id: "m1", projectId: "p1", status: "done" },
        { id: "m2", projectId: "p1", status: "in_progress", date: "2025-01-01" },
      ],
      [
        { id: "d1", projectId: "p1", status: "done", dueDate: "2024-06-01" },
        { id: "d2", projectId: "p1", status: "in_progress", dueDate: "2024-06-01" },
      ],
      "2024-07-01",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].milestonesTotal).toBe(2);
    expect(rows[0].milestonesDone).toBe(1);
    expect(rows[0].deliverablesTotal).toBe(2);
    expect(rows[0].deliverablesDone).toBe(1);
    expect(rows[0].overdue).toBe(1);
    expect(rows[0].progress).toBe(50);
  });
});

describe("التعارضات والرؤى", () => {
  it("يكشف تعارض نفس اليوم وتأخر الاستحقاق", () => {
    const items = [
      { id: "1", kind: "deliverable" as const, title: "أ", dueDate: "2024-07-10", projectId: "p1", status: "in_progress" },
      { id: "2", kind: "deliverable" as const, title: "ب", dueDate: "2024-07-10", projectId: "p1", status: "in_progress" },
      { id: "3", kind: "milestone" as const, title: "ج", dueDate: "2024-06-01", status: "in_progress" },
    ];
    const conflicts = detectConflicts(items, "2024-07-01");
    expect(conflicts).toHaveLength(2);
    const insights = buildInsights(items, "2024-07-01");
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((i) => i.id === "overdue")).toBe(true);
    expect(insights.some((i) => i.id === "next7")).toBe(true);
  });
});

describe("الإنتاجية والجودة", () => {
  it("يقارن آخر 30 يوم بالـ 30 اللي قبلهم", () => {
    const report = productivityReport(
      [
        { id: "m1", completedAt: "2024-07-01" },
        { id: "m2", completedAt: "2024-06-01" },
      ],
      [],
      "2024-07-01",
    );
    expect(report.completedLast30).toBe(1);
    expect(report.completedPrev30).toBe(1);
    expect(report.trendPct).toBe(0);
  });

  it("يكتشف مشاكل الجودة", () => {
    const report = qualityReport(
      [{ id: "m1", status: "in_progress", blockedByTaskIds: ["t1"] }],
      [
        { id: "d1", status: "in_progress" },
        { id: "d2", status: "in_progress", assignee: "أحمد" },
      ],
    );
    expect(report.blockedMilestones).toHaveLength(1);
    expect(report.unassignedDeliverables).toHaveLength(1);
    expect(report.missingDueDate).toHaveLength(2);
  });
});

describe("قراءة الموديلات", () => {
  it("يحوّل الداتا الخام لعرض آمن", () => {
    const views = toMilestoneViews([
      { id: "m1", title: "ت", status: "done", date: "2024-01-01", blockedByTaskIds: ["t1", "t2"] },
    ]);
    expect(views).toHaveLength(1);
    expect(views[0].date).toBe("2024-01-01");
    expect(views[0].blockedByTaskIds).toEqual(["t1", "t2"]);
    expect(toMilestoneViews(null)).toEqual([]);
  });
});