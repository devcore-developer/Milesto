/**
 * Milesto — Finance & Payments (Phase 7)
 *
 * All monetary values are stored as integer minor units
 * (e.g. cents / piasters) so authoritative calculations never
 * touch floating point. Amounts in different currencies are
 * NEVER added together — they are grouped per currency.
 *
 * Persistence note: finance data lives in memory (same honest
 * limitation as the existing providers) and resets to the seed
 * dataset on refresh.
 */

export const CURRENCIES = ["EGP", "USD", "EUR", "GBP", "SAR", "AED"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Decimal digits per currency (all supported ones use 2 today). */
export const CURRENCY_DECIMALS: Record<Currency, number> = {
  EGP: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  SAR: 2,
  AED: 2,
};

/**
 * Effective obligation status — always DERIVED from the transaction
 * history + due date + cancellation flag. It is never hand-maintained,
 * so it can never contradict recorded transactions.
 */
export const OBLIGATION_STATUSES = [
  "planned",
  "due",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

/** The only lifecycle states stored directly on an obligation:
 *  everything else is derived. Cancellation is an auditable event. */
export const OBLIGATION_STORED_STATUSES = ["planned", "cancelled"] as const;
export type ObligationStoredStatus = (typeof OBLIGATION_STORED_STATUSES)[number];

export const PAYMENT_METHODS = ["bank_transfer", "card", "cash", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TRANSACTION_TYPES = ["payment", "refund"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "hosting",
  "domain",
  "software",
  "contractor",
  "marketing",
  "infrastructure",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export type ExpensePaymentStatus = (typeof EXPENSE_PAYMENT_STATUSES)[number];

/** An amount grouped under one currency. `minor` may be negative only
 *  where documented (net collected after refunds, net cash flow). */
export interface CurrencyAmount {
  currency: Currency;
  minor: number;
}

export interface FinanceObligation {
  id: string; // OB-1, OB-2, ...
  projectId: string;
  title: string;
  description?: string;
  amountMinor: number; // > 0, integer minor units
  currency: Currency;
  dueDate: string; // "YYYY-MM-DD"
  reference?: string; // invoice / PO reference
  notes?: string;
  /** Cancellation is an event, never a deletion — history stays intact. */
  cancelledAt?: string | null;
  cancelNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string; // TXN-1, TXN-2, ...
  obligationId: string;
  projectId: string; // denormalized from the obligation for fast per-project sums
  type: TransactionType; // payment adds to collected, refund subtracts
  amountMinor: number; // > 0 always — direction comes from `type`
  currency: Currency; // always matches the obligation currency
  date: string; // "YYYY-MM-DD" — actual money movement date
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  /** Voided transactions stay in history but are excluded from all
   *  authoritative calculations (reversal instead of deletion). */
  voidedAt?: string | null;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceExpense {
  id: string; // EXP-1, EXP-2, ...
  description: string;
  amountMinor: number; // > 0
  currency: Currency;
  date: string; // "YYYY-MM-DD" — when the expense was incurred
  category: ExpenseCategory;
  /** Set = project expense, null = general business expense. */
  projectId?: string | null;
  vendor?: string;
  paymentStatus: ExpensePaymentStatus;
  /** Required when paid — used as the cash-out date in cash flow views. */
  paidOn?: string | null;
  receiptRef?: string;
  notes?: string;
  voidedAt?: string | null;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Contract-level finance agreement for one project. */
export interface ProjectFinanceProfile {
  projectId: string;
  contractValueMinor: number; // > 0
  currency: Currency;
  contractDate: string; // "YYYY-MM-DD"
  expectedDeliveryDate?: string | null;
  paymentTerms?: string;
  agreementNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DateRange {
  from?: string | null; // inclusive "YYYY-MM-DD"
  to?: string | null; // inclusive "YYYY-MM-DD"
}

export interface FinanceFilters {
  projectId?: string | null;
  dateRange?: DateRange | null;
}

export interface FinanceDataset {
  obligations: FinanceObligation[];
  transactions: FinanceTransaction[];
  expenses: FinanceExpense[];
}

export interface MonthlyCashFlowRow {
  month: string; // "YYYY-MM"
  currency: Currency;
  collectedMinor: number; // payments − refunds (cash in)
  paidExpenseMinor: number; // paid expenses only (cash out)
  netMinor: number; // collectedMinor − paidExpenseMinor (cash basis)
}

export interface CumulativeCashFlowRow {
  month: string; // "YYYY-MM"
  currency: Currency;
  cumulativeMinor: number; // running net cash across months
}

export interface ProjectCurrencyValue {
  projectId: string;
  currency: Currency;
  minor: number;
}

export interface ProjectProfitRow {
  projectId: string;
  currency: Currency;
  collectedMinor: number;
  paidExpenseMinor: number;
  /** collected − paid expenses (cash basis — the definition is disclosed in the UI). */
  profitMinor: number;
}

export interface CollectionRateRow {
  currency: Currency;
  /** collected / invoiced × 100 rounded to 1 decimal; null when nothing is invoiced. */
  percent: number | null;
}

/** Authoritative per-project finance summary. Definitions:
 *  - contractedValue: profile contract value; falls back to Σ active obligations.
 *  - invoiced:        Σ active (non-cancelled) obligations — the issued payment schedule.
 *  - collected:       Σ payments − refunds (non-voided transactions) — cash basis.
 *  - outstanding:     Σ remaining balances of active obligations.
 *  - netCash:         collected − paid expenses (cash basis, disclosed in the UI). */
export interface ProjectFinanceSummary {
  projectId: string;
  hasProfile: boolean;
  contractedValue: CurrencyAmount[];
  invoiced: CurrencyAmount[];
  collected: CurrencyAmount[];
  outstanding: CurrencyAmount[];
  overdue: CurrencyAmount[];
  scheduledFuture: CurrencyAmount[];
  dueThisMonth: CurrencyAmount[];
  paidExpenses: CurrencyAmount[];
  outstandingExpenses: CurrencyAmount[];
  netCash: CurrencyAmount[];
  margins: { currency: Currency; percent: number | null }[];
}

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

export interface ObligationUpdateInput {
  title?: string;
  description?: string;
  amountMinor?: number;
  dueDate?: string;
  reference?: string;
  notes?: string;
}

export interface TransactionInput {
  obligationId: string;
  type: TransactionType;
  amountMinor: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface ExpenseInput {
  description: string;
  amountMinor: number;
  currency: Currency;
  date: string;
  category: ExpenseCategory;
  projectId?: string | null;
  vendor?: string;
  paymentStatus: ExpensePaymentStatus;
  paidOn?: string | null;
  receiptRef?: string;
  notes?: string;
}

export interface ExpenseUpdateInput {
  description?: string;
  amountMinor?: number;
  date?: string;
  category?: ExpenseCategory;
  projectId?: string | null;
  vendor?: string;
  paymentStatus?: ExpensePaymentStatus;
  paidOn?: string | null;
  receiptRef?: string;
  notes?: string;
}

export interface ProfileInput {
  projectId: string;
  contractValueMinor: number;
  currency: Currency;
  contractDate: string;
  expectedDeliveryDate?: string | null;
  paymentTerms?: string;
  agreementNotes?: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}