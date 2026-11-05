"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useBusinessSettings,
  useClients,
  useCreateInvoice,
  useProjects,
  useUpdateInvoice,
} from "@/hooks/use-mylist";
import {
  formatMoney,
  invoiceDiscountAmount,
  invoiceRemaining,
  invoiceTotal,
  parseMoneyInput,
} from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  type DiscountType,
  type InvoiceDTO,
  type StoredInvoiceStatus,
} from "@/lib/types";

const NONE = "__none__";

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function fromDateInput(value: string): string | null {
  return value ? `${value}T12:00:00.000Z` : null;
}

interface ItemRow {
  key: number;
  description: string;
  quantity: string;
  unitPrice: string;
}

let rowKey = 0;
function emptyRow(): ItemRow {
  rowKey += 1;
  return { key: rowKey, description: "", quantity: "", unitPrice: "" };
}

/**
 * Create / edit invoice dialog (Phase 5) with a full line-items editor.
 * The server recomputes subtotal / discount / charges / total from the
 * inputs, so the dialog only mirrors the same formulas for live preview.
 */
export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  presetClientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDTO | null;
  /** Pre-selected client when creating from a client page */
  presetClientId?: string | null;
}) {
  const { t, lang } = useI18n();
  const isEdit = !!invoice;

  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  const { data: clientsData } = useClients();
  const clients = clientsData?.clients ?? [];
  const { data: projectsData } = useProjects();
  const allProjects = projectsData?.projects ?? [];
  const { data: settingsData } = useBusinessSettings();

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string>(NONE);
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<StoredInvoiceStatus>("DRAFT");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [subtotal, setSubtotal] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [charges, setCharges] = useState("");
  const [chargesNotes, setChargesNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId(invoice?.client?.id ?? presetClientId ?? "");
      setProjectId(invoice?.project?.id ?? NONE);
      setNumber(invoice?.number ?? "");
      setIssueDate(toDateInput(invoice?.issueDate ?? new Date().toISOString()));
      setDueDate(toDateInput(invoice?.dueDate));
      setStatus(
        invoice?.status === "SENT" || invoice?.status === "CANCELLED"
          ? invoice.status
          : "DRAFT",
      );
      setCurrency(invoice?.currency ?? settingsData?.settings.currency ?? DEFAULT_CURRENCY);
      // Seed the items editor from the invoice (empty → manual subtotal mode)
      setRows(
        invoice?.items?.length
          ? invoice.items.map((item) => {
              rowKey += 1;
              return {
                key: rowKey,
                description: item.description,
                quantity: String(item.quantity),
                unitPrice: String(item.unitPrice),
              };
            })
          : isEdit
            ? []
            : [emptyRow()],
      );
      setSubtotal(invoice && !invoice.items.length ? String(invoice.subtotal) : "");
      setDiscountType(invoice?.discountType ?? "PERCENTAGE");
      setDiscountValue(invoice ? String(invoice.discountValue) : "");
      setCharges(invoice?.additionalCharges ? String(invoice.additionalCharges) : "");
      setChargesNotes(invoice?.additionalNotes ?? "");
      setNotes(invoice?.notes ?? "");
      setTerms(invoice?.terms ?? "");
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice, presetClientId, settingsData]);

  // Projects belonging to the selected client only.
  const clientProjects = useMemo(
    () => allProjects.filter((p) => p.client?.id === clientId),
    [allProjects, clientId],
  );

  // Keep the project selection valid when the client changes.
  useEffect(() => {
    if (projectId !== NONE && !clientProjects.some((p) => p.id === projectId)) {
      setProjectId(NONE);
    }
  }, [clientId, clientProjects, projectId]);

  // A row counts as "used" when any of its inputs is filled — then the
  // dialog switches from manual-subtotal mode to items mode.
  const usedRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.description.trim() ||
          parseMoneyInput(r.quantity || "0") > 0 ||
          parseMoneyInput(r.unitPrice || "0") > 0,
      ),
    [rows],
  );
  const itemsMode = usedRows.length > 0;
  const hasIncompleteRow = usedRows.some(
    (r) =>
      !r.description.trim() ||
      parseMoneyInput(r.quantity || "0") <= 0 ||
      parseMoneyInput(r.unitPrice || "0") < 0,
  );

  // Live preview of the money chain (mirrors the server-side math).
  const itemsSubtotal = useMemo(
    () =>
      round2Sum(
        usedRows.map((r) => parseMoneyInput(r.quantity || "0") * parseMoneyInput(r.unitPrice || "0")),
      ),
    [usedRows],
  );
  const subtotalNum = itemsMode ? itemsSubtotal : parseMoneyInput(subtotal || "0");
  const discountValueNum = parseMoneyInput(discountValue || "0");
  const chargesNum = parseMoneyInput(charges || "0");
  const previewDiscount = invoiceDiscountAmount(subtotalNum, discountType, discountValueNum);
  const previewTotal = invoiceTotal(subtotalNum, previewDiscount, chargesNum);
  const paidNum = invoice?.amountPaid ?? 0;
  const previewRemaining = invoiceRemaining(previewTotal, paidNum);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>([...CURRENCIES, currency]);
    return [...set];
  }, [currency]);

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function onSave() {
    if (!clientId || saving || (itemsMode && hasIncompleteRow)) return;
    setSaving(true);
    const payload = {
      clientId,
      projectId: projectId === NONE ? null : projectId,
      number: number.trim() ? number.trim() : null,
      issueDate: fromDateInput(issueDate) ?? new Date().toISOString(),
      dueDate: fromDateInput(dueDate),
      status,
      currency,
      ...(itemsMode
        ? {
            items: usedRows.map((r) => ({
              description: r.description.trim(),
              quantity: parseMoneyInput(r.quantity || "0"),
              unitPrice: parseMoneyInput(r.unitPrice || "0"),
            })),
          }
        : { subtotal: subtotalNum }),
      discountType,
      discountValue: discountValueNum,
      additionalCharges: chargesNum,
      additionalNotes: chargesNotes.trim() ? chargesNotes.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      terms: terms.trim() ? terms.trim() : null,
    };
    try {
      if (isEdit && invoice) {
        await updateInvoice.mutateAsync({ id: invoice.id, data: payload });
      } else {
        await createInvoice.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast already shown by hook
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("invoices.editInvoice") : t("invoices.newInvoice")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t("invoices.editInvoice") : t("invoices.newInvoice")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("invoices.clientLabel")}</Label>
              <Select
                value={clientId || undefined}
                onValueChange={(v) => setClientId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("invoices.clientPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company ? `${c.name} — ${c.company}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("invoices.projectLabel")}</Label>
              <Select value={projectId} onValueChange={(v) => setProjectId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("invoices.projectPlaceholder")}</SelectItem>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-number">{t("invoices.numberLabel")}</Label>
              <Input
                id="invoice-number"
                dir="ltr"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder={t("invoices.numberAuto")}
                disabled={isEdit}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("invoices.statusLabel")}</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as StoredInvoiceStatus)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">{t("invoices.statusDraft")}</SelectItem>
                  <SelectItem value="SENT">{t("invoices.statusSent")}</SelectItem>
                  {isEdit && (
                    <SelectItem value="CANCELLED">
                      {t("invoices.statusCancelled")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-issue">{t("invoices.issueDateLabel")}</Label>
              <Input
                id="invoice-issue"
                type="date"
                dir="ltr"
                className="h-9"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-due">{t("invoices.dueDateLabel")}</Label>
              <Input
                id="invoice-due"
                type="date"
                dir="ltr"
                className="h-9"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* ── Line items ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("invoices.itemsSection")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setRows((prev) => [...prev, emptyRow()])}
              >
                <Plus className="size-3.5" />
                {t("invoices.addItem")}
              </Button>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                {t("invoices.itemsHint")}
              </p>
            ) : (
              <div className="space-y-1.5">
                <div className="hidden grid-cols-[1fr_5rem_6.5rem_6.5rem_2rem] gap-2 px-1 text-[11px] font-medium text-slate-400 sm:grid">
                  <span>{t("invoices.itemDescription")}</span>
                  <span>{t("invoices.itemQty")}</span>
                  <span>{t("invoices.itemUnitPrice")}</span>
                  <span className="text-end">{t("invoices.itemAmount")}</span>
                  <span />
                </div>
                {rows.map((row) => {
                  const amount =
                    parseMoneyInput(row.quantity || "0") *
                    parseMoneyInput(row.unitPrice || "0");
                  return (
                    <div
                      key={row.key}
                      className="grid grid-cols-[1fr_4.5rem] items-center gap-2 sm:grid-cols-[1fr_5rem_6.5rem_6.5rem_2rem]"
                    >
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(row.key, { description: e.target.value })}
                        placeholder={t("invoices.itemDescriptionPlaceholder")}
                        className="h-9"
                      />
                      <Input
                        inputMode="decimal"
                        dir="ltr"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        placeholder="1"
                        className="h-9 tabular-nums"
                      />
                      <Input
                        inputMode="decimal"
                        dir="ltr"
                        value={row.unitPrice}
                        onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                        placeholder="0"
                        className="hidden h-9 tabular-nums sm:block"
                      />
                      <span
                        className="hidden text-end text-sm font-medium tabular-nums text-slate-700 sm:block"
                        dir="ltr"
                      >
                        {formatMoney(amount, lang, currency)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="hidden size-8 text-slate-300 hover:text-red-600 sm:block"
                        aria-label={t("delete")}
                        onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                      {/* Mobile: price + delete on second line */}
                      <div className="col-span-2 flex items-center gap-2 sm:hidden">
                        <Input
                          inputMode="decimal"
                          dir="ltr"
                          value={row.unitPrice}
                          onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                          placeholder={t("invoices.itemUnitPrice")}
                          className="h-9 tabular-nums"
                        />
                        <span className="w-20 text-end text-sm font-medium tabular-nums text-slate-700" dir="ltr">
                          {formatMoney(amount, lang, currency)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-slate-300 hover:text-red-600"
                          aria-label={t("delete")}
                          onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {hasIncompleteRow && (
                  <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">
                    {t("invoices.itemsIncomplete")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Manual subtotal — only when there are no items */}
          {!itemsMode && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice-subtotal">{t("invoices.subtotalLabel")}</Label>
                <Input
                  id="invoice-subtotal"
                  inputMode="decimal"
                  dir="ltr"
                  className="tabular-nums"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-currency">{t("invoices.currencyLabel")}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="invoice-currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>{t("invoices.discountTypeLabel")}</Label>
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType(v as DiscountType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">
                    {t("invoices.discountPercentage")}
                  </SelectItem>
                  <SelectItem value="FIXED">{t("invoices.discountFixed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-discount">{t("invoices.discountValueLabel")}</Label>
              <Input
                id="invoice-discount"
                inputMode="decimal"
                dir="ltr"
                className="tabular-nums"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-charges">{t("invoices.chargesLabel")}</Label>
              <Input
                id="invoice-charges"
                inputMode="decimal"
                dir="ltr"
                className="tabular-nums"
                value={charges}
                onChange={(e) => setCharges(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-charges-notes">
                {t("invoices.chargesNotesLabel")}
              </Label>
              <Input
                id="invoice-charges-notes"
                value={chargesNotes}
                onChange={(e) => setChargesNotes(e.target.value)}
                placeholder={t("invoices.chargesNotesPlaceholder")}
              />
            </div>
          </div>

          {/* Live totals preview — same formulas the server applies */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{t("invoices.subtotalLabel")}</span>
              <span className="font-medium tabular-nums text-slate-700" dir="ltr">
                {formatMoney(subtotalNum, lang, currency)}
              </span>
            </div>
            {previewDiscount > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("invoices.discountValueLabel")}</span>
                <span className="font-medium tabular-nums text-amber-700" dir="ltr">
                  − {formatMoney(previewDiscount, lang, currency)}
                </span>
              </div>
            )}
            {chargesNum > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("invoices.chargesLabel")}</span>
                <span className="font-medium tabular-nums text-blue-700" dir="ltr">
                  + {formatMoney(chargesNum, lang, currency)}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">
                {t("invoices.totalLabel")}
              </span>
              <span className="text-lg font-bold tabular-nums text-primary" dir="ltr">
                {formatMoney(previewTotal, lang, currency)}
              </span>
            </div>
            {isEdit && paidNum > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("invoices.remainingLabel")}</span>
                <span
                  className={
                    previewRemaining <= 0
                      ? "font-semibold tabular-nums text-emerald-600"
                      : "font-semibold tabular-nums text-slate-800"
                  }
                  dir="ltr"
                >
                  {formatMoney(previewRemaining, lang, currency)}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-notes">{t("invoices.notesLabel")}</Label>
              <Textarea
                id="invoice-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-terms">{t("invoices.termsLabel")}</Label>
              <Textarea
                id="invoice-terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !clientId || (itemsMode && hasIncompleteRow)}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sum with the same rounding the finance helpers apply. */
function round2Sum(values: number[]): number {
  return Math.round(values.reduce((s, v) => s + v, 0) * 100) / 100;
}