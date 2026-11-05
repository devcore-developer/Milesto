// Pure financial calculation helpers (Phase 4, extended in Phase 5) — shared
// by API routes, the PDF generator and UI. Every monetary figure in the app
// flows through these functions so the numbers stay consistent between the
// server, client pages and dashboards.
import {
  DEFAULT_CURRENCY,
} from "@/lib/types";
import type {
  BusinessSettingsDTO,
  ClientFinancials,
  DiscountType,
  InvoiceStatus,
} from "@/lib/types";

/** Round to 2 decimals without float drift (1.005 → 1.01). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Money input the UI sends before it is validated ("" → 0, "1,200" → 1200). */
export function parseMoneyInput(value: string | number): number {
  if (typeof value === "number") return round2(value);
  const cleaned = value.replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? round2(n) : 0;
}

/**
 * Project total value = agreed price + additional charges − discount,
 * clamped so it can never go below zero.
 */
export function projectTotalValue(p: {
  agreedPrice: number;
  additionalCharges: number;
  discount: number;
}): number {
  return round2(Math.max(0, p.agreedPrice + p.additionalCharges - p.discount));
}

/** Remaining balance of a project given what has been paid so far. */
export function projectRemaining(totalValue: number, paid: number): number {
  return round2(Math.max(0, totalValue - paid));
}

/**
 * Invoice discount amount from its type + value.
 * PERCENTAGE → subtotal × value / 100, FIXED → value itself.
 * Always clamped to [0, subtotal] so totals stay sensible.
 */
export function invoiceDiscountAmount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  const raw =
    discountType === "PERCENTAGE" ? (subtotal * discountValue) / 100 : discountValue;
  return round2(Math.min(subtotal, Math.max(0, raw)));
}

/**
 * Final invoice total = subtotal − discountAmount + additionalCharges (≥ 0).
 * Additional charges (Phase 5) are delivery/extra fees added after the
 * discount — they are never discounted themselves.
 */
export function invoiceTotal(
  subtotal: number,
  discountAmount: number,
  additionalCharges = 0,
): number {
  return round2(Math.max(0, subtotal - discountAmount + additionalCharges));
}

/** Remaining balance of an invoice (≥ 0). */
export function invoiceRemaining(total: number, amountPaid: number): number {
  return round2(Math.max(0, total - amountPaid));
}

/**
 * Draft and cancelled invoices never count towards revenue, collected
 * payments or outstanding balances — this single predicate decides.
 */
export function isCountableInvoice(status: string): boolean {
  return status !== "DRAFT" && status !== "CANCELLED";
}

/**
 * Derived display state of an invoice. Only DRAFT / SENT / CANCELLED are
 * stored; PARTIALLY_PAID, PAID and OVERDUE follow from the payments and
 * dates so the badge can never contradict the amounts:
 *   CANCELLED → stored
 *   paid in full (total > 0 && remaining ≤ 0) → PAID
 *   draft → DRAFT
 *   sent + due date passed + unpaid remainder → OVERDUE
 *   some money collected → PARTIALLY_PAID
 *   otherwise → SENT
 */
export function invoiceDisplayState(
  inv: {
    status: string;
    total: number;
    amountPaid: number;
    dueDate: string | null;
  },
  now: Date = new Date(),
): InvoiceStatus {
  if (inv.status === "CANCELLED") return "CANCELLED";
  const remaining = invoiceRemaining(inv.total, inv.amountPaid);
  if (inv.total > 0 && remaining <= 0) return "PAID";
  if (inv.status === "DRAFT") return "DRAFT";
  if (inv.dueDate) {
    const due = new Date(inv.dueDate);
    if (!Number.isNaN(due.getTime())) {
      due.setHours(23, 59, 59, 999); // overdue only after the whole due day
      if (due.getTime() < now.getTime()) return "OVERDUE";
    }
  }
  if (inv.amountPaid > 0) return "PARTIALLY_PAID";
  return "SENT";
}

/**
 * Per-client summary used on the clients list and the client details page.
 *   projectValue — totals of the client's non-cancelled projects
 *   invoiced     — totals of countable invoices
 *   paid         — amountPaid of those same invoices
 *   outstanding  — invoiced − paid
 */
export function clientFinancials(
  projects: { status: string; agreedPrice: number; additionalCharges: number; discount: number }[],
  invoices: { status: string; total: number; amountPaid: number }[],
): ClientFinancials {
  const projectValue = round2(
    projects
      .filter((p) => p.status !== "CANCELLED")
      .reduce((sum, p) => sum + projectTotalValue(p), 0),
  );
  const countable = invoices.filter((i) => isCountableInvoice(i.status));
  const invoiced = round2(countable.reduce((sum, i) => sum + i.total, 0));
  const paid = round2(countable.reduce((sum, i) => sum + i.amountPaid, 0));
  return {
    projectValue,
    invoiced,
    paid,
    outstanding: round2(Math.max(0, invoiced - paid)),
  };
}

