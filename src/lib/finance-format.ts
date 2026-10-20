/**
 * Milesto — presentation helpers for finance records.
 * Deterministic formatting (no ICU dependence) so tables stay stable.
 */

import type {
  ExpenseCategory,
  ObligationStatus,
  PaymentMethod,
  TransactionType,
} from "@/types/finance";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** "2026-03-15" → "15 Mar 2026". Invalid/empty input renders as "—". */
export function formatDateDisplay(date?: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  const year = date.slice(0, 4);
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month < 1 || month > 12) return date;
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** "2026-03" → "Mar 2026". */
export function formatMonthDisplay(month?: string | null): string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return "—";
  const year = month.slice(0, 4);
  const monthIndex = Number(month.slice(5, 7));
  if (monthIndex < 1 || monthIndex > 12) return month;
  return `${MONTH_NAMES[monthIndex - 1]} ${year}`;
}

export type StatusBadgeVariant = "success" | "danger" | "warning" | "info" | "neutral" | "outline";

export const OBLIGATION_STATUS_META: Record<
  ObligationStatus,
  { label: string; variant: StatusBadgeVariant }
> = {
  planned: { label: "Planned", variant: "info" },
  due: { label: "Due", variant: "warning" },
  partially_paid: { label: "Partially paid", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

export const TRANSACTION_TYPE_META: Record<
  TransactionType,
  { label: string; variant: StatusBadgeVariant }
> = {
  payment: { label: "Payment", variant: "success" },
  refund: { label: "Refund", variant: "danger" },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  hosting: "Hosting",
  domain: "Domain",
  software: "Software",
  contractor: "Contractor",
  marketing: "Marketing",
  infrastructure: "Infrastructure",
  other: "Other",
};

export function formatPercentLabel(percent: number | null): string {
  return percent === null ? "—" : `${percent.toFixed(1)}%`;
}