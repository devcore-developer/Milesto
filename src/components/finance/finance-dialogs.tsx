"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type {
  FinanceExpense,
  FinanceObligation,
  ProjectFinanceProfile,
} from "@/types/finance";
import {
  CURRENCY_CHOICES,
  EXPENSE_CATEGORY_CHOICES,
  METHOD_CHOICES,
  PAYMENT_STATUS_CHOICES,
  TRANSACTION_TYPE_CHOICES,
  formatMinorAmount,
  minorToDecimalString,
  netPaidOf,
  parseAmountToMinor,
  remainingOf,
  todayISO,
  validateExpenseInput,
  validateObligationInput,
  validateProfileInput,
  validateTransactionInput,
  type Currency,
  type ExpenseInput,
  type ObligationInput,
  type ProfileInput,
  type TransactionInput,
} from "@/lib/finance-calculations";
import { useFinanceSafe } from "@/lib/finance-context";
import type { ProjectRef } from "@/components/finance/project-lookup";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        {children}
        <div className="mt-6 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

// ---------------------------------------------------------------------------
// Obligation dialog (create / edit)
// ---------------------------------------------------------------------------

export function ObligationDialog({
  projects,
  defaultProjectId,
  obligation,
  onClose,
}: {
  projects: readonly ProjectRef[];
  defaultProjectId?: string | null;
  obligation?: FinanceObligation | null;
  onClose: () => void;
}) {
  const finance = useFinanceSafe();
  const [projectId, setProjectId] = useState(
    obligation?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "",
  );
  const [title, setTitle] = useState(obligation?.title ?? "");
  const [description, setDescription] = useState(obligation?.description ?? "");
  const [amount, setAmount] = useState(
    obligation ? minorToDecimalString(obligation.amountMinor) : "",
  );
  const [currency, setCurrency] = useState<Currency>(obligation?.currency ?? "EGP");
  const [dueDate, setDueDate] = useState(obligation?.dueDate ?? "");
  const [reference, setReference] = useState(obligation?.reference ?? "");
  const [notes, setNotes] = useState(obligation?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseAmountToMinor(amount);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (Number.isNaN(parsedAmount)) {
      setError("Enter a valid amount, e.g. 1250 or 1250.50");
      return;
    }
    const input: ObligationInput = {
      projectId,
      title,
      description,
      amountMinor: parsedAmount,
      currency,
      dueDate,
      reference,
      notes,
    };
    const result = validateObligationInput(input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      if (obligation) finance.updateObligation(obligation.id, input);
      else finance.createObligation(input);
      onClose();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <Modal
      title={obligation ? "Edit obligation" : "New obligation"}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="subtle" onClick={handleSubmit}>
            {obligation ? "Save changes" : "Create obligation"}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />
        <Field label="Project">
          <select
            className={inputClass}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={Boolean(obligation)}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Amount${!Number.isNaN(parsedAmount) && amount ? ` (${formatMinorAmount(parsedAmount, currency)})` : ""}`}>
            <input
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>
          <Field label="Currency">
            <select
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              disabled={Boolean(obligation)}
            >
              {CURRENCY_CHOICES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Due date">
          <input
            type="date"
            className={inputClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Description">
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reference">
            <input
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Transaction dialog (record a payment / refund against an obligation)
// ---------------------------------------------------------------------------

export function TransactionDialog({
  obligation,
  onClose,
}: {
  obligation: FinanceObligation;
  onClose: () => void;
}) {
  const finance = useFinanceSafe();
  const [type, setType] = useState<"payment" | "refund">("payment");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<string>(METHOD_CHOICES[0] ?? "cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const netPaid = netPaidOf(obligation, finance.transactions);
  const remaining = remainingOf(obligation, finance.transactions);
  const parsedAmount = parseAmountToMinor(amount);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (Number.isNaN(parsedAmount)) {
      setError("Enter a valid amount, e.g. 1250 or 1250.50");
      return;
    }
    const input: TransactionInput = {
      obligationId: obligation.id,
      type,
      amountMinor: parsedAmount,
      currency: obligation.currency,
      date,
      method: method as TransactionInput["method"],
      reference,
      notes,
    };
    const result = validateTransactionInput(obligation, input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      finance.createTransaction(input);
      onClose();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <Modal
      title="Record transaction"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="subtle" onClick={handleSubmit}>
            Record
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="font-medium">{obligation.title}</div>
          <div className="mt-1 text-muted-foreground">
            Obligation: {formatMinorAmount(obligation.amountMinor, obligation.currency)} · Net paid:{" "}
            {formatMinorAmount(netPaid, obligation.currency)} · Remaining:{" "}
            {formatMinorAmount(remaining, obligation.currency)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value as "payment" | "refund")}
            >
              {TRANSACTION_TYPE_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value === "payment" ? "Payment" : "Refund"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Method">
            <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHOD_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reference">
            <input
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Multiple partial payments are allowed. Refunds reduce the collected amount.
        </p>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Expense dialog (create / edit)
// ---------------------------------------------------------------------------

export function ExpenseDialog({
  projects,
  defaultProjectId,
  expense,
  onClose,
}: {
  projects: readonly ProjectRef[];
  defaultProjectId?: string | null;
  expense?: FinanceExpense | null;
  onClose: () => void;
}) {
  const finance = useFinanceSafe();
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(
    expense ? minorToDecimalString(expense.amountMinor) : "",
  );
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? "EGP");
  const [date, setDate] = useState(expense?.date ?? todayISO());
  const [category, setCategory] = useState<string>(expense?.category ?? "other");
  const [projectId, setProjectId] = useState<string>(
    expense ? (expense.projectId ?? "") : (defaultProjectId ?? ""),
  );
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid">(
    expense?.paymentStatus ?? "unpaid",
  );
  const [paidOn, setPaidOn] = useState(expense?.paidOn ?? "");
  const [receiptRef, setReceiptRef] = useState(expense?.receiptRef ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseAmountToMinor(amount);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (Number.isNaN(parsedAmount)) {
      setError("Enter a valid amount, e.g. 1250 or 1250.50");
      return;
    }
    const input: ExpenseInput = {
      description,
      amountMinor: parsedAmount,
      currency,
      date,
      category: category as ExpenseInput["category"],
      projectId: projectId || null,
      vendor,
      paymentStatus,
      paidOn: paymentStatus === "paid" && paidOn ? paidOn : undefined,
      receiptRef,
      notes,
    };
    const result = validateExpenseInput(input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      if (expense) finance.updateExpense(expense.id, input);
      else finance.createExpense(input);
      onClose();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <Modal
      title={expense ? "Edit expense" : "New expense"}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="subtle" onClick={handleSubmit}>
            {expense ? "Save changes" : "Create expense"}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />
        <Field label="Description">
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <input
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>
          <Field label="Currency">
            <select
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {CURRENCY_CHOICES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORY_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Project (optional — leave empty for general expenses)">
          <select
            className={inputClass}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">General — no project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor">
            <input className={inputClass} value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <Field label="Payment status">
            <select
              className={inputClass}
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as "unpaid" | "paid")}
            >
              {PAYMENT_STATUS_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value === "paid" ? "Paid" : "Unpaid"}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {paymentStatus === "paid" ? (
          <Field label="Paid on (optional — defaults to expense date in cash views)">
            <input
              type="date"
              className={inputClass}
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Receipt reference">
            <input
              className={inputClass}
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Unpaid expenses are shown as committed spend and never count as cash outflow.
        </p>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Profile dialog (project contract)
// ---------------------------------------------------------------------------

export function ProfileDialog({
  projectId,
  profile,
  onClose,
}: {
  projectId: string;
  profile?: ProjectFinanceProfile | null;
  onClose: () => void;
}) {
  const finance = useFinanceSafe();
  const [contractValue, setContractValue] = useState(
    profile ? minorToDecimalString(profile.contractValueMinor) : "",
  );
  const [currency, setCurrency] = useState<Currency>(profile?.currency ?? "EGP");
  const [contractDate, setContractDate] = useState(profile?.contractDate ?? todayISO());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    profile?.expectedDeliveryDate ?? "",
  );
  const [paymentTerms, setPaymentTerms] = useState(profile?.paymentTerms ?? "");
  const [agreementNotes, setAgreementNotes] = useState(profile?.agreementNotes ?? "");
  const [error, setError] = useState<string | null>(null);

  const parsedValue = parseAmountToMinor(contractValue);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (Number.isNaN(parsedValue)) {
      setError("Enter a valid contract value, e.g. 25000 or 25000.50");
      return;
    }
    const input: ProfileInput = {
      projectId,
      contractValueMinor: parsedValue,
      currency,
      contractDate,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      paymentTerms,
      agreementNotes,
    };
    const result = validateProfileInput(input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      finance.saveProfile(input);
      onClose();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <Modal
      title="Project contract"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="subtle" onClick={handleSubmit}>
            Save contract
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contract value">
            <input
              className={inputClass}
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>
          <Field label="Currency">
            <select
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {CURRENCY_CHOICES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contract date">
            <input
              type="date"
              className={inputClass}
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
            />
          </Field>
          <Field label="Expected delivery (optional)">
            <input
              type="date"
              className={inputClass}
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Payment terms">
          <input
            className={inputClass}
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="e.g. 30% upfront, 40% mid, 30% on delivery"
          />
        </Field>
        <Field label="Agreement notes">
          <input
            className={inputClass}
            value={agreementNotes}
            onChange={(e) => setAgreementNotes(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reason dialog (destructive finance actions always require confirmation)
// ---------------------------------------------------------------------------

export function ReasonDialog({
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a short reason for the audit trail.");
      return;
    }
    try {
      onConfirm(reason);
      onClose();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant={destructive ? "outline" : "subtle"}
            className={destructive ? "text-destructive" : undefined}
            onClick={handleSubmit}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />
        <p className="text-sm text-muted-foreground">{description}</p>
        <Field label="Reason">
          <textarea
            className={`${inputClass} h-20 py-2`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          The record is kept for the audit trail and excluded from all authoritative totals.
        </p>
      </form>
    </Modal>
  );
}