"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceExpense, FinanceObligation } from "@/types/finance";
import {
  computeFinanceKpis,
  formatMinorAmount,
  formatPercent,
  todayISO,
  type FinanceCalcFilters,
} from "@/lib/finance-calculations";
import { useFinanceBridge } from "@/lib/finance-context";
import {
  ExpenseDialog,
  ObligationDialog,
  ProfileDialog,
  ReasonDialog,
  TransactionDialog,
} from "@/components/finance/finance-dialogs";
import {
  ExpensesTable,
  ObligationsTable,
  TransactionsTable,
} from "@/components/finance/finance-tables";

type ReasonRequest =
  | { kind: "cancel-obligation"; id: string; title: string }
  | { kind: "void-transaction"; id: string; title: string }
  | { kind: "void-expense"; id: string; title: string };

export interface ProjectFinanceSectionProps {
  projectId?: string;
  project?: { id: string; name?: string; title?: string } | null;
  projectName?: string;
  className?: string;
}

export function ProjectFinanceSection({
  projectId,
  project,
  projectName,
  className,
}: ProjectFinanceSectionProps) {
  const resolvedId = project?.id ?? projectId ?? "";
  const resolvedName = projectName ?? project?.name ?? project?.title ?? resolvedId;
  const today = useMemo(() => todayISO(), []);
  const bridge = useFinanceBridge(resolvedId || null);
  const finance = bridge.finance;

  const [obligationDialog, setObligationDialog] = useState<
    { open: boolean; target: FinanceObligation | null }
  >({ open: false, target: null });
  const [expenseDialog, setExpenseDialog] = useState<
    { open: boolean; target: FinanceExpense | null }
  >({ open: false, target: null });
  const [paymentFor, setPaymentFor] = useState<FinanceObligation | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reason, setReason] = useState<ReasonRequest | null>(null);

  const filters = useMemo<FinanceCalcFilters>(
    () => ({ projectId: resolvedId || null }),
    [resolvedId],
  );

  const workspace = useMemo(
    () => ({
      obligations: finance.obligations,
      transactions: finance.transactions,
      expenses: finance.expenses,
      profiles: finance.profiles,
    }),
    [finance.obligations, finance.transactions, finance.expenses, finance.profiles],
  );

  const kpis = useMemo(
    () => computeFinanceKpis(workspace, filters, today),
    [workspace, filters, today],
  );

  const projectObligations = useMemo(
    () => finance.obligations.filter((o) => o.projectId === resolvedId),
    [finance.obligations, resolvedId],
  );
  const projectTransactions = useMemo(
    () => finance.transactions.filter((t) => t.projectId === resolvedId),
    [finance.transactions, resolvedId],
  );
  const projectExpenses = useMemo(
    () => finance.expenses.filter((e) => e.projectId === resolvedId),
    [finance.expenses, resolvedId],
  );
  const profile = useMemo(
    () => finance.profiles.find((p) => p.projectId === resolvedId) ?? null,
    [finance.profiles, resolvedId],
  );

  const tableProjects = bridge.projectOptions;

  const confirmReason = (reasonText: string) => {
    if (!reason) return;
    if (reason.kind === "cancel-obligation") finance.cancelObligation(reason.id, reasonText);
    if (reason.kind === "void-transaction") finance.voidTransaction(reason.id, reasonText);
    if (reason.kind === "void-expense") finance.voidExpense(reason.id, reasonText);
  };

  if (!resolvedId) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">
          Finance section needs a project id — pass {"`projectId`"} or {"`project`"}.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Finance — {resolvedName}</h2>
          <p className="text-sm text-muted-foreground">
            Contract, obligations, payments and expenses for this project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => setProfileOpen(true)}>
            {profile ? "Edit contract" : "Set contract"}
          </Button>
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => setExpenseDialog({ open: true, target: null })}>
            Add expense
          </Button>
          <Button variant="subtle" className="h-8 px-3 text-xs" onClick={() => setObligationDialog({ open: true, target: null })}>
            Add obligation
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Contracted value</div>
          <div className="mt-1 space-y-0.5">
            {kpis.contractedValue.totals.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              kpis.contractedValue.totals.map((t) => (
                <div key={t.currency} className="text-sm font-semibold tabular-nums">
                  {formatMinorAmount(t.minor, t.currency)}
                </div>
              ))
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {kpis.contractedValue.source === "profiles"
              ? "From contract profile"
              : kpis.contractedValue.source === "mixed"
                ? "Profile + obligations fallback"
                : kpis.contractedValue.source === "obligations"
                  ? "Active obligations (no profile)"
                  : "No data"}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Collected</div>
          <div className="mt-1 space-y-0.5">
            {kpis.collected.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              kpis.collected.map((t) => (
                <div key={t.currency} className="text-sm font-semibold tabular-nums">
                  {formatMinorAmount(t.minor, t.currency)}
                </div>
              ))
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Collection rate:{" "}
            {kpis.collectionRate.length === 0
              ? "—"
              : kpis.collectionRate
                  .map((r) => `${r.currency} ${formatPercent(r.percent)}`)
                  .join(" · ")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</div>
          <div className="mt-1 space-y-0.5">
            {kpis.outstanding.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              kpis.outstanding.map((t) => (
                <div key={t.currency} className="text-sm font-semibold tabular-nums">
                  {formatMinorAmount(t.minor, t.currency)}
                </div>
              ))
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Overdue:{" "}
            {kpis.overdue.length === 0
              ? "—"
              : kpis.overdue.map((t) => formatMinorAmount(t.minor, t.currency)).join(" · ")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Expenses (paid)</div>
          <div className="mt-1 space-y-0.5">
            {kpis.expensesPaid.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              kpis.expensesPaid.map((t) => (
                <div key={t.currency} className="text-sm font-semibold tabular-nums">
                  {formatMinorAmount(t.minor, t.currency)}
                </div>
              ))
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Committed (unpaid):{" "}
            {kpis.expensesUnpaid.length === 0
              ? "—"
              : kpis.expensesUnpaid.map((t) => formatMinorAmount(t.minor, t.currency)).join(" · ")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Net cash (cash basis)</div>
          <div className="mt-1 space-y-0.5">
            {kpis.netCash.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              kpis.netCash.map((t) => (
                <div key={t.currency} className="text-sm font-semibold tabular-nums">
                  {formatMinorAmount(t.minor, t.currency)}
                </div>
              ))
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Collected − paid expenses</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Contract</div>
          <div className="mt-1 space-y-0.5 text-sm">
            <div>Currency: {profile?.currency ?? "—"}</div>
            <div className="text-muted-foreground">Signed: {profile?.contractDate ?? "—"}</div>
            <div className="text-muted-foreground">
              Delivery: {profile?.expectedDeliveryDate ?? "—"}
            </div>
          </div>
          {profile?.paymentTerms ? (
            <div className="mt-1 text-xs text-muted-foreground">Terms: {profile.paymentTerms}</div>
          ) : null}
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Obligations</h3>
        <ObligationsTable
          obligations={projectObligations}
          transactions={finance.transactions}
          projects={tableProjects}
          today={today}
          onEdit={(obligation) => setObligationDialog({ open: true, target: obligation })}
          onCancel={(obligation) =>
            setReason({ kind: "cancel-obligation", id: obligation.id, title: obligation.title })
          }
          onRecordPayment={(obligation) => setPaymentFor(obligation)}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Payments</h3>
        <TransactionsTable
          transactions={projectTransactions}
          obligations={finance.obligations}
          projects={tableProjects}
          onVoid={(transaction) =>
            setReason({ kind: "void-transaction", id: transaction.id, title: transaction.id })
          }
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Expenses</h3>
        <ExpensesTable
          expenses={projectExpenses}
          projects={tableProjects}
          onEdit={(expense) => setExpenseDialog({ open: true, target: expense })}
          onVoid={(expense) => setReason({ kind: "void-expense", id: expense.id, title: expense.description })}
        />
      </section>

      <p className="text-xs text-muted-foreground">
        Collected counts valid payments minus refunds. Cancelled obligations and voided records are
        excluded from every authoritative total. Profit is cash-basis (collected − paid expenses);
        project delivery progress is tracked separately and never mixed with financial performance.
      </p>

      {obligationDialog.open ? (
        <ObligationDialog
          projects={tableProjects}
          defaultProjectId={resolvedId}
          obligation={obligationDialog.target}
          onClose={() => setObligationDialog({ open: false, target: null })}
        />
      ) : null}
      {expenseDialog.open ? (
        <ExpenseDialog
          projects={tableProjects}
          defaultProjectId={resolvedId}
          expense={expenseDialog.target}
          onClose={() => setExpenseDialog({ open: false, target: null })}
        />
      ) : null}
      {paymentFor ? (
        <TransactionDialog obligation={paymentFor} onClose={() => setPaymentFor(null)} />
      ) : null}
      {profileOpen ? (
        <ProfileDialog projectId={resolvedId} profile={profile} onClose={() => setProfileOpen(false)} />
      ) : null}
      {reason ? (
        <ReasonDialog
          title={
            reason.kind === "cancel-obligation"
              ? `Cancel obligation: ${reason.title}`
              : reason.kind === "void-transaction"
                ? "Void transaction"
                : `Void expense: ${reason.title}`
          }
          description="This is a destructive finance action. The record stays for the audit trail but stops counting."
          confirmLabel={reason.kind === "cancel-obligation" ? "Cancel obligation" : "Void record"}
          destructive
          onConfirm={confirmReason}
          onClose={() => setReason(null)}
        />
      ) : null}
    </div>
  );
}

export default ProjectFinanceSection;