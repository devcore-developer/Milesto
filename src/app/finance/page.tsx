"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceExpense, FinanceObligation } from "@/types/finance";
import {
  buildCumulativeCashFlow,
  buildMonthlyCashFlow,
  buildProjectFinanceRows,
  collectCurrencies,
  computeFinanceKpis,
  formatMinorAmount,
  formatPercent,
  todayISO,
  type CumulativeCashPoint,
  type CurrencyTotals,
  type FinanceCalcFilters,
  type FinanceWorkspace,
  type MonthlyCashPoint,
  type ProjectFinanceRow,
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

type TabKey = "obligations" | "transactions" | "expenses";

type ReasonRequest =
  | { kind: "cancel-obligation"; id: string; title: string }
  | { kind: "void-transaction"; id: string; title: string }
  | { kind: "void-expense"; id: string; title: string };

function toCalcFilters(state: { projectId: string; fromDate: string; toDate: string }): FinanceCalcFilters {
  return {
    projectId: state.projectId || null,
    fromDate: state.fromDate || null,
    toDate: state.toDate || null,
  };
}

function AmountLines({ totals }: { totals: readonly CurrencyTotals[] }) {
  if (totals.length === 0) {
    return <div className="text-sm font-semibold text-muted-foreground">—</div>;
  }
  return (
    <div className="space-y-0.5">
      {totals.map((t) => (
        <div key={t.currency} className="text-sm font-semibold tabular-nums">
          {formatMinorAmount(t.minor, t.currency)}
        </div>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function BarList({
  items,
}: {
  items: { label: string; value: number; display: string }[];
}) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No data for the selected range.</div>;
  }
  const maxAbs = items.reduce((m, i) => Math.max(m, Math.abs(i.value)), 0) || 1;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{item.label}</span>
            <span className="tabular-nums text-muted-foreground">{item.display}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${item.value < 0 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${Math.max(2, (Math.abs(item.value) / maxAbs) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthlyBars({ points }: { points: MonthlyCashPoint[] }) {
  if (points.length === 0) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No monthly activity yet.</div>;
  }
  const months = [...new Set(points.map((p) => p.month))].sort();
  const maxAbs =
    points.reduce((m, p) => Math.max(m, Math.abs(p.collectedMinor), Math.abs(p.paidExpenseMinor)), 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4 overflow-x-auto pb-1">
        {months.map((month) => {
          const row = points.find((p) => p.month === month);
          const collected = row?.collectedMinor ?? 0;
          const paid = row?.paidExpenseMinor ?? 0;
          return (
            <div key={month} className="flex w-16 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-1">
                <div
                  className="w-5 rounded-t bg-primary"
                  style={{ height: `${Math.max(2, (Math.abs(collected) / maxAbs) * 100)}%` }}
                  title={`Collected ${formatMinorAmount(collected, points[0]?.currency ?? "EGP")}`}
                />
                <div
                  className="w-5 rounded-t bg-destructive"
                  style={{ height: `${Math.max(2, (Math.abs(paid) / maxAbs) * 100)}%` }}
                  title={`Expenses ${formatMinorAmount(paid, points[0]?.currency ?? "EGP")}`}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground">{month}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Collected
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-destructive" /> Paid expenses
        </span>
      </div>
    </div>
  );
}

function CumulativeLine({ points }: { points: CumulativeCashPoint[] }) {
  if (points.length === 0) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No cash-flow timeline yet.</div>;
  }
  const values = points.map((p) => p.cumulativeNetMinor);
  const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const coords = values.map((v, i) => {
    const x = points.length === 1 ? 50 : (i / (points.length - 1)) * 100;
    const y = 50 - (v / maxAbs) * 45;
    return `${x},${y}`;
  });
  return (
    <div className="space-y-2">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-28 w-full rounded-md border bg-muted/30">
        <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeDasharray="2 2" className="text-muted-foreground/40" strokeWidth="0.5" />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{points[0]?.month}</span>
        <span>{points[points.length - 1]?.month}</span>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const today = useMemo(() => todayISO(), []);
  const bridge = useFinanceBridge(null);
  const finance = bridge.finance;

  const [filterState, setFilterState] = useState({ projectId: "", fromDate: "", toDate: "" });
  const [tab, setTab] = useState<TabKey>("obligations");
  const [chartCurrency, setChartCurrency] = useState<string>("");
  const [obligationDialog, setObligationDialog] = useState<
    { open: boolean; target: FinanceObligation | null }
  >({ open: false, target: null });
  const [expenseDialog, setExpenseDialog] = useState<
    { open: boolean; target: FinanceExpense | null }
  >({ open: false, target: null });
  const [paymentFor, setPaymentFor] = useState<FinanceObligation | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reason, setReason] = useState<ReasonRequest | null>(null);

  const filters = useMemo(() => toCalcFilters(filterState), [filterState]);

  const workspace = useMemo<FinanceWorkspace>(
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
  const projectRows = useMemo(
    () => buildProjectFinanceRows(workspace, filters, today),
    [workspace, filters, today],
  );
  const monthly = useMemo(() => buildMonthlyCashFlow(workspace, filters), [workspace, filters]);
  const cumulative = useMemo(() => buildCumulativeCashFlow(monthly), [monthly]);

  const currencies = useMemo(
    () =>
      collectCurrencies(
        kpis.collected,
        kpis.invoiced,
        kpis.outstanding,
        kpis.expensesPaid,
        kpis.netCash,
        kpis.overdue,
        kpis.dueThisMonth,
      ),
    [kpis],
  );
  const activeCurrency = currencies.includes(chartCurrency as never)
    ? (chartCurrency as (typeof currencies)[number])
    : currencies[0];

  const monthlyForCurrency = useMemo(
    () => monthly.filter((p) => p.currency === activeCurrency),
    [monthly, activeCurrency],
  );
  const cumulativeForCurrency = useMemo(
    () => cumulative.filter((p) => p.currency === activeCurrency),
    [cumulative, activeCurrency],
  );
  const rowsForCurrency = useMemo(
    () => projectRows.filter((r) => r.currency === activeCurrency),
    [projectRows, activeCurrency],
  );

  const isEmpty =
    finance.obligations.length === 0 &&
    finance.transactions.length === 0 &&
    finance.expenses.length === 0 &&
    finance.profiles.length === 0;

  const confirmReason = (reasonText: string) => {
    if (!reason) return;
    if (reason.kind === "cancel-obligation") finance.cancelObligation(reason.id, reasonText);
    if (reason.kind === "void-transaction") finance.voidTransaction(reason.id, reasonText);
    if (reason.kind === "void-expense") finance.voidExpense(reason.id, reasonText);
  };

  const rateLine = (rows: typeof kpis.collectionRate) =>
    rows.length === 0
      ? "—"
      : rows.map((r) => `${r.currency} ${formatPercent(r.percent)}`).join(" · ");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Every figure comes from real stored records — nothing is estimated or fabricated.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => setExpenseDialog({ open: true, target: null })}>
            Add expense
          </Button>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => setProfileOpen(true)}
            disabled={!filterState.projectId}
          >
            Manage contract
          </Button>
          <Button variant="subtle" className="h-8 px-3 text-xs" onClick={() => setObligationDialog({ open: true, target: null })}>
            Add obligation
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h2 className="text-lg font-semibold">No finance data yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Start by adding a payment obligation for one of your projects, or record your first
            expense. The seed data is intentionally empty — every KPI you see will come from real
            records you create.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="subtle" className="h-8 px-3 text-xs" onClick={() => setObligationDialog({ open: true, target: null })}>
              Add obligation
            </Button>
            <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => setExpenseDialog({ open: true, target: null })}>
              Add expense
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Project</span>
          <select
            className="h-8 w-56 rounded-md border bg-background px-2 text-sm"
            value={filterState.projectId}
            onChange={(e) => setFilterState({ ...filterState, projectId: e.target.value })}
          >
            <option value="">All projects</option>
            {bridge.projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">From</span>
          <input
            type="date"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={filterState.fromDate}
            onChange={(e) => setFilterState({ ...filterState, fromDate: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">To</span>
          <input
            type="date"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={filterState.toDate}
            onChange={(e) => setFilterState({ ...filterState, toDate: e.target.value })}
          />
        </label>
        <Button
          variant="ghost"
          className="h-8 px-3 text-xs"
          onClick={() => setFilterState({ projectId: "", fromDate: "", toDate: "" })}
        >
          Clear filters
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Contracted value"
          hint={
            kpis.contractedValue.source === "profiles"
              ? "From contract profiles"
              : kpis.contractedValue.source === "mixed"
                ? "Profiles + obligations fallback"
                : kpis.contractedValue.source === "obligations"
                  ? "Active obligations (no profile)"
                  : "No data"
          }
        >
          <AmountLines totals={kpis.contractedValue.totals} />
        </KpiCard>
        <KpiCard label="Collected" hint="Valid payments − refunds">
          <AmountLines totals={kpis.collected} />
        </KpiCard>
        <KpiCard label="Outstanding" hint="Remaining on active obligations">
          <AmountLines totals={kpis.outstanding} />
        </KpiCard>
        <KpiCard label="Overdue" hint="Past-due remaining">
          <AmountLines totals={kpis.overdue} />
        </KpiCard>
        <KpiCard label="Due this month" hint="Upcoming, current month">
          <AmountLines totals={kpis.dueThisMonth} />
        </KpiCard>
        <KpiCard
          label="Expenses (paid)"
          hint={
            kpis.expensesUnpaid.length === 0
              ? "Committed (unpaid): —"
              : `Committed (unpaid): ${kpis.expensesUnpaid
                  .map((t) => formatMinorAmount(t.minor, t.currency))
                  .join(" · ")}`
          }
        >
          <AmountLines totals={kpis.expensesPaid} />
        </KpiCard>
        <KpiCard label="Net cash" hint="Cash basis: collected − paid expenses">
          <AmountLines totals={kpis.netCash} />
        </KpiCard>
        <KpiCard label="Collection rate" hint="Collected ÷ invoiced per currency">
          <div className="text-sm font-semibold tabular-nums">{rateLine(kpis.collectionRate)}</div>
        </KpiCard>
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Charts</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Currency</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={activeCurrency ?? ""}
              onChange={(e) => setChartCurrency(e.target.value)}
              disabled={currencies.length === 0}
            >
              {currencies.length === 0 ? <option value="">—</option> : null}
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Collected vs outstanding ({activeCurrency ?? "—"})
            </h3>
            <BarList
              items={[
                {
                  label: "Collected",
                  value: kpis.collected.find((t) => t.currency === activeCurrency)?.minor ?? 0,
                  display: formatMinorAmount(
                    kpis.collected.find((t) => t.currency === activeCurrency)?.minor ?? 0,
                    activeCurrency ?? "EGP",
                  ),
                },
                {
                  label: "Outstanding",
                  value: kpis.outstanding.find((t) => t.currency === activeCurrency)?.minor ?? 0,
                  display: formatMinorAmount(
                    kpis.outstanding.find((t) => t.currency === activeCurrency)?.minor ?? 0,
                    activeCurrency ?? "EGP",
                  ),
                },
              ]}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Monthly income vs expenses ({activeCurrency ?? "—"})
            </h3>
            <MonthlyBars points={monthlyForCurrency} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cumulative net cash flow ({activeCurrency ?? "—"})
            </h3>
            <CumulativeLine points={cumulativeForCurrency} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Collected by project ({activeCurrency ?? "—"})
            </h3>
            <BarList
              items={rowsForCurrency.map((row: ProjectFinanceRow) => ({
                label: bridge.resolveProjectName(row.projectId),
                value: row.collectedMinor,
                display: formatMinorAmount(row.collectedMinor, row.currency),
              }))}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Outstanding by project ({activeCurrency ?? "—"})
            </h3>
            <BarList
              items={rowsForCurrency.map((row: ProjectFinanceRow) => ({
                label: bridge.resolveProjectName(row.projectId),
                value: row.outstandingMinor,
                display: formatMinorAmount(row.outstandingMinor, row.currency),
              }))}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Net cash by project ({activeCurrency ?? "—"})
            </h3>
            <BarList
              items={rowsForCurrency.map((row: ProjectFinanceRow) => ({
                label: bridge.resolveProjectName(row.projectId),
                value: row.netCashMinor,
                display: formatMinorAmount(row.netCashMinor, row.currency),
              }))}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["obligations", "Obligations"],
              ["transactions", "Payments"],
              ["expenses", "Expenses"],
            ] as [TabKey, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={tab === key ? "subtle" : "ghost"}
              className="h-8 px-3 text-xs"
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {tab === "obligations" ? (
          <ObligationsTable
            obligations={finance.obligations}
            transactions={finance.transactions}
            projects={bridge.projectOptions}
            today={today}
            onEdit={(obligation) => setObligationDialog({ open: true, target: obligation })}
            onCancel={(obligation) =>
              setReason({ kind: "cancel-obligation", id: obligation.id, title: obligation.title })
            }
            onRecordPayment={(obligation) => setPaymentFor(obligation)}
          />
        ) : null}
        {tab === "transactions" ? (
          <TransactionsTable
            transactions={finance.transactions}
            obligations={finance.obligations}
            projects={bridge.projectOptions}
            onVoid={(transaction) =>
              setReason({ kind: "void-transaction", id: transaction.id, title: transaction.id })
            }
          />
        ) : null}
        {tab === "expenses" ? (
          <ExpensesTable
            expenses={finance.expenses}
            projects={bridge.projectOptions}
            onEdit={(expense) => setExpenseDialog({ open: true, target: expense })}
            onVoid={(expense) =>
              setReason({ kind: "void-expense", id: expense.id, title: expense.description })
            }
          />
        ) : null}
      </section>

      <p className="text-xs text-muted-foreground">
        Definitions — Collected: valid payments minus refunds; cancelled obligations and voided
        records never count. Outstanding: remaining balance on active obligations. Net cash /
        profit: cash basis (collected − paid expenses); unpaid expenses are committed spend, never
        cash outflow. Contracted value uses project finance profiles where available, otherwise the
        sum of active obligations. Currencies are always grouped per currency and never merged.
      </p>

      {obligationDialog.open ? (
        <ObligationDialog
          projects={bridge.projectOptions}
          defaultProjectId={filterState.projectId || null}
          obligation={obligationDialog.target}
          onClose={() => setObligationDialog({ open: false, target: null })}
        />
      ) : null}
      {expenseDialog.open ? (
        <ExpenseDialog
          projects={bridge.projectOptions}
          defaultProjectId={filterState.projectId || null}
          expense={expenseDialog.target}
          onClose={() => setExpenseDialog({ open: false, target: null })}
        />
      ) : null}
      {paymentFor ? (
        <TransactionDialog obligation={paymentFor} onClose={() => setPaymentFor(null)} />
      ) : null}
      {profileOpen && filterState.projectId ? (
        <ProfileDialog
          projectId={filterState.projectId}
          profile={finance.profiles.find((p) => p.projectId === filterState.projectId) ?? null}
          onClose={() => setProfileOpen(false)}
        />
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