"use client";

import { useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeletePayment } from "@/hooks/use-mylist";
import { invoicePdfUrl } from "@/lib/api-client";
import { formatDate, useI18n } from "@/lib/i18n";
import { formatMoney, invoiceDisplayState } from "@/lib/finance";
import type { InvoiceDTO, PaymentMethod } from "@/lib/types";
import { InvoiceStatusBadge } from "@/components/mylist/finance/invoice-badge";

const METHOD_KEY: Record<PaymentMethod, "payments.methodCash" | "payments.methodBank" | "payments.methodCard" | "payments.methodOther"> = {
  CASH: "payments.methodCash",
  BANK_TRANSFER: "payments.methodBank",
  CARD: "payments.methodCard",
  OTHER: "payments.methodOther",
};

/**
 * Read-only invoice view (Phase 5): items, financial breakdown, payment
 * history with delete, plus PDF open/download and edit/record-payment
 * hand-offs to the parent view.
 */
export function InvoiceDetailDialog({
  invoice,
  onOpenChange,
  onEdit,
  onPay,
}: {
  invoice: InvoiceDTO | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (invoice: InvoiceDTO) => void;
  onPay: (invoice: InvoiceDTO) => void;
}) {
  const { t, lang } = useI18n();
  const deletePayment = useDeletePayment();
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  if (!invoice) return null;
  const display = invoiceDisplayState({
    status: invoice.status,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    dueDate: invoice.dueDate,
  });
  const canPay = invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && invoice.remaining > 0;
  const money = (n: number) => formatMoney(n, lang, invoice.currency);

  return (
    <>
      <Dialog open={!!invoice} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2" dir="ltr">
              {invoice.number}
              <InvoiceStatusBadge status={display} />
            </DialogTitle>
            <DialogDescription>
              {invoice.client?.name ?? t("invoices.noClient")}
              {invoice.project ? ` · ${invoice.project.name}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">{t("invoices.issueDateLabel")}</p>
                <p className="font-medium text-slate-700">
                  {formatDate(invoice.issueDate, lang)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t("invoices.dueDateLabel")}</p>
                <p className="font-medium text-slate-700">
                  {invoice.dueDate ? formatDate(invoice.dueDate, lang) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t("invoices.currencyLabel")}</p>
                <p className="font-medium text-slate-700" dir="ltr">
                  {invoice.currency}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t("invoices.numberLabel")}</p>
                <p className="font-medium text-slate-700" dir="ltr">
                  {invoice.number}
                </p>
              </div>
            </div>

            {/* Items */}
            {invoice.items.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t("invoices.itemDescription")}</TableHead>
                      <TableHead className="text-end">{t("invoices.itemQty")}</TableHead>
                      <TableHead className="text-end">{t("invoices.itemUnitPrice")}</TableHead>
                      <TableHead className="text-end">{t("invoices.itemAmount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.description}</TableCell>
                        <TableCell className="text-end tabular-nums" dir="ltr">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-end tabular-nums" dir="ltr">
                          {money(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-end font-medium tabular-nums" dir="ltr">
                          {money(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Financial breakdown */}
            <div className="space-y-1.5 rounded-lg border border-slate-200 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("invoices.subtotalLabel")}</span>
                <span className="font-medium tabular-nums" dir="ltr">
                  {money(invoice.subtotal)}
                </span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {t("invoices.discountValueLabel")}
                    {invoice.discountType === "PERCENTAGE" ? ` (${invoice.discountValue}%)` : ""}
                  </span>
                  <span className="font-medium tabular-nums text-amber-700" dir="ltr">
                    − {money(invoice.discountAmount)}
                  </span>
                </div>
              )}
              {invoice.additionalCharges > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {t("invoices.chargesLabel")}
                    {invoice.additionalNotes ? ` (${invoice.additionalNotes})` : ""}
                  </span>
                  <span className="font-medium tabular-nums text-blue-700" dir="ltr">
                    + {money(invoice.additionalCharges)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-medium text-slate-600">{t("invoices.totalLabel")}</span>
                <span className="font-bold tabular-nums text-primary" dir="ltr">
                  {money(invoice.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("invoices.paidLabel")}</span>
                <span className="font-medium tabular-nums text-emerald-600" dir="ltr">
                  {money(invoice.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">
                  {t("invoices.balanceDue")}
                </span>
                <span
                  className={
                    invoice.remaining <= 0
                      ? "font-bold tabular-nums text-emerald-600"
                      : "font-bold tabular-nums text-slate-900"
                  }
                  dir="ltr"
                >
                  {invoice.remaining <= 0 ? t("payments.paidInFull") : money(invoice.remaining)}
                </span>
              </div>
            </div>

            {/* Payment history */}
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                {t("payments.historyTitle")}
              </p>
              {invoice.payments.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
                  {t("payments.noPaymentsYet")}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {invoice.payments.map((payment) => (
                    <div key={payment.id} className="group flex items-center gap-3 px-3 py-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Wallet className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold tabular-nums text-slate-700" dir="ltr">
                          {money(payment.amount)}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {formatDate(payment.paidAt, lang)}
                          {payment.method ? ` · ${t(METHOD_KEY[payment.method])}` : ""}
                          {payment.notes ? ` · ${payment.notes}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-slate-300 transition-opacity hover:text-red-600"
                        aria-label={t("delete")}
                        onClick={() => setDeletingPaymentId(payment.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes & terms */}
            {(invoice.notes || invoice.terms) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {invoice.notes && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">
                      {t("invoices.notesLabel")}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">
                      {invoice.notes}
                    </p>
                  </div>
                )}
                {invoice.terms && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">
                      {t("invoices.termsLabel")}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">
                      {invoice.terms}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={invoicePdfUrl(invoice.id, lang)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                {t("invoices.pdfOpen")}
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={invoicePdfUrl(invoice.id, lang, true)} download>
                <Download className="size-3.5" />
                {t("invoices.pdfDownload")}
              </a>
            </Button>
            <div className="ms-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(invoice)}>
                <Pencil className="size-3.5" />
                {t("edit")}
              </Button>
              {canPay && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => onPay(invoice)}
                >
                  <Wallet className="size-3.5" />
                  {t("payments.record")}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete payment confirmation */}
      <AlertDialog
        open={!!deletingPaymentId}
        onOpenChange={(o) => !o && setDeletingPaymentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("payments.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("payments.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deletingPaymentId) deletePayment.mutate({ id: deletingPaymentId });
                setDeletingPaymentId(null);
              }}
            >
              {deletePayment.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}