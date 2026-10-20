/**
 * Milesto — centralized, typed finance calculation layer.
 *
 * Ground rules enforced here:
 *  - Cash basis vs. schedule view are kept strictly separate:
 *      collected      = real, non-voided transactions (payments − refunds)
 *      outstanding    = remaining balance of active obligations
 *      net cash flow  = collected cash − PAID expenses inside the period
 *    An obligation and its settling transactions are never both counted
 *    as income: obligations only build "invoiced", transactions build "collected".
 *  - Cancelled obligations and voided transactions/expenses are excluded
 *    from every authoritative figure (but stay in history for audit).
 *  - Amounts are grouped per currency and never summed across currencies.
 *  - No historical figures are invented anywhere: empty periods stay zero/empty.
 */

import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_STATUSES,
  PAYMENT_METHODS,
  type CollectionRateRow,
  type Currency,
  type CurrencyAmount,
  type CumulativeCashFlowRow,
  type DateRange,
  type ExpenseInput,
  type ExpenseUpdateInput,
  type FinanceDataset,
  type FinanceExpense,
  type FinanceFilters,
  type FinanceObligation,
  type FinanceTransaction,
  type MonthlyCashFlowRow,
  type ObligationInput,
  type ObligationStatus,
  type ObligationUpdateInput,
  type ProfileInput,
  type ProjectCurrencyValue,
  type ProjectFinanceProfile,
  type ProjectFinanceSummary,
  type ProjectProfitRow,
  type TransactionInput,
  type ValidationResult,
} from "@/types/finance";
import { MAX_MINOR, minorToMajorString } from "@/lib/money";

// ---------------------------------------------------------------------------
// Dates (string-based — no Date-object math needed for day precision)
// ---------------------------------------------------------------------------

/** Builds today's date in the user's timezone as "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Strict ISO calendar date check ("YYYY-MM-DD", real month/day, leap years). */
export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

