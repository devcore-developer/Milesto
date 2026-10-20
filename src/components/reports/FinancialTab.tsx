"use client";

import { Wallet } from "lucide-react";
import { useFinance } from "@/lib/finance-context";
import { useReports } from "@/providers/ReportsProvider";
import {
  formatMoney,
  monthlySeries,
  projectFinanceRows,
  todayISO,
  type ReportFilters,
  type Row,
} from "@/lib/report-insights";

type Props = { filters?: ReportFilters; className?: string };

export function FinancialTab(props: Props = {}) {
  const fin = useFinance() as unknown as Record<string, any>;
  const rep = useReports() as unknown as Record<string, any>;
  const today = todayISO();

  const projects: Row[] = Array.isArray(rep?.projects) ? rep.projects : [];
  const expensesAll: Row[] = Array.isArray(fin?.expenses)
    ? fin.expenses
    : Array.isArray(fin?.expenseList)
      ? fin.expenseList
      : [];
  const obligationsAll: Row[] = Array.isArray(fin?.obligations)
    ? fin.obligations
    : Array.isArray(fin?.paymentObligations)
      ? fin.paymentObligations
      : [];

  const pid = props.filters?.projectId;
  const expenses = pid ? expensesAll.filter((e) => String(e?.projectId ?? e?.project_id ?? "") === pid) : expensesAll;
  const obligations = pid
    ? obligationsAll.filter((o) => String(o?.projectId ?? o?.project_id ?? "") === pid)
    : obligationsAll;

  const rows = projectFinanceRows(projects, expenses, obligations);
  const series = monthlySeries(expenses, 6, today);
  const maxMinor = Math.max(1, ...series.map((s) => s.totalMinor));

  const totals = rows.reduce(
    (acc, r) => ({
      expenses: acc.expenses + r.expensesTotalMinor,
      obligations: acc.obligations + r.obligationsTotalMinor,
      remaining: acc.remaining + r.obligationsRemainingMinor,
    }),
    { expenses: 0, obligations: 0, remaining: 0 },
  );

  return (
    <div className={props.className ?? "space-y-4"}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-4 w-4" />
            إجمالي المصروفات
          </div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(totals.expenses)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">إجمالي الالتزامات</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(totals.obligations)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">المتبقي غير المسدّد</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(totals.remaining)}</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-3 text-sm font-semibold">المصروفات آخر 6 شهور</h3>
        <div className="flex h-32 items-end gap-2">
          {series.map((s) => (
            <div key={s.month} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-sky-500"
                style={{ height: `${Math.max(4, (s.totalMinor / maxMinor) * 100)}%` }}
                title={formatMoney(s.totalMinor)}
              />
              <span className="text-[10px] text-muted-foreground">{s.month.slice(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="p-2 text-start">المشروع</th>
              <th className="p-2 text-start">المصروفات</th>
              <th className="p-2 text-start">الالتزامات</th>
              <th className="p-2 text-start">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.projectId} className="border-t border-border">
                <td className="p-2 font-medium">{r.projectName}</td>
                <td className="p-2">{formatMoney(r.expensesTotalMinor, r.currency)}</td>
                <td className="p-2">{formatMoney(r.obligationsTotalMinor, r.currency)}</td>
                <td className="p-2">{formatMoney(r.obligationsRemainingMinor, r.currency)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                  مفيش بيانات مالية مرتبطة بمشاريع لسه.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FinancialTab;