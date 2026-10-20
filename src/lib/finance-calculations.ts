import type {
  CurrencyAmount,
  FinanceDataset,
  FinanceExpense,
  FinanceObligation,
  FinanceTransaction,
  ProjectFinanceProfile,
} from "@/types/finance";

// ---------------------------------------------------------------------------
// Derived value types (indexed-access keeps us decoupled from union names)
// ---------------------------------------------------------------------------

export type Currency = CurrencyAmount["currency"];
export type TransactionTypeValue = FinanceTransaction["type"];
export type TransactionMethodValue = FinanceTransaction["method"];
export type ExpenseCategoryValue = FinanceExpense["category"];
export type ExpensePaymentStatusValue = FinanceExpense["paymentStatus"];

export type ObligationStatusValue =
  | "cancelled"
  | "paid"
  | "overdue"
  | "due"
  | "partially_paid"
  | "planned";

export type ContractedValueSource = "profiles" | "obligations" | "mixed" | "none";

export const MAX_MONEY_MINOR = 99_999_999_999;

export const CURRENCY_CHOICES: readonly Currency[] = [
  "EGP",
  "USD",
  "EUR",
  "GBP",
  "SAR",
  "AED",
] as readonly Currency[];

export const METHOD_CHOICES: readonly TransactionMethodValue[] = [
  "cash",
  "bank_transfer",
  "card",
  "cheque",
  "other",
] as readonly TransactionMethodValue[];

export const EXPENSE_CATEGORY_CHOICES: readonly ExpenseCategoryValue[] = [
  "hosting",
  "domain",
  "software",
  "contractor",
  "marketing",
  "infrastructure",
  "other",
] as readonly ExpenseCategoryValue[];

export const PAYMENT_STATUS_CHOICES: readonly ExpensePaymentStatusValue[] = [
  "unpaid",
  "paid",
] as readonly ExpensePaymentStatusValue[];

export const TRANSACTION_TYPE_CHOICES: readonly TransactionTypeValue[] = [
  "payment",
  "refund",
] as readonly TransactionTypeValue[];

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface FinanceCalcFilters {
  projectId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}

export interface FinanceWorkspace {
  obligations: FinanceObligation[];
  transactions: FinanceTransaction[];
  expenses: FinanceExpense[];
  profiles: ProjectFinanceProfile[];
}

export interface CurrencyTotals {
  currency: Currency;
  minor: number;
}

export interface CollectionRateRow {
  currency: Currency;
  percent: number | null;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export interface ObligationInput {
  projectId: string;
  title: string;
  description?: string;
  amountMinor: number;
  currency: Currency;
  dueDate: string;
  reference?: string;
  notes?: string;
}

export interface TransactionInput {
  obligationId: string;
  type: TransactionTypeValue;
  amountMinor: number;
  currency: Currency;
  date: string;
  method: TransactionMethodValue;
  reference?: string;
  notes?: string;
}

export interface ExpenseInput {
  description: string;
  amountMinor: number;
  currency: Currency;
  date: string;
  category: ExpenseCategoryValue;
  projectId: string | null;
  vendor?: string;
  paymentStatus: ExpensePaymentStatusValue;
  paidOn?: string;
  receiptRef?: string;
  notes?: string;
}

export interface ProfileInput {
  projectId: string;
  contractValueMinor: number;
  currency: Currency;
  contractDate: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  agreementNotes?: string;
}

export interface MonthlyCashPoint {
  month: string;
  currency: Currency;
  collectedMinor: number;
  paidExpenseMinor: number;
  netMinor: number;
}

export interface CumulativeCashPoint {
  month: string;
  currency: Currency;
  collectedMinor: number;
  paidExpenseMinor: number;
  netMinor: number;
  cumulativeNetMinor: number;
}

export interface ProjectFinanceRow {
  projectId: string;
  currency: Currency;
  contractedMinor: number;
  contractedSource: "profile" | "obligations";
  invoicedMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
  expensesPaidMinor: number;
  expensesUnpaidMinor: number;
  netCashMinor: number;
  overdueMinor: number;
  dueThisMonthMinor: number;
}

export interface FinanceKpis {
  contractedValue: { totals: CurrencyTotals[]; source: ContractedValueSource };
  collected: CurrencyTotals[];
  invoiced: CurrencyTotals[];
  outstanding: CurrencyTotals[];
  expensesPaid: CurrencyTotals[];
  expensesUnpaid: CurrencyTotals[];
  netCash: CurrencyTotals[];
  overdue: CurrencyTotals[];
  dueThisMonth: CurrencyTotals[];
  collectionRate: CollectionRateRow[];
}

// ---------------------------------------------------------------------------
// Money helpers (exact integer minor units — never floating point math)
// ---------------------------------------------------------------------------

export function parseAmountToMinor(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN;
  const [unitPart, fracPart = ""] = trimmed.split(".");
  const frac = (fracPart + "00").slice(0, 2);
  const minor = Number(unitPart) * 100 + Number(frac);
  if (!Number.isSafeInteger(minor) || minor > MAX_MONEY_MINOR) return Number.NaN;
  return minor;
}

export function minorToDecimalString(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function formatMinorAmount(minor: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function formatPercent(percent: number | null): string {
  return percent === null ? "—" : `${percent.toFixed(1)}%`;
}

export function formatDate(iso?: string | null): string {
  return iso ? iso : "—";
}

// ---------------------------------------------------------------------------
// Date helpers (plain "YYYY-MM-DD" strings, lexicographic compare is safe)
// ---------------------------------------------------------------------------

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d >= 1 && d <= daysInMonth;
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (((total % 12) + 12) % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function monthSpan(fromMonth: string, toMonth: string): string[] {
  if (fromMonth > toMonth) return [];
  const out: string[] = [];
  let cursor = fromMonth;
  while (cursor <= toMonth) {
    out.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregation primitives
// ---------------------------------------------------------------------------

export function sumCurrencyAmounts(amounts: readonly CurrencyAmount[]): CurrencyAmount[] {
  const map = new Map<Currency, number>();
  for (const amount of amounts) {
    map.set(amount.currency, (map.get(amount.currency) ?? 0) + amount.minor);
  }
  return [...map.entries()]
    .map(([currency, minor]) => ({ currency, minor }))
    .sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));
}

export function collectCurrencies(
  ...groups: readonly (readonly CurrencyTotals[])[]
): Currency[] {
  const set = new Set<Currency>();
  for (const group of groups) for (const totals of group) set.add(totals.currency);
  return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function toWorkspace(
  dataset: FinanceDataset,
  profiles: ProjectFinanceProfile[],
): FinanceWorkspace {
  return {
    obligations: dataset.obligations,
    transactions: dataset.transactions,
    expenses: dataset.expenses,
    profiles,
  };
}

export function isActive(obligation: FinanceObligation): boolean {
  return !obligation.cancelledAt;
}

export function isValidTransaction(transaction: FinanceTransaction): boolean {
  return !transaction.voidedAt;
}

function matchProject(id: string | null | undefined, filters: FinanceCalcFilters): boolean {
  if (!filters.projectId) return true;
  return id === filters.projectId;
}

function inDateRange(iso: string, filters: FinanceCalcFilters): boolean {
  if (filters.fromDate && iso < filters.fromDate) return false;
  if (filters.toDate && iso > filters.toDate) return false;
  return true;
}

export function filterObligations(
  obligations: readonly FinanceObligation[],
  filters: FinanceCalcFilters,
): FinanceObligation[] {
  return obligations.filter(
    (o) => matchProject(o.projectId, filters) && inDateRange(o.dueDate, filters),
  );
}

export function filterTransactions(
  transactions: readonly FinanceTransaction[],
  filters: FinanceCalcFilters,
): FinanceTransaction[] {
  return transactions.filter(
    (t) => matchProject(t.projectId, filters) && inDateRange(t.date, filters),
  );
}

export function filterExpenses(
  expenses: readonly FinanceExpense[],
  filters: FinanceCalcFilters,
): FinanceExpense[] {
  return expenses.filter(
    (e) => matchProject(e.projectId ?? null, filters) && inDateRange(e.date, filters),
  );
}

// ---------------------------------------------------------------------------
// Obligation-level derived values
// ---------------------------------------------------------------------------

export function validTransactionsFor(
  obligationId: string,
  transactions: readonly FinanceTransaction[],
): FinanceTransaction[] {
  return transactions.filter((t) => t.obligationId === obligationId && isValidTransaction(t));
}

export function netPaidOf(
  obligation: FinanceObligation,
  transactions: readonly FinanceTransaction[],
): number {
  return validTransactionsFor(obligation.id, transactions).reduce(
    (sum, t) => sum + (t.type === "payment" ? t.amountMinor : -t.amountMinor),
    0,
  );
}

export function remainingOf(
  obligation: FinanceObligation,
  transactions: readonly FinanceTransaction[],
): number {
  return Math.max(0, obligation.amountMinor - netPaidOf(obligation, transactions));
}

/**
 * Status is always derived, never stored.
 * Precedence: cancelled → paid → overdue (< today) → due (= today) → partially_paid → planned.
 */
export function getObligationStatus(
  obligation: FinanceObligation,
  transactions: readonly FinanceTransaction[],
  today: string,
): ObligationStatusValue {
  if (obligation.cancelledAt) return "cancelled";
  const paid = netPaidOf(obligation, transactions);
  if (obligation.amountMinor > 0 && paid >= obligation.amountMinor) return "paid";
  if (obligation.dueDate < today) return "overdue";
  if (obligation.dueDate === today) return "due";
  if (paid > 0) return "partially_paid";
  return "planned";
}

// ---------------------------------------------------------------------------
// KPI aggregates — every figure comes from real stored records only
// ---------------------------------------------------------------------------

export function getCollectedTotals(
  transactions: readonly FinanceTransaction[],
  filters: FinanceCalcFilters,
): CurrencyTotals[] {
  return sumCurrencyAmounts(
    filterTransactions(transactions, filters)
      .filter(isValidTransaction)
      .map((t) => ({
        currency: t.currency,
        minor: t.type === "payment" ? t.amountMinor : -t.amountMinor,
      })),
  );
}

export function getInvoicedTotals(
  obligations: readonly FinanceObligation[],
  filters: FinanceCalcFilters,
): CurrencyTotals[] {
  return sumCurrencyAmounts(
    filterObligations(obligations, filters)
      .filter(isActive)
      .map((o) => ({ currency: o.currency, minor: o.amountMinor })),
  );
}

export function getOutstandingTotals(
  obligations: readonly FinanceObligation[],
  transactions: readonly FinanceTransaction[],
  filters: FinanceCalcFilters,
): CurrencyTotals[] {
  const scoped = filterTransactions(transactions, filters);
  return sumCurrencyAmounts(
    filterObligations(obligations, filters)
      .filter(isActive)
      .map((o) => ({ currency: o.currency, minor: remainingOf(o, scoped) })),
  );
}

export function getOverdueTotals(
  obligations: readonly FinanceObligation[],
  transactions: readonly FinanceTransaction[],
  filters: FinanceCalcFilters,
  today: string,
): CurrencyTotals[] {
  const scoped = filterTransactions(transactions, filters);
  return sumCurrencyAmounts(
    filterObligations(obligations, filters)
      .filter((o) => isActive(o) && o.dueDate < today)
      .map((o) => ({ currency: o.currency, minor: remainingOf(o, scoped) })),
  );
}

export function getDueThisMonthTotals(
  obligations: readonly FinanceObligation[],
  transactions: readonly FinanceTransaction[],
  filters: FinanceCalcFilters,
  today: string,
): CurrencyTotals[] {
  const scoped = filterTransactions(transactions, filters);
  const currentMonth = monthOf(today);
  return sumCurrencyAmounts(
    filterObligations(obligations, filters)
      .filter(
        (o) =>
          isActive(o) && o.dueDate >= today && monthOf(o.dueDate) === currentMonth,
      )
      .map((o) => ({ currency: o.currency, minor: remainingOf(o, scoped) })),
  );
}

function matchExpenseProject(e: FinanceExpense, filters: FinanceCalcFilters): boolean {
  return matchProject(e.projectId ?? null, filters);
}

export function getPaidExpenseTotals(
  expenses: readonly FinanceExpense[],
  filters: FinanceCalcFilters,
): CurrencyTotals[] {
  return sumCurrencyAmounts(
    expenses
      .filter(
        (e) =>
          !e.voidedAt &&
          e.paymentStatus === "paid" &&
          matchExpenseProject(e, filters) &&
          inDateRange(e.paidOn ?? e.date, filters),
      )
      .map((e) => ({ currency: e.currency, minor: e.amountMinor })),
  );
}

export function getUnpaidExpenseTotals(
  expenses: readonly FinanceExpense[],
  filters: FinanceCalcFilters,
): CurrencyTotals[] {
  return sumCurrencyAmounts(
    expenses
      .filter(
        (e) =>
          !e.voidedAt &&
          e.paymentStatus === "unpaid" &&
          matchExpenseProject(e, filters) &&
          inDateRange(e.date, filters),
      )
      .map((e) => ({ currency: e.currency, minor: e.amountMinor })),
  );
}

export function getNetCashTotals(
  transactions: readonly FinanceTransaction[],
  expenses: readonly FinanceExpense[],
  filters: FinanceCalcFilters,
): CurrencyTotals[] {
  const collected = getCollectedTotals(transactions, filters);
  const paid = getPaidExpenseTotals(expenses, filters);
  const currencies = collectCurrencies(collected, paid);
  return currencies.map((currency) => ({
    currency,
    minor:
      (collected.find((c) => c.currency === currency)?.minor ?? 0) -
      (paid.find((c) => c.currency === currency)?.minor ?? 0),
  }));
}

export function getContractedValue(
  source: Pick<FinanceWorkspace, "obligations" | "profiles">,
  filters: FinanceCalcFilters,
): { totals: CurrencyTotals[]; source: ContractedValueSource } {
  const projectIds = new Set<string>();
  for (const o of filterObligations(source.obligations, filters)) projectIds.add(o.projectId);
  for (const p of source.profiles) {
    if (!filters.projectId || p.projectId === filters.projectId) projectIds.add(p.projectId);
  }
  if (projectIds.size === 0) return { totals: [], source: "none" };

  let profileCount = 0;
  const totals: CurrencyTotals[] = [];
  const push = (currency: Currency, minor: number) => {
    const found = totals.find((t) => t.currency === currency);
    if (found) found.minor += minor;
    else totals.push({ currency, minor });
  };

  for (const projectId of projectIds) {
    const projectFilter: FinanceCalcFilters = { ...filters, projectId };
    const profile = source.profiles.find((p) => p.projectId === projectId);
    if (profile) {
      profileCount += 1;
      push(profile.currency, profile.contractValueMinor);
      continue;
    }
    for (const o of filterObligations(source.obligations, projectFilter)) {
      if (isActive(o)) push(o.currency, o.amountMinor);
    }
  }

  const resolved: ContractedValueSource =
    profileCount === 0
      ? "obligations"
      : profileCount === projectIds.size
        ? "profiles"
        : "mixed";

  totals.sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));
  return { totals, source: resolved };
}

export function getCollectionRate(
  collected: readonly CurrencyTotals[],
  invoiced: readonly CurrencyTotals[],
): CollectionRateRow[] {
  const currencies = collectCurrencies(collected, invoiced);
  return currencies.map((currency) => {
    const inv = invoiced.find((c) => c.currency === currency)?.minor ?? 0;
    const col = collected.find((c) => c.currency === currency)?.minor ?? 0;
    return { currency, percent: inv > 0 ? (col / inv) * 100 : null };
  });
}

export function computeFinanceKpis(
  workspace: FinanceWorkspace,
  filters: FinanceCalcFilters,
  today: string,
): FinanceKpis {
  const collected = getCollectedTotals(workspace.transactions, filters);
  const invoiced = getInvoicedTotals(workspace.obligations, filters);
  return {
    contractedValue: getContractedValue(workspace, filters),
    collected,
    invoiced,
    outstanding: getOutstandingTotals(workspace.obligations, workspace.transactions, filters),
    expensesPaid: getPaidExpenseTotals(workspace.expenses, filters),
    expensesUnpaid: getUnpaidExpenseTotals(workspace.expenses, filters),
    netCash: getNetCashTotals(workspace.transactions, workspace.expenses, filters),
    overdue: getOverdueTotals(workspace.obligations, workspace.transactions, filters, today),
    dueThisMonth: getDueThisMonthTotals(
      workspace.obligations,
      workspace.transactions,
      filters,
      today,
    ),
    collectionRate: getCollectionRate(collected, invoiced),
  };
}

// ---------------------------------------------------------------------------
// Series + per-project rows
// ---------------------------------------------------------------------------

export function buildMonthlyCashFlow(
  workspace: FinanceWorkspace,
  filters: FinanceCalcFilters,
  options?: { fromMonth?: string; toMonth?: string },
): MonthlyCashPoint[] {
  const transactions = filterTransactions(workspace.transactions, filters).filter(
    isValidTransaction,
  );
  const paidExpenses = workspace.expenses.filter(
    (e) =>
      !e.voidedAt &&
      e.paymentStatus === "paid" &&
      matchExpenseProject(e, filters) &&
      inDateRange(e.paidOn ?? e.date, filters),
  );

  const months = new Set<string>();
  if (options?.fromMonth && options?.toMonth) {
    for (const month of monthSpan(options.fromMonth, options.toMonth)) months.add(month);
  } else {
    for (const t of transactions) months.add(monthOf(t.date));
    for (const e of paidExpenses) months.add(monthOf(e.paidOn ?? e.date));
  }

  const currencies = new Set<Currency>();
  for (const t of transactions) currencies.add(t.currency);
  for (const e of paidExpenses) currencies.add(e.currency);

  const rows: MonthlyCashPoint[] = [];
  for (const month of [...months].sort(compareISO)) {
    for (const currency of currencies) {
      const collectedMinor = transactions
        .filter((t) => monthOf(t.date) === month && t.currency === currency)
        .reduce((sum, t) => sum + (t.type === "payment" ? t.amountMinor : -t.amountMinor), 0);
      const paidExpenseMinor = paidExpenses
        .filter((e) => monthOf(e.paidOn ?? e.date) === month && e.currency === currency)
        .reduce((sum, e) => sum + e.amountMinor, 0);
      if (collectedMinor === 0 && paidExpenseMinor === 0) continue;
      rows.push({ month, currency, collectedMinor, paidExpenseMinor, netMinor: collectedMinor - paidExpenseMinor });
    }
  }
  return rows;
}

export function buildCumulativeCashFlow(
  points: readonly MonthlyCashPoint[],
): CumulativeCashPoint[] {
  const running = new Map<Currency, number>();
  return points.map((point) => {
    const prev = running.get(point.currency) ?? 0;
    const cumulativeNetMinor = prev + point.netMinor;
    running.set(point.currency, cumulativeNetMinor);
    return { ...point, cumulativeNetMinor };
  });
}

export function buildProjectFinanceRows(
  workspace: FinanceWorkspace,
  filters: FinanceCalcFilters,
  today: string,
): ProjectFinanceRow[] {
  const projectIds = new Set<string>();
  for (const o of filterObligations(workspace.obligations, filters)) projectIds.add(o.projectId);
  for (const p of workspace.profiles) {
    if (!filters.projectId || p.projectId === filters.projectId) projectIds.add(p.projectId);
  }
  for (const e of filterExpenses(workspace.expenses, filters)) {
    if (e.projectId) projectIds.add(e.projectId);
  }
  for (const t of filterTransactions(workspace.transactions, filters)) projectIds.add(t.projectId);

  const rows: ProjectFinanceRow[] = [];
  const sortedIds = [...projectIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const projectId of sortedIds) {
    const projectFilter: FinanceCalcFilters = { ...filters, projectId };
    const obligations = filterObligations(workspace.obligations, projectFilter);
    const transactions = filterTransactions(workspace.transactions, projectFilter);
    const expenses = filterExpenses(workspace.expenses, projectFilter);
    const profile = workspace.profiles.find((p) => p.projectId === projectId);

    const currencies = new Set<Currency>();
    for (const o of obligations) currencies.add(o.currency);
    for (const t of transactions) currencies.add(t.currency);
    for (const e of expenses) currencies.add(e.currency);
    if (profile) currencies.add(profile.currency);

    for (const currency of currencies) {
      const active = obligations.filter((o) => isActive(o) && o.currency === currency);
      const scopedValidTx = transactions.filter((t) => isValidTransaction(t) && t.currency === currency);
      const collectedMinor = scopedValidTx.reduce(
        (sum, t) => sum + (t.type === "payment" ? t.amountMinor : -t.amountMinor),
        0,
      );
      const invoicedMinor = active.reduce((sum, o) => sum + o.amountMinor, 0);
      const outstandingMinor = active.reduce((sum, o) => sum + remainingOf(o, transactions), 0);
      const expensesPaidMinor = expenses
        .filter((e) => !e.voidedAt && e.paymentStatus === "paid" && e.currency === currency)
        .reduce((sum, e) => sum + e.amountMinor, 0);
      const expensesUnpaidMinor = expenses
        .filter((e) => !e.voidedAt && e.paymentStatus === "unpaid" && e.currency === currency)
        .reduce((sum, e) => sum + e.amountMinor, 0);
      const overdueMinor = active
        .filter((o) => o.dueDate < today)
        .reduce((sum, o) => sum + remainingOf(o, transactions), 0);
      const dueThisMonthMinor = active
        .filter((o) => o.dueDate >= today && monthOf(o.dueDate) === monthOf(today))
        .reduce((sum, o) => sum + remainingOf(o, transactions), 0);

      rows.push({
        projectId,
        currency,
        contractedMinor: profile && profile.currency === currency ? profile.contractValueMinor : 0,
        contractedSource: profile ? "profile" : "obligations",
        invoicedMinor,
        collectedMinor,
        outstandingMinor,
        expensesPaidMinor,
        expensesUnpaidMinor,
        netCashMinor: collectedMinor - expensesPaidMinor,
        overdueMinor,
        dueThisMonthMinor,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Validation (pure — shared by provider and forms)
// ---------------------------------------------------------------------------

function checkAmount(amountMinor: number | undefined): string | null {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) {
    return "Amount is required.";
  }
  if (!Number.isInteger(amountMinor)) {
    return "Amount must be a whole number of minor units.";
  }
  if (amountMinor <= 0) return "Amount must be greater than zero.";
  if (amountMinor > MAX_MONEY_MINOR) return "Amount exceeds the supported maximum.";
  return null;
}

function checkISO(value: string | undefined, label: string): string | null {
  if (!value || !isISODate(value)) return `${label} must be a valid date (YYYY-MM-DD).`;
  return null;
}

export function validateObligationInput(input: ObligationInput): ValidationResult {
  if (!input.projectId.trim()) return { ok: false, error: "Project is required." };
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  const amountError = checkAmount(input.amountMinor);
  if (amountError) return { ok: false, error: amountError };
  if (!input.currency) return { ok: false, error: "Currency is required." };
  const dateError = checkISO(input.dueDate, "Due date");
  if (dateError) return { ok: false, error: dateError };
  return { ok: true };
}

export function validateTransactionInput(
  obligation: FinanceObligation,
  input: TransactionInput,
): ValidationResult {
  if (!input.obligationId) return { ok: false, error: "Obligation is required." };
  if (input.type !== "payment" && input.type !== "refund") {
    return { ok: false, error: "Transaction type must be payment or refund." };
  }
  const amountError = checkAmount(input.amountMinor);
  if (amountError) return { ok: false, error: amountError };
  if (input.currency !== obligation.currency) {
    return {
      ok: false,
      error: `Transaction currency must match the obligation currency (${obligation.currency}).`,
    };
  }
  const dateError = checkISO(input.date, "Transaction date");
  if (dateError) return { ok: false, error: dateError };
  if (!input.method) return { ok: false, error: "Payment method is required." };
  return { ok: true };
}

export function validateExpenseInput(input: ExpenseInput): ValidationResult {
  if (!input.description.trim()) return { ok: false, error: "Description is required." };
  const amountError = checkAmount(input.amountMinor);
  if (amountError) return { ok: false, error: amountError };
  if (!input.currency) return { ok: false, error: "Currency is required." };
  const dateError = checkISO(input.date, "Expense date");
  if (dateError) return { ok: false, error: dateError };
  if (!input.category) return { ok: false, error: "Category is required." };
  if (input.paymentStatus !== "unpaid" && input.paymentStatus !== "paid") {
    return { ok: false, error: "Payment status must be unpaid or paid." };
  }
  if (input.paymentStatus === "paid" && input.paidOn) {
    const paidError = checkISO(input.paidOn, "Paid-on date");
    if (paidError) return { ok: false, error: paidError };
  }
  return { ok: true };
}

export function validateProfileInput(input: ProfileInput): ValidationResult {
  if (!input.projectId.trim()) return { ok: false, error: "Project is required." };
  const amountError = checkAmount(input.contractValueMinor);
  if (amountError) return { ok: false, error: amountError };
  if (!input.currency) return { ok: false, error: "Currency is required." };
  const dateError = checkISO(input.contractDate, "Contract date");
  if (dateError) return { ok: false, error: dateError };
  if (input.expectedDeliveryDate) {
    const deliveryError = checkISO(input.expectedDeliveryDate, "Expected delivery date");
    if (deliveryError) return { ok: false, error: deliveryError };
  }
  return { ok: true };
}

export function assertValid(result: ValidationResult): void {
  if (!result.ok) throw new Error(result.error);
}

export function compactPatch<T extends object>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}