/** "2026-03-15" → "2026-03" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** "2026-12" + 1 → "2027-01" */
export function addMonths(month: string, count: number): string {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const total = year * 12 + (monthNumber - 1) + count;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${String(newYear).padStart(4, "0")}-${String(newMonth).padStart(2, "0")}`;
}

/** Inclusive list of months between two "YYYY-MM" bounds. */
export function monthSpan(from: string, to: string): string[] {
  if (from > to) return [];
  const months: string[] = [];
  let current = from;
  let guard = 0;
  while (current <= to && guard < 1200) {
    months.push(current);
    current = addMonths(current, 1);
    guard += 1;
  }
  return months;
}

/** Inclusive date-range check. Missing bounds are open. */
export function isDateInRange(date: string, range?: DateRange | null): boolean {
  if (!range) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// IDs & guards
// ---------------------------------------------------------------------------

/** Next sequential id for a prefix, e.g. nextFinanceId("OB", ["OB-1","OB-7"]) → "OB-8". */
export function nextFinanceId(prefix: string, existingIds: string[]): string {
  let max = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of existingIds) {
    const match = pattern.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${max + 1}`;
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function isValidTransaction(tx: FinanceTransaction): boolean {
  return !tx.voidedAt;
}

export function isActiveObligation(obligation: FinanceObligation): boolean {
  return !obligation.cancelledAt;
}

// ---------------------------------------------------------------------------
// Amount grouping — the ONLY place where per-currency sums are built
// ---------------------------------------------------------------------------

/** Sums amounts per currency. Currencies with recorded activity stay listed
 *  even when the net is zero; currencies without records never appear. */
export function sumCurrencyAmounts(amounts: CurrencyAmount[]): CurrencyAmount[] {
  const totals = new Map<Currency, number>();
  for (const amount of amounts) {
    totals.set(amount.currency, (totals.get(amount.currency) ?? 0) + amount.minor);
  }
  return CURRENCIES.filter((c) => totals.has(c)).map((c) => ({
    currency: c,
    minor: totals.get(c) ?? 0,
  }));
}

/** minuend − subtrahend per currency (result may be negative — kept honest). */
function subtractAmounts(minuend: CurrencyAmount[], subtrahend: CurrencyAmount[]): CurrencyAmount[] {
  const totals = new Map<Currency, number>();
  for (const a of minuend) totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.minor);
  for (const a of subtrahend) totals.set(a.currency, (totals.get(a.currency) ?? 0) - a.minor);
  return CURRENCIES.filter((c) => totals.has(c)).map((c) => ({
    currency: c,
    minor: totals.get(c) ?? 0,
  }));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Per-obligation math (single source of truth for balances)
// ---------------------------------------------------------------------------

/** Net money received for one obligation: payments − refunds, voided excluded. */
export function getObligationPaidMinor(
  obligation: FinanceObligation,
  transactions: FinanceTransaction[],
): number {
  let net = 0;
  for (const tx of transactions) {
    if (tx.obligationId !== obligation.id || !isValidTransaction(tx)) continue;
    net += tx.type === "payment" ? tx.amountMinor : -tx.amountMinor;
  }
  return net;
}

/** Remaining balance, floored at 0 (over-collection never goes negative). */
export function getObligationRemainingMinor(
  obligation: FinanceObligation,
  transactions: FinanceTransaction[],
): number {
  return Math.max(0, obligation.amountMinor - getObligationPaidMinor(obligation, transactions));
}

/**
 * Derived effective status. Precedence:
 * cancelled → paid → overdue (past due with remaining) → due (due today)
 * → partially_paid (some money in, not late) → planned.
 * A partial payment that is also past due reports "overdue" — the more
 * actionable signal.
 */
export function getObligationStatus(
  obligation: FinanceObligation,
  transactions: FinanceTransaction[],
  today: string,
): ObligationStatus {
  if (obligation.cancelledAt) return "cancelled";
  const paid = getObligationPaidMinor(obligation, transactions);
  const remaining = Math.max(0, obligation.amountMinor - paid);
  if (remaining <= 0) return "paid";
  if (obligation.dueDate < today) return "overdue";
  if (obligation.dueDate === today) return "due";
  if (paid > 0) return "partially_paid";
  return "planned";
}

// ---------------------------------------------------------------------------
// Receivables (schedule view + cash view, grouped per currency)
// ---------------------------------------------------------------------------

/** Σ active (non-cancelled) obligations — the issued payment schedule. */
export function getInvoicedValue(
  obligations: FinanceObligation[],
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts = obligations
    .filter((o) => isActiveObligation(o) && (!filters.projectId || o.projectId === filters.projectId))
    .map((o) => ({ currency: o.currency, minor: o.amountMinor }));
  return sumCurrencyAmounts(amounts);
}

/**
 * Contract value. Uses the finance profile per project when one exists;
 * falls back to Σ active obligations for projects without a profile.
 * (The fallback is disclosed in the UI so nothing looks magic.)
 */
export function getContractedValue(
  profiles: ProjectFinanceProfile[],
  obligations: FinanceObligation[],
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const relevantObligations = obligations.filter(
    (o) => isActiveObligation(o) && (!filters.projectId || o.projectId === filters.projectId),
  );
  const projectIds = new Set<string>();
  for (const o of relevantObligations) projectIds.add(o.projectId);
  for (const p of profiles) {
    if (!filters.projectId || p.projectId === filters.projectId) projectIds.add(p.projectId);
  }

  const amounts: CurrencyAmount[] = [];
  for (const projectId of projectIds) {
    const profile = profiles.find((p) => p.projectId === projectId);
    if (profile) {
      amounts.push({ currency: profile.currency, minor: profile.contractValueMinor });
    } else {
      for (const o of relevantObligations) {
        if (o.projectId === projectId) amounts.push({ currency: o.currency, minor: o.amountMinor });
      }
    }
  }
  return sumCurrencyAmounts(amounts);
}

/** Real collected cash: non-voided payments − refunds. Cash basis. */
export function getCollected(
  transactions: FinanceTransaction[],
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts: CurrencyAmount[] = [];
  for (const tx of transactions) {
    if (!isValidTransaction(tx)) continue;
    if (filters.projectId && tx.projectId !== filters.projectId) continue;
    if (!isDateInRange(tx.date, filters.dateRange)) continue;
    amounts.push({
      currency: tx.currency,
      minor: tx.type === "payment" ? tx.amountMinor : -tx.amountMinor,
    });
  }
  return sumCurrencyAmounts(amounts);
}

/** Σ remaining balances of active obligations (all due dates). */
export function getOutstandingReceivables(
  obligations: FinanceObligation[],
  transactions: FinanceTransaction[],
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts: CurrencyAmount[] = [];
  for (const obligation of obligations) {
    if (!isActiveObligation(obligation)) continue;
    if (filters.projectId && obligation.projectId !== filters.projectId) continue;
    const remaining = getObligationRemainingMinor(obligation, transactions);
    if (remaining <= 0) continue;
    amounts.push({ currency: obligation.currency, minor: remaining });
  }
  return sumCurrencyAmounts(amounts);
}

/** Remaining on active obligations due before `today` (late money). */
export function getOverdueReceivables(
  obligations: FinanceObligation[],
  transactions: FinanceTransaction[],
  today: string,
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts: CurrencyAmount[] = [];
  for (const obligation of obligations) {
    if (!isActiveObligation(obligation)) continue;
    if (filters.projectId && obligation.projectId !== filters.projectId) continue;
    if (obligation.dueDate >= today) continue;
    const remaining = getObligationRemainingMinor(obligation, transactions);
    if (remaining <= 0) continue;
    amounts.push({ currency: obligation.currency, minor: remaining });
  }
  return sumCurrencyAmounts(amounts);
}

/** Remaining on active obligations due after `today` (future money). */
export function getScheduledFutureCollections(
  obligations: FinanceObligation[],
  transactions: FinanceTransaction[],
  today: string,
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts: CurrencyAmount[] = [];
  for (const obligation of obligations) {
    if (!isActiveObligation(obligation)) continue;
    if (filters.projectId && obligation.projectId !== filters.projectId) continue;
    if (obligation.dueDate <= today) continue;
    const remaining = getObligationRemainingMinor(obligation, transactions);
    if (remaining <= 0) continue;
    amounts.push({ currency: obligation.currency, minor: remaining });
  }
  return sumCurrencyAmounts(amounts);
}

/** Remaining on active obligations due inside `month` ("YYYY-MM"). */
export function getDueThisMonthReceivables(
  obligations: FinanceObligation[],
  transactions: FinanceTransaction[],
  month: string,
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts: CurrencyAmount[] = [];
  for (const obligation of obligations) {
    if (!isActiveObligation(obligation)) continue;
    if (filters.projectId && obligation.projectId !== filters.projectId) continue;
    if (monthOf(obligation.dueDate) !== month) continue;
    const remaining = getObligationRemainingMinor(obligation, transactions);
    if (remaining <= 0) continue;
    amounts.push({ currency: obligation.currency, minor: remaining });
  }
  return sumCurrencyAmounts(amounts);
}

/** Collection rate per currency: collected / invoiced × 100 (1 decimal). */
export function getCollectionRate(
  invoiced: CurrencyAmount[],
  collected: CurrencyAmount[],
): CollectionRateRow[] {
  const totals = new Map<Currency, { invoiced: number; collected: number }>();
  for (const a of invoiced) {
    const entry = totals.get(a.currency) ?? { invoiced: 0, collected: 0 };
    entry.invoiced += a.minor;
    totals.set(a.currency, entry);
  }
  for (const a of collected) {
    const entry = totals.get(a.currency) ?? { invoiced: 0, collected: 0 };
    entry.collected += a.minor;
    totals.set(a.currency, entry);
  }
  return CURRENCIES.filter((c) => totals.has(c)).map((c) => {
    const entry = totals.get(c);
    if (!entry || entry.invoiced <= 0) return { currency: c, percent: null };
    return { currency: c, percent: round1((entry.collected / entry.invoiced) * 100) };
  });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

/** Cash actually paid out. Date filter applies to the CASH-OUT date
 *  (paidOn, falling back to the expense date). Unpaid expenses never
 *  appear here — they are committed, not cash. */
export function getPaidExpenses(
  expenses: FinanceExpense[],
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts: CurrencyAmount[] = [];
  for (const expense of expenses) {
    if (expense.voidedAt || expense.paymentStatus !== "paid") continue;
    if (filters.projectId && expense.projectId !== filters.projectId) continue;
    if (!isDateInRange(expense.paidOn ?? expense.date, filters.dateRange)) continue;
    amounts.push({ currency: expense.currency, minor: expense.amountMinor });
  }
  return sumCurrencyAmounts(amounts);
}

/** Unpaid (committed) expenses — shown separately, never treated as cash. */
export function getOutstandingExpenses(
  expenses: FinanceExpense[],
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts: CurrencyAmount[] = [];
  for (const expense of expenses) {
    if (expense.voidedAt || expense.paymentStatus !== "unpaid") continue;
    if (filters.projectId && expense.projectId !== filters.projectId) continue;
    amounts.push({ currency: expense.currency, minor: expense.amountMinor });
  }
  return sumCurrencyAmounts(amounts);
}

/** All non-voided expenses (paid + unpaid) incurred in the date range. */
export function getIncurredExpenses(
  expenses: FinanceExpense[],
  filters: FinanceFilters = {},
): CurrencyAmount[] {
  const amounts: CurrencyAmount[] = [];
  for (const expense of expenses) {
    if (expense.voidedAt) continue;
    if (filters.projectId && expense.projectId !== filters.projectId) continue;
    if (!isDateInRange(expense.date, filters.dateRange)) continue;
    amounts.push({ currency: expense.currency, minor: expense.amountMinor });
  }
  return sumCurrencyAmounts(amounts);
}

// ---------------------------------------------------------------------------
// Time series (built ONLY from real records — empty periods stay zero)
// ---------------------------------------------------------------------------

function expenseCashOutDate(expense: FinanceExpense): string {
  return expense.paidOn ?? expense.date;
}

/** Monthly cash movement per currency, zero-filled across the period. */
export function getMonthlyCashFlow(
  dataset: FinanceDataset,
  filters: FinanceFilters = {},
): MonthlyCashFlowRow[] {
  const within = (date: string) => isDateInRange(date, filters.dateRange);
  const matchesProject = (projectId: string | null | undefined) =>
    !filters.projectId || projectId === filters.projectId;

  const txs = dataset.transactions.filter(
    (t) => isValidTransaction(t) && matchesProject(t.projectId) && within(t.date),
  );
  const exps = dataset.expenses.filter(
    (e) =>
      !e.voidedAt && e.paymentStatus === "paid" && matchesProject(e.projectId) && within(expenseCashOutDate(e)),
  );

  const collectedByMonth = new Map<string, number>(); // `${month}|${currency}`
  for (const tx of txs) {
    const key = `${monthOf(tx.date)}|${tx.currency}`;
    collectedByMonth.set(
      key,
      (collectedByMonth.get(key) ?? 0) + (tx.type === "payment" ? tx.amountMinor : -tx.amountMinor),
    );
  }
  const spentByMonth = new Map<string, number>();
  for (const expense of exps) {
    const key = `${monthOf(expenseCashOutDate(expense))}|${expense.currency}`;
    spentByMonth.set(key, (spentByMonth.get(key) ?? 0) + expense.amountMinor);
  }

  const currencies = new Set<Currency>();
  for (const tx of txs) currencies.add(tx.currency);
  for (const expense of exps) currencies.add(expense.currency);

  let months: string[];
  if (filters.dateRange?.from && filters.dateRange?.to) {
    months = monthSpan(monthOf(filters.dateRange.from), monthOf(filters.dateRange.to));
  } else {
    const dates = [...txs.map((t) => t.date), ...exps.map((e) => expenseCashOutDate(e))].sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    if (!first || !last || currencies.size === 0) return [];
    months = monthSpan(monthOf(first), monthOf(last));
  }

  const orderedCurrencies = CURRENCIES.filter((c) => currencies.has(c));
  const rows: MonthlyCashFlowRow[] = [];
  for (const month of months) {
    for (const currency of orderedCurrencies) {
      const key = `${month}|${currency}`;
      const collectedMinor = collectedByMonth.get(key) ?? 0;
      const paidExpenseMinor = spentByMonth.get(key) ?? 0;
      rows.push({ month, currency, collectedMinor, paidExpenseMinor, netMinor: collectedMinor - paidExpenseMinor });
    }
  }
  return rows;
}

/** Running net cash per month per currency (built from the monthly rows). */
export function getCumulativeNetCashFlow(
  dataset: FinanceDataset,
  filters: FinanceFilters = {},
): CumulativeCashFlowRow[] {
  const running = new Map<Currency, number>();
  return getMonthlyCashFlow(dataset, filters).map((row) => {
    const next = (running.get(row.currency) ?? 0) + row.netMinor;
    running.set(row.currency, next);
    return { month: row.month, currency: row.currency, cumulativeMinor: next };
  });
}

function projectCurrencyValues(map: Map<string, number>): ProjectCurrencyValue[] {
  const rows: ProjectCurrencyValue[] = [];
  for (const [key, minor] of map) {
    const separatorIndex = key.indexOf("|");
    const projectId = key.slice(0, separatorIndex);
    const currency = key.slice(separatorIndex + 1);
    if (!projectId || !isCurrency(currency)) continue;
    rows.push({ projectId, currency, minor });
  }
  return rows.sort(
    (a, b) => a.projectId.localeCompare(b.projectId) || a.currency.localeCompare(b.currency),
  );
}

/** Net collected per project per currency (payments − refunds). */
export function getCollectedByProject(
  dataset: FinanceDataset,
  filters: FinanceFilters = {},
): ProjectCurrencyValue[] {
  const totals = new Map<string, number>(); // `${projectId}|${currency}`
  for (const tx of dataset.transactions) {
    if (!isValidTransaction(tx)) continue;
    if (filters.projectId && tx.projectId !== filters.projectId) continue;
    if (!isDateInRange(tx.date, filters.dateRange)) continue;
    const key = `${tx.projectId}|${tx.currency}`;
    totals.set(key, (totals.get(key) ?? 0) + (tx.type === "payment" ? tx.amountMinor : -tx.amountMinor));
  }
  return projectCurrencyValues(totals);
}

/** Outstanding receivable per project per currency. */
export function getOutstandingByProject(
  dataset: FinanceDataset,
  filters: FinanceFilters = {},
): ProjectCurrencyValue[] {
  const totals = new Map<string, number>();
  for (const obligation of dataset.obligations) {
    if (!isActiveObligation(obligation)) continue;
    if (filters.projectId && obligation.projectId !== filters.projectId) continue;
    const remaining = getObligationRemainingMinor(obligation, dataset.transactions);
    if (remaining <= 0) continue;
    const key = `${obligation.projectId}|${obligation.currency}`;
    totals.set(key, (totals.get(key) ?? 0) + remaining);
  }
  return projectCurrencyValues(totals);
}

/**
 * Profit comparison per project per currency.
 * Definition (disclosed in the UI): profit = collected cash − paid expenses.
 * Cash basis on purpose — the same definition used for net cash flow.
 */
export function getProjectProfitComparison(
  dataset: FinanceDataset,
  filters: FinanceFilters = {},
): ProjectProfitRow[] {
  const within = (date: string) => isDateInRange(date, filters.dateRange);
  const collectedTotals = new Map<string, number>();
  for (const tx of dataset.transactions) {
    if (!isValidTransaction(tx)) continue;
    if (filters.projectId && tx.projectId !== filters.projectId) continue;
    if (!within(tx.date)) continue;
    const key = `${tx.projectId}|${tx.currency}`;
    collectedTotals.set(
      key,
      (collectedTotals.get(key) ?? 0) + (tx.type === "payment" ? tx.amountMinor : -tx.amountMinor),
    );
  }
  const paidTotals = new Map<string, number>();
  for (const expense of dataset.expenses) {
    if (expense.voidedAt || expense.paymentStatus !== "paid") continue;
    if (filters.projectId && expense.projectId !== filters.projectId) continue;
    if (!within(expenseCashOutDate(expense))) continue;
    const key = `${expense.projectId ?? ""}|${expense.currency}`;
    if (!expense.projectId) continue;
    paidTotals.set(key, (paidTotals.get(key) ?? 0) + expense.amountMinor);
  }

  const keys = new Set<string>([...collectedTotals.keys(), ...paidTotals.keys()]);
  const rows: ProjectProfitRow[] = [];
  for (const key of keys) {
    const separatorIndex = key.indexOf("|");
    const projectId = key.slice(0, separatorIndex);
    const currency = key.slice(separatorIndex + 1);
    if (!projectId || !isCurrency(currency)) continue;
    const collectedMinor = collectedTotals.get(key) ?? 0;
    const paidExpenseMinor = paidTotals.get(key) ?? 0;
    rows.push({ projectId, currency, collectedMinor, paidExpenseMinor, profitMinor: collectedMinor - paidExpenseMinor });
  }
  return rows.sort(
    (a, b) => a.projectId.localeCompare(b.projectId) || a.currency.localeCompare(b.currency),
  );
}

// ---------------------------------------------------------------------------
// Per-project summary
// ---------------------------------------------------------------------------

export function getProjectFinanceSummary(
  projectId: string,
  dataset: FinanceDataset,
  profiles: ProjectFinanceProfile[],
  today: string,
): ProjectFinanceSummary {
  const filters: FinanceFilters = { projectId };
  const invoiced = getInvoicedValue(dataset.obligations, filters);
  const contractedValue = getContractedValue(profiles, dataset.obligations, filters);
  const collected = getCollected(dataset.transactions, filters);
  const outstanding = getOutstandingReceivables(dataset.obligations, dataset.transactions, filters);
  const overdue = getOverdueReceivables(dataset.obligations, dataset.transactions, today, filters);
  const scheduledFuture = getScheduledFutureCollections(
    dataset.obligations,
    dataset.transactions,
    today,
    filters,
  );
  const dueThisMonth = getDueThisMonthReceivables(
    dataset.obligations,
    dataset.transactions,
    monthOf(today),
    filters,
  );
  const paidExpenses = getPaidExpenses(dataset.expenses, filters);
  const outstandingExpenses = getOutstandingExpenses(dataset.expenses, filters);
  const netCash = subtractAmounts(collected, paidExpenses);

  const margins = collected.map((amount) => {
    const net = netCash.find((n) => n.currency === amount.currency);
    const netMinor = net ? net.minor : 0;
    return {
      currency: amount.currency,
      percent: amount.minor > 0 ? round1((netMinor / amount.minor) * 100) : null,
    };
  });

  return {
    projectId,
    hasProfile: profiles.some((p) => p.projectId === projectId),
    contractedValue,
    invoiced,
    collected,
    outstanding,
    overdue,
    scheduledFuture,
    dueThisMonth,
    paidExpenses,
    outstandingExpenses,
    netCash,
    margins,
  };
}

// ---------------------------------------------------------------------------
// Validation (pure — shared by the provider and the forms)
// ---------------------------------------------------------------------------

function ok(): ValidationResult {
  return { ok: true };
}

function err(error: string): ValidationResult {
  return { ok: false, error };
}

function firstError(results: (string | null)[]): ValidationResult {
  for (const result of results) {
    if (result) return err(result);
  }
  return ok();
}

function checkRequiredText(value: string | undefined, field: string, max: number): string | null {
  if (value === undefined || value === null || value.trim().length === 0) {
    return `${field} is required`;
  }
  if (value.length > max) return `${field} must be at most ${max} characters`;
  return null;
}

function checkOptionalText(value: string | undefined, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (value.length > max) return `${field} must be at most ${max} characters`;
  return null;
}

function checkAmount(amountMinor: unknown): string | null {
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor)) {
    return "Amount must be a whole number of minor units";
  }
  if (amountMinor <= 0) return "Amount must be greater than zero";
  if (amountMinor > MAX_MINOR) return "Amount exceeds the supported maximum";
  return null;
}

function checkDate(value: unknown, field: string): string | null {
  if (!isISODate(value)) return `${field} must be a valid date (YYYY-MM-DD)`;
  return null;
}

function checkCurrency(currency: unknown): string | null {
  if (!isCurrency(currency)) return "Unsupported currency";
  return null;
}

/** Removes explicitly-undefined keys so a patch never wipes stored values. */
export function compactPatch<T extends object>(patch: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

export function validateObligationInput(input: ObligationInput): ValidationResult {
  return firstError([
    checkRequiredText(input.projectId, "Project", 40),
    checkRequiredText(input.title, "Title", 120),
    checkOptionalText(input.description, "Description", 1000),
    checkAmount(input.amountMinor),
    checkCurrency(input.currency),
    checkDate(input.dueDate, "Due date"),
    checkOptionalText(input.reference, "Reference", 120),
    checkOptionalText(input.notes, "Notes", 2000),
  ]);
}

export function validateObligationUpdate(
  patch: ObligationUpdateInput,
  obligation: FinanceObligation,
  transactions: FinanceTransaction[],
): ValidationResult {
  if (obligation.cancelledAt) return err("Cancelled obligations are read-only");
  if (patch.amountMinor !== undefined) {
    const amountError = checkAmount(patch.amountMinor);
    if (amountError) return err(amountError);
    if (patch.amountMinor !== obligation.amountMinor) {
      const paid = getObligationPaidMinor(obligation, transactions);
      if (patch.amountMinor < paid) {
        return err(
          `Amount cannot be less than the net amount already collected (${minorToMajorString(
            paid,
            obligation.currency,
          )} ${obligation.currency})`,
        );
      }
    }
  }
  return firstError([
    patch.title !== undefined ? checkRequiredText(patch.title, "Title", 120) : null,
    patch.description !== undefined ? checkOptionalText(patch.description, "Description", 1000) : null,
    patch.dueDate !== undefined ? checkDate(patch.dueDate, "Due date") : null,
    patch.reference !== undefined ? checkOptionalText(patch.reference, "Reference", 120) : null,
    patch.notes !== undefined ? checkOptionalText(patch.notes, "Notes", 2000) : null,
  ]);
}

export function validateTransactionInput(
  input: TransactionInput,
  obligation: FinanceObligation | null,
  transactions: FinanceTransaction[],
): ValidationResult {
  if (!obligation) return err("Obligation not found");
  if (obligation.cancelledAt) return err("Cannot record a transaction against a cancelled obligation");
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) {
    return err("Unsupported payment method");
  }
  const baseError = checkAmount(input.amountMinor) ?? checkDate(input.date, "Date");
  if (baseError) return err(baseError);

  if (input.type === "payment") {
    const remaining = getObligationRemainingMinor(obligation, transactions);
    if (input.amountMinor > remaining) {
      return err(
        `Amount exceeds the remaining balance of ${obligation.id} (${minorToMajorString(
          remaining,
          obligation.currency,
        )} ${obligation.currency})`,
      );
    }
  } else {
    const netPaid = getObligationPaidMinor(obligation, transactions);
    if (input.amountMinor > netPaid) {
      return err(`Refund exceeds the net amount received for ${obligation.id}`);
    }
  }
  return firstError([
    checkOptionalText(input.reference, "Reference", 120),
    checkOptionalText(input.notes, "Notes", 2000),
  ]);
}

export function validateExpenseInput(input: ExpenseInput): ValidationResult {
  const baseError =
    checkRequiredText(input.description, "Description", 200) ??
    checkAmount(input.amountMinor) ??
    checkCurrency(input.currency) ??
    checkDate(input.date, "Date");
  if (baseError) return err(baseError);
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) {
    return err("Unsupported expense category");
  }
  if (!(EXPENSE_PAYMENT_STATUSES as readonly string[]).includes(input.paymentStatus)) {
    return err("Unsupported payment status");
  }
  if (input.paidOn) {
    const paidOnError = checkDate(input.paidOn, "Paid on");
    if (paidOnError) return err(paidOnError);
  }
  return firstError([
    input.projectId ? checkRequiredText(input.projectId, "Project", 40) : null,
    checkOptionalText(input.vendor, "Vendor", 120),
    checkOptionalText(input.receiptRef, "Receipt reference", 120),
    checkOptionalText(input.notes, "Notes", 2000),
  ]);
}

export function validateExpenseUpdate(
  patch: ExpenseUpdateInput,
  expense: FinanceExpense,
): ValidationResult {
  if (expense.voidedAt) return err("Voided expenses are read-only");
  if (patch.paymentStatus && !(EXPENSE_PAYMENT_STATUSES as readonly string[]).includes(patch.paymentStatus)) {
    return err("Unsupported payment status");
  }
  if (patch.category && !(EXPENSE_CATEGORIES as readonly string[]).includes(patch.category)) {
    return err("Unsupported expense category");
  }
  if (patch.paidOn) {
    const paidOnError = checkDate(patch.paidOn, "Paid on");
    if (paidOnError) return err(paidOnError);
  }
  return firstError([
    patch.description !== undefined ? checkRequiredText(patch.description, "Description", 200) : null,
    patch.amountMinor !== undefined ? checkAmount(patch.amountMinor) : null,
    patch.date !== undefined ? checkDate(patch.date, "Date") : null,
    patch.vendor !== undefined ? checkOptionalText(patch.vendor, "Vendor", 120) : null,
    patch.receiptRef !== undefined ? checkOptionalText(patch.receiptRef, "Receipt reference", 120) : null,
    patch.notes !== undefined ? checkOptionalText(patch.notes, "Notes", 2000) : null,
  ]);
}

export function validateProfileInput(input: ProfileInput): ValidationResult {
  const baseError =
    checkRequiredText(input.projectId, "Project", 40) ??
    checkAmount(input.contractValueMinor) ??
    checkCurrency(input.currency) ??
    checkDate(input.contractDate, "Contract date");
  if (baseError) return err(baseError);
  if (input.expectedDeliveryDate) {
    const deliveryError = checkDate(input.expectedDeliveryDate, "Expected delivery date");
    if (deliveryError) return err(deliveryError);
  }
  return firstError([
    checkOptionalText(input.paymentTerms, "Payment terms", 500),
    checkOptionalText(input.agreementNotes, "Agreement notes", 2000),
  ]);
}