/** Overall financial dashboard aggregates (drafts & cancelled excluded). */
export function overallFinancials(
  invoices: { status: string; total: number; amountPaid: number }[],
): {
  revenue: number;
  collected: number;
  outstanding: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  collectionRate: number;
} {
  const countable = invoices.filter((i) => isCountableInvoice(i.status));
  const revenue = round2(countable.reduce((sum, i) => sum + i.total, 0));
  const collected = round2(countable.reduce((sum, i) => sum + i.amountPaid, 0));
  const paidInvoiceCount = countable.filter(
    (i) => i.total > 0 && invoiceRemaining(i.total, i.amountPaid) <= 0,
  ).length;
  return {
    revenue,
    collected,
    outstanding: round2(Math.max(0, revenue - collected)),
    invoiceCount: countable.length,
    paidInvoiceCount,
    collectionRate:
      revenue > 0 ? Math.min(100, Math.round((collected / revenue) * 100)) : 0,
  };
}

export interface MonthPoint {
  /** "YYYY-MM" bucket key */
  key: string;
  /** Short month label in the active locale ("Jan" / "ينا") */
  label: string;
  /** Invoiced total (issue month, countable invoices only) */
  invoiced: number;
  /** Collected total (payment month, countable invoices only) */
  collected: number;
}

/**
 * Monthly aggregation for the financial dashboard chart — the last
 * `months` buckets ending with the current month.
 */
export function monthlyFinancials(
  invoices: {
    status: string;
    total: number;
    issueDate: string;
    payments: { amount: number; paidAt: string }[];
  }[],
  months = 6,
  locale: string = "en",
  now: Date = new Date(),
): MonthPoint[] {
  const points: MonthPoint[] = [];
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    month: "short",
  });

  for (let offset = months - 1; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({ key, label: fmt.format(d), invoiced: 0, collected: 0 });
  }
  const index = new Map(points.map((p, i) => [p.key, i]));

  const bucketOf = (iso: string): string | null => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  for (const inv of invoices) {
    if (!isCountableInvoice(inv.status)) continue;
    const issueKey = bucketOf(inv.issueDate);
    if (issueKey !== null && index.has(issueKey)) {
      points[index.get(issueKey) as number].invoiced = round2(
        points[index.get(issueKey) as number].invoiced + inv.total,
      );
    }
    for (const payment of inv.payments ?? []) {
      const payKey = bucketOf(payment.paidAt);
      if (payKey !== null && index.has(payKey)) {
        points[index.get(payKey) as number].collected = round2(
          points[index.get(payKey) as number].collected + payment.amount,
        );
      }
    }
  }
  return points;
}

/**
 * Currency label for amounts. Amounts are rendered with latin digits
 * (dir="ltr" wrappers in the UI) for cross-locale clarity.
 *
 * The currency defaults to the app-wide default (EGP) but can be set once
 * at startup from the user's invoice settings via `setDefaultCurrency`,
 * or per call via the third argument.
 */

/** Localized symbol/code per currency — anything unknown falls back to the code. */
const CURRENCY_SYMBOLS: Record<string, { en: string; ar: string }> = {
  EGP: { en: "EGP", ar: "ج.م" },
  USD: { en: "$", ar: "$" },
  EUR: { en: "€", ar: "€" },
  GBP: { en: "£", ar: "£" },
  SAR: { en: "SAR", ar: "ر.س" },
  AED: { en: "AED", ar: "د.إ" },
  KWD: { en: "KWD", ar: "د.ك" },
  QAR: { en: "QAR", ar: "ر.ق" },
  BHD: { en: "BHD", ar: "د.ب" },
  OMR: { en: "OMR", ar: "ر.ع" },
  JOD: { en: "JOD", ar: "د.أ" },
  MAD: { en: "MAD", ar: "د.م" },
};

export function currencySymbol(code: string, lang: string): string {
  const entry = CURRENCY_SYMBOLS[code];
  if (!entry) return code;
  return lang === "ar" ? entry.ar : entry.en;
}

let defaultCurrency: string = DEFAULT_CURRENCY;

/** Point the whole UI at the currency configured in invoice settings. */
export function setDefaultCurrency(code: string | null | undefined): void {
  if (code && code.trim()) defaultCurrency = code.trim().toUpperCase();
}

export function getDefaultCurrency(): string {
  return defaultCurrency;
}

export function formatMoney(n: number, lang: string, currency?: string): string {
  const code = (currency ?? defaultCurrency).toUpperCase();
  const amount = n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const symbol = currencySymbol(code, lang);
  if (lang === "ar") return `${amount} ${symbol}`;
  // "$1,200" for symbol-style currencies, "EGP 1,200" for code-style ones
  return symbol === code ? `${code} ${amount}` : `${symbol}${amount}`;
}

/**
 * Pick the currency for a new invoice: explicit value → user settings → app
 * default. Used by the invoice API routes (Phase 5).
 */
export function resolveInvoiceCurrency(
  explicit: string | null | undefined,
  settings: Pick<BusinessSettingsDTO, "currency"> | null | undefined,
): string {
  if (explicit && explicit.trim()) return explicit.trim().toUpperCase();
  if (settings?.currency && settings.currency.trim()) {
    return settings.currency.trim().toUpperCase();
  }
  return DEFAULT_CURRENCY;
}