"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddPayment } from "@/hooks/use-mylist";
import {
  PAYMENT_METHODS,
  type InvoiceDTO,
  type PaymentMethod,
} from "@/lib/types";
import { formatMoney, parseMoneyInput } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";

const METHOD_KEY: Record<PaymentMethod, "payments.methodCash" | "payments.methodBank" | "payments.methodCard" | "payments.methodOther"> = {
  CASH: "payments.methodCash",
  BANK_TRANSFER: "payments.methodBank",
  CARD: "payments.methodCard",
  OTHER: "payments.methodOther",
};

/** Record a payment against a sent invoice. */
export function PaymentDialog({
  invoice,
  onOpenChange,
}: {
  invoice: InvoiceDTO | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const addPayment = useAddPayment();

  const open = !!invoice;
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setAmount(String(invoice.remaining > 0 ? invoice.remaining : 0));
      setPaidAt(new Date().toISOString().slice(0, 10));
      setMethod("CASH");
      setNotes("");
      setSaving(false);
    }
  }, [invoice]);

  const amountNum = useMemo(() => parseMoneyInput(amount || "0"), [amount]);
  const remainingBefore = invoice?.remaining ?? 0;
  const remainingAfter = Math.max(0, remainingBefore - amountNum);
  const overpay = amountNum > remainingBefore + 0.001;

  async function onSave() {
    if (!invoice || saving || amountNum <= 0 || overpay) return;
    setSaving(true);
    try {
      await addPayment.mutateAsync({
        invoiceId: invoice.id,
        data: {
          amount: amountNum,
          paidAt: paidAt ? `${paidAt}T12:00:00.000Z` : undefined,
          method,
          notes: notes.trim() ? notes.trim() : null,
        },
      });
      onOpenChange(false);
    } catch {
      // toast already shown by hook
    } finally {
      setSaving(false);
    }
  }

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("payments.title")}</DialogTitle>
          <DialogDescription>
            {t("payments.for", { number: invoice.number })} ·{" "}
            {invoice.client?.name ?? t("invoices.noClient")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
            <span className="text-slate-500">{t("payments.remainingBefore")}</span>
            <span className="font-semibold tabular-nums text-slate-800" dir="ltr">
              {formatMoney(remainingBefore, lang)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">{t("payments.amountLabel")}</Label>
              <Input
                id="payment-amount"
                inputMode="decimal"
                dir="ltr"
                className="tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-date">{t("payments.dateLabel")}</Label>
              <Input
                id="payment-date"
                type="date"
                dir="ltr"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("payments.methodLabel")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(METHOD_KEY[m])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">{t("payments.notesLabel")}</Label>
            <Input
              id="payment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-sm">
            <span className="text-slate-500">{t("payments.remainingAfter")}</span>
            <span
              className={
                remainingAfter <= 0
                  ? "font-semibold tabular-nums text-emerald-600"
                  : "font-semibold tabular-nums text-slate-800"
              }
              dir="ltr"
            >
              {remainingAfter <= 0
                ? t("payments.paidInFull")
                : formatMoney(remainingAfter, lang)}
            </span>
          </div>

          {overpay && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {t("payments.overInvoice")}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || amountNum <= 0 || overpay}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("payments.record")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}