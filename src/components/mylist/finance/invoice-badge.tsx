"use client";

import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tailwind tone per derived invoice display state. */
export const INVOICE_STATUS_TONES: Record<InvoiceStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-600",
  SENT: "border-blue-200 bg-blue-50 text-blue-700",
  PARTIALLY_PAID: "border-amber-200 bg-amber-50 text-amber-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-400 line-through",
};

const STATUS_KEY: Record<InvoiceStatus, TranslationKey> = {
  DRAFT: "invoices.statusDraft",
  SENT: "invoices.statusSent",
  PARTIALLY_PAID: "invoices.statusPartiallyPaid",
  PAID: "invoices.statusPaid",
  OVERDUE: "invoices.statusOverdue",
  CANCELLED: "invoices.statusCancelled",
};

export function invoiceStatusLabelKey(status: InvoiceStatus): TranslationKey {
  return STATUS_KEY[status];
}

/** Badge for the derived (not stored) invoice display state. */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        INVOICE_STATUS_TONES[status],
      )}
    >
      {t(invoiceStatusLabelKey(status))}
    </span>
  );
}