// طبقة الحسابات المالية للتقارير — نفس قواعد Phase 7 بالظبط:
// minor units صحيحة | تجميع بالعملة فقط (ممنوع جمع عملات) | الملغي/المبطل مستثنى
// كاش ≠ تعاقدات: collected من الترانزاكشنات فقط، والالتزامات مش بتتحسب مرتين
import type {
  CategoryTotal,
  CurrencyTotal,
  FinancialSummary,
  MonthlyCashRow,
  ProjectFinancialRow,
} from "@/types/reports";
import type { FinanceExpense, FinanceObligation, FinanceTransaction, ProjectFinanceProfile } from "@/types/finance";
import type { ScheduleProject } from "@/types/timeline";
import { monthKeyOf } from "@/lib/timeline/dates";

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  hosting: "استضافة",
  domain: "دومين",
  software: "برمجيات/تراخيص",
  contractor: "متعاقدين",
  marketing: "تسويق",
  infrastructure: "بنية تحتية",
  other: "أخرى",
};

export function categoryLabel(raw: string): string {
  return EXPENSE_CATEGORY_LABELS[raw.toLowerCase()] ?? raw;
}

export interface DateRangeInput {
  dateFrom?: string;
  dateTo?: string;
}

// حدود المدى شاملة الطرفين
export function isDateInRange(date: string | undefined, f: DateRangeInput): boolean {
  if (!date) return true;
  if (f.dateFrom && date < f.dateFrom) return false;
  if (f.dateTo && date > f.dateTo) return false;
  return true;
}

export function groupByCurrency(sums: Map<string, number>): CurrencyTotal[] {
  return Array.from(sums.entries())
    .filter(([, minor]) => minor !== 0)
    .map(([currency, minor]) => ({ currency, minor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function minorOf(totals: CurrencyTotal[], currency: string): number {
  return totals.find((t) => t.currency === currency)?.minor ?? 0;
}

// Cash-in الصافي = مدفوعات − مرتجعات (بدون المبطلات)
export function sumCollectedByCurrency(transactions: FinanceTransaction[], f: DateRangeInput): Map<string, number> {
  const sums = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.voidedAt) continue;
    if (!isDateInRange(tx.date, f)) continue;
    const signed = tx.type === "refund" ? -tx.amountMinor : tx.amountMinor;
    sums.set(tx.currency, (sums.get(tx.currency) ?? 0) + signed);
  }
  return sums;
}

export function netPaymentsByObligation(transactions: FinanceTransaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.voidedAt) continue;
    const signed = tx.type === "refund" ? -tx.amountMinor : tx.amountMinor;
    map.set(tx.obligationId, (map.get(tx.obligationId) ?? 0) + signed);
  }
  return map;
}

// المستحقات الحالية = Σ (قيمة الالتزام − المدفوع) للالتزامات النشطة، مقفولة على صفر
export function computeOutstandingByCurrency(obligations: FinanceObligation[], transactions: FinanceTransaction[]): Map<string, number> {
  const net = netPaymentsByObligation(transactions);
  const sums = new Map<string, number>();
  for (const o of obligations) {
    if (o.cancelledAt) continue;
    const remaining = Math.max(0, o.amountMinor - (net.get(o.id) ?? 0));
    if (remaining > 0) sums.set(o.currency, (sums.get(o.currency) ?? 0) + remaining);
  }
  return sums;
}

export function computeOverdueReceivablesByCurrency(
  obligations: FinanceObligation[],
  transactions: FinanceTransaction[],
  today: string
): Map<string, number> {
  const net = netPaymentsByObligation(transactions);
  const sums = new Map<string, number>();
  for (const o of obligations) {
    if (o.cancelledAt) continue;
    if (!(o.dueDate < today)) continue;
    const remaining = Math.max(0, o.amountMinor - (net.get(o.id) ?? 0));
    if (remaining > 0) sums.set(o.currency, (sums.get(o.currency) ?? 0) + remaining);
  }
  return sums;
}

// التعاقدات: profile لكل مشروع أولًا — ولو مفيش profile بندفع لنجمع التزامات المشروع النشطة (fallback معلن)
export function computeContracted(
  profiles: ProjectFinanceProfile[],
  obligations: FinanceObligation[],
  projectIds: Set<string>
): { totals: CurrencyTotal[]; fallbackCount: number } {
  const sums = new Map<string, number>();
  const profiledProjects = new Set(profiles.map((p) => p.projectId));
  const fallbackProjects = new Set<string>();
  for (const p of profiles) {
    if (!projectIds.has(p.projectId)) continue;
    sums.set(p.currency, (sums.get(p.currency) ?? 0) + p.contractValueMinor);
  }
  for (const o of obligations) {
    if (o.cancelledAt) continue;
    if (!projectIds.has(o.projectId)) continue;
    if (profiledProjects.has(o.projectId)) continue; // التعاقد محسوب من الـ profile — ممنوع التكرار
    sums.set(o.currency, (sums.get(o.currency) ?? 0) + o.amountMinor);
    fallbackProjects.add(o.projectId);
  }
  return { totals: groupByCurrency(sums), fallbackCount: fallbackProjects.size };
}

// تاريخ التدفق النقدي للمصروف المدفوع = paidOn لو موجود وإلا date
function expenseCashDate(e: FinanceExpense): string {
  return e.paidOn && e.paidOn !== "" ? e.paidOn : e.date;
}

export function sumPaidExpensesByCurrency(expenses: FinanceExpense[], f: DateRangeInput): Map<string, number> {
  const sums = new Map<string, number>();
  for (const e of expenses) {
    if (e.voidedAt) continue;
    if (e.paymentStatus !== "paid") continue; // غير المدفوع مش كاش خارج
    if (!isDateInRange(expenseCashDate(e), f)) continue;
    sums.set(e.currency, (sums.get(e.currency) ?? 0) + e.amountMinor);
  }
  return sums;
}

export function sumUnpaidExpensesByCurrency(expenses: FinanceExpense[], f: DateRangeInput): Map<string, number> {
  const sums = new Map<string, number>();
  for (const e of expenses) {
    if (e.voidedAt) continue;
    if (e.paymentStatus !== "unpaid") continue;
    if (!isDateInRange(e.date, f)) continue;
    sums.set(e.currency, (sums.get(e.currency) ?? 0) + e.amountMinor);
  }
  return sums;
}

export function monthlyCashFlow(transactions: FinanceTransaction[], expenses: FinanceExpense[], f: DateRangeInput): MonthlyCashRow[] {
  const rows = new Map<string, MonthlyCashRow>();
  const ensure = (month: string, currency: string): MonthlyCashRow => {
    const k = `${month}|${currency}`;
    let r = rows.get(k);
    if (!r) {
      r = { month, currency, inflowMinor: 0, outflowMinor: 0, netMinor: 0 };
      rows.set(k, r);
    }
    return r;
  };
  for (const tx of transactions) {
    if (tx.voidedAt) continue;
    if (!isDateInRange(tx.date, f)) continue;
    const signed = tx.type === "refund" ? -tx.amountMinor : tx.amountMinor;
    ensure(monthKeyOf(tx.date), tx.currency).inflowMinor += signed;
  }
  for (const e of expenses) {
    if (e.voidedAt || e.paymentStatus !== "paid") continue;
    const cashDate = expenseCashDate(e);
    if (!isDateInRange(cashDate, f)) continue;
    ensure(monthKeyOf(cashDate), e.currency).outflowMinor += e.amountMinor;
  }
  return [...rows.values()]
    .map((r) => ({ ...r, netMinor: r.inflowMinor - r.outflowMinor }))
    .sort((a, b) => (a.month === b.month ? a.currency.localeCompare(b.currency) : a.month < b.month ? -1 : 1));
}

export function expensesByCategoryTotals(expenses: FinanceExpense[], f: DateRangeInput, category?: string): CategoryTotal[] {
  const sums = new Map<string, number>();
  for (const e of expenses) {
    if (e.voidedAt) continue;
    if (!isDateInRange(e.date, f)) continue;
    if (category && category !== "all" && e.category.toLowerCase() !== category.toLowerCase()) continue;
    const k = `${e.category.toLowerCase()}|${e.currency}`;
    sums.set(k, (sums.get(k) ?? 0) + e.amountMinor);
  }
  return [...sums.entries()]
    .map(([k, minor]) => {
      const parts = k.split("|");
      return { category: parts[0] ?? "", currency: parts[1] ?? "", minor };
    })
    .sort((a, b) => (a.category === b.category ? a.currency.localeCompare(b.currency) : a.category.localeCompare(b.category)));
}

export function projectFinancialRows(
  projects: ScheduleProject[],
  obligations: FinanceObligation[],
  transactions: FinanceTransaction[],
  expenses: FinanceExpense[],
  profiles: ProjectFinanceProfile[]
): ProjectFinancialRow[] {
  const profileByProject = new Map(profiles.map((p) => [p.projectId, p] as const));
  const rows: ProjectFinancialRow[] = [];
  for (const p of projects) {
    const obligationsOfProject = obligations.filter((o) => o.projectId === p.id);
    const txOfProject = transactions.filter((t) => t.projectId === p.id);
    const expOfProject = expenses.filter((e) => e.projectId === p.id);

    const collectedMap = sumCollectedByCurrency(txOfProject, {});
    const outstandingMap = computeOutstandingByCurrency(obligationsOfProject, txOfProject);
    const paidMap = sumPaidExpensesByCurrency(expOfProject, {});
    const unpaidMap = sumUnpaidExpensesByCurrency(expOfProject, {});

    const contractedMap = new Map<string, number>();
    const profile = profileByProject.get(p.id);
    if (profile) {
      contractedMap.set(profile.currency, (contractedMap.get(profile.currency) ?? 0) + profile.contractValueMinor);
    } else {
      for (const o of obligationsOfProject) {
        if (o.cancelledAt) continue;
        contractedMap.set(o.currency, (contractedMap.get(o.currency) ?? 0) + o.amountMinor);
      }
    }

    const netMap = new Map<string, number>();
    for (const c of new Set([...collectedMap.keys(), ...paidMap.keys()])) {
      netMap.set(c, (collectedMap.get(c) ?? 0) - (paidMap.get(c) ?? 0));
    }

    const contracted = groupByCurrency(contractedMap);
    const collected = groupByCurrency(collectedMap);
    const outstanding = groupByCurrency(outstandingMap);
    const expensesPaid = groupByCurrency(paidMap);
    const expensesUnpaid = groupByCurrency(unpaidMap);
    const netCash = groupByCurrency(netMap);

    const hasAny =
      contracted.length > 0 || collected.length > 0 || outstanding.length > 0 || expensesPaid.length > 0 || expensesUnpaid.length > 0;
    if (!hasAny) continue;
    rows.push({ projectId: p.id, projectName: p.name, contracted, collected, outstanding, expensesPaid, expensesUnpaid, netCash });
  }
  return rows;
}

export interface FinancialSummaryInput {
  projects: ScheduleProject[];
  obligations: FinanceObligation[];
  transactions: FinanceTransaction[];
  expenses: FinanceExpense[];
  profiles: ProjectFinanceProfile[];
  today: string;
  filters: { projectId: string | "all"; dateFrom?: string; dateTo?: string; expenseCategory?: string };
}

export function buildFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const { obligations, transactions, expenses, profiles, today, filters } = input;
  const rangeFilters: DateRangeInput = { dateFrom: filters.dateFrom, dateTo: filters.dateTo };

  const projectIds = new Set(
    (filters.projectId === "all" ? input.projects : input.projects.filter((p) => p.id === filters.projectId)).map((p) => p.id)
  );
  const inScopeObligations = obligations.filter((o) => projectIds.has(o.projectId));
  const inScopeTransactions = transactions.filter((t) => projectIds.has(t.projectId));
  // المصروفات العامة (بدون مشروع) بتتحسب في العرض الكلي بس
  const inScopeExpenses =
    filters.projectId === "all"
      ? expenses.filter((e) => !e.voidedAt)
      : expenses.filter((e) => !e.voidedAt && e.projectId != null && projectIds.has(e.projectId));
  const inScopeProfiles = profiles.filter((p) => projectIds.has(p.projectId));

  const collectedMap = sumCollectedByCurrency(inScopeTransactions, rangeFilters);
  const paidMap = sumPaidExpensesByCurrency(inScopeExpenses, rangeFilters);
  const unpaidMap = sumUnpaidExpensesByCurrency(inScopeExpenses, rangeFilters);
  const outstandingMap = computeOutstandingByCurrency(inScopeObligations, inScopeTransactions);
  const overdueMap = computeOverdueReceivablesByCurrency(inScopeObligations, inScopeTransactions, today);
  const contracted = computeContracted(inScopeProfiles, inScopeObligations, projectIds);

  const netMap = new Map<string, number>();
  for (const c of new Set([...collectedMap.keys(), ...paidMap.keys()])) {
    netMap.set(c, (collectedMap.get(c) ?? 0) - (paidMap.get(c) ?? 0));
  }

  const scopedProjects = input.projects.filter((p) => projectIds.has(p.id));

  return {
    contracted: contracted.totals,
    contractedFallbackProjects: contracted.fallbackCount,
    collected: groupByCurrency(collectedMap),
    outstanding: groupByCurrency(outstandingMap),
    overdueReceivables: groupByCurrency(overdueMap),
    expensesPaid: groupByCurrency(paidMap),
    expensesUnpaid: groupByCurrency(unpaidMap),
    netCash: groupByCurrency(netMap),
    monthly: monthlyCashFlow(inScopeTransactions, inScopeExpenses, rangeFilters),
    expensesByCategory: expensesByCategoryTotals(inScopeExpenses, rangeFilters, filters.expenseCategory),
    projects: projectFinancialRows(scopedProjects, inScopeObligations, inScopeTransactions, inScopeExpenses, inScopeProfiles),
  };
}