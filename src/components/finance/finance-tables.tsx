"use client";

import { useMemo, useState } from "react";
import { Badge, type StatusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  FinanceExpense,
  FinanceObligation,
  FinanceTransaction,
} from "@/types/finance";
import {
  formatDate,
  formatMinorAmount,
  getObligationStatus,
  netPaidOf,
  remainingOf,
} from "@/lib/finance-calculations";
import { resolveProjectName, type ProjectRef } from "@/components/finance/project-lookup";

const PAGE_SIZE = 8;

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  card: "Card",
  cheque: "Cheque",
  other: "Other",
};

const CATEGORY_LABELS: Record<string, string> = {
  hosting: "Hosting",
  domain: "Domain",
  software: "Software",
  contractor: "Contractor",
  marketing: "Marketing",
  infrastructure: "Infrastructure",
  other: "Other",
};

const STATUS_META: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  cancelled: { label: "Cancelled", variant: "danger" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "danger" },
  due: { label: "Due today", variant: "warning" },
  partially_paid: { label: "Partially paid", variant: "info" },
  planned: { label: "Planned", variant: "neutral" },
};

const TX_TYPE_META: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  payment: { label: "Payment", variant: "success" },
  refund: { label: "Refund", variant: "warning" },
};

const PAY_STATUS_META: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  paid: { label: "Paid", variant: "success" },
  unpaid: { label: "Unpaid", variant: "warning" },
};

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-medium hover:underline"
    >
      {label}
      {active ? (direction === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-muted-foreground">
      <span>
        Page {pageCount === 0 ? 0 : page + 1} of {pageCount}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Obligations
// ---------------------------------------------------------------------------

type ObligationSortKey = "dueDate" | "amountMinor" | "title" | "status";

export function ObligationsTable({
  obligations,
  transactions,
  projects,
  today,
  onEdit,
  onCancel,
  onRecordPayment,
}: {
  obligations: readonly FinanceObligation[];
  transactions: readonly FinanceTransaction[];
  projects: readonly ProjectRef[];
  today: string;
  onEdit: (obligation: FinanceObligation) => void;
  onCancel: (obligation: FinanceObligation) => void;
  onRecordPayment: (obligation: FinanceObligation) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ObligationSortKey>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = obligations.filter((o) => {
      if (statusFilter !== "all" && getObligationStatus(o, transactions, today) !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        o.title.toLowerCase().includes(needle) ||
        (o.description ?? "").toLowerCase().includes(needle) ||
        (o.reference ?? "").toLowerCase().includes(needle)
      );
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a: FinanceObligation, b: FinanceObligation) => {
      if (sortKey === "title") return a.title.localeCompare(b.title) * direction;
      if (sortKey === "amountMinor") return (a.amountMinor - b.amountMinor) * direction;
      if (sortKey === "status") {
        return (
          getObligationStatus(a, transactions, today).localeCompare(
            getObligationStatus(b, transactions, today),
          ) * direction
        );
      }
      return (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) * direction;
    });
  }, [obligations, transactions, today, search, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: ObligationSortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <input
          className="h-8 w-56 rounded-md border bg-background px-3 text-sm"
          placeholder="Search obligations…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} record(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <SortHeader label="Title" active={sortKey === "title"} direction={sortDir} onClick={() => toggleSort("title")} />
              </th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">
                <SortHeader label="Amount" active={sortKey === "amountMinor"} direction={sortDir} onClick={() => toggleSort("amountMinor")} />
              </th>
              <th className="px-3 py-2">Net paid</th>
              <th className="px-3 py-2">Remaining</th>
              <th className="px-3 py-2">
                <SortHeader label="Due" active={sortKey === "dueDate"} direction={sortDir} onClick={() => toggleSort("dueDate")} />
              </th>
              <th className="px-3 py-2">
                <SortHeader label="Status" active={sortKey === "status"} direction={sortDir} onClick={() => toggleSort("status")} />
              </th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No obligations yet — add the first payment milestone.
                </td>
              </tr>
            ) : (
              visible.map((obligation) => {
                const status = getObligationStatus(obligation, transactions, today);
                const meta = STATUS_META[status] ?? { label: status, variant: "neutral" as StatusBadgeVariant };
                const cancelled = Boolean(obligation.cancelledAt);
                return (
                  <tr
                    key={obligation.id}
                    className={`border-t ${cancelled ? "opacity-60" : ""}`}
                    title={obligation.cancelNote ? `Cancelled: ${obligation.cancelNote}` : undefined}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{obligation.title}</div>
                      {obligation.reference ? (
                        <div className="text-xs text-muted-foreground">Ref: {obligation.reference}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {resolveProjectName(projects, obligation.projectId) ?? obligation.projectId}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMinorAmount(obligation.amountMinor, obligation.currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {formatMinorAmount(netPaidOf(obligation, transactions), obligation.currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMinorAmount(remainingOf(obligation, transactions), obligation.currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(obligation.dueDate)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {!cancelled ? (
                          <>
                            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => onRecordPayment(obligation)}>
                              Record payment
                            </Button>
                            <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => onEdit(obligation)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              onClick={() => onCancel(obligation)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

type TransactionSortKey = "date" | "amountMinor" | "type";

export function TransactionsTable({
  transactions,
  obligations,
  projects,
  onVoid,
}: {
  transactions: readonly FinanceTransaction[];
  obligations: readonly FinanceObligation[];
  projects: readonly ProjectRef[];
  onVoid: (transaction: FinanceTransaction) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<TransactionSortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of obligations) map.set(o.id, o.title);
    return map;
  }, [obligations]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (!needle) return true;
      const title = titleById.get(tx.obligationId) ?? "";
      return (
        title.toLowerCase().includes(needle) ||
        (tx.reference ?? "").toLowerCase().includes(needle) ||
        (tx.notes ?? "").toLowerCase().includes(needle)
      );
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a: FinanceTransaction, b: FinanceTransaction) => {
      if (sortKey === "amountMinor") return (a.amountMinor - b.amountMinor) * direction;
      if (sortKey === "type") return a.type.localeCompare(b.type) * direction;
      return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) * direction;
    });
  }, [transactions, titleById, search, typeFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: TransactionSortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <input
          className="h-8 w-56 rounded-md border bg-background px-3 text-sm"
          placeholder="Search payments…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All types</option>
          <option value="payment">Payment</option>
          <option value="refund">Refund</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} record(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Obligation</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">
                <SortHeader label="Type" active={sortKey === "type"} direction={sortDir} onClick={() => toggleSort("type")} />
              </th>
              <th className="px-3 py-2">
                <SortHeader label="Amount" active={sortKey === "amountMinor"} direction={sortDir} onClick={() => toggleSort("amountMinor")} />
              </th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">
                <SortHeader label="Date" active={sortKey === "date"} direction={sortDir} onClick={() => toggleSort("date")} />
              </th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No transactions yet — record a payment from an obligation row.
                </td>
              </tr>
            ) : (
              visible.map((tx) => {
                const typeMeta = TX_TYPE_META[tx.type] ?? { label: tx.type, variant: "neutral" as StatusBadgeVariant };
                return (
                  <tr
                    key={tx.id}
                    className={`border-t ${tx.voidedAt ? "opacity-60" : ""}`}
                    title={tx.voidReason ? `Voided: ${tx.voidReason}` : undefined}
                  >
                    <td className="px-3 py-2 font-medium">{titleById.get(tx.obligationId) ?? tx.obligationId}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {resolveProjectName(projects, tx.projectId) ?? tx.projectId}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMinorAmount(tx.amountMinor, tx.currency)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {METHOD_LABELS[tx.method] ?? tx.method}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(tx.date)}</td>
                    <td className="px-3 py-2">
                      {tx.voidedAt ? (
                        <Badge variant="neutral">Voided</Badge>
                      ) : (
                        <Badge variant="success">Valid</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        {!tx.voidedAt ? (
                          <Button
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive"
                            onClick={() => onVoid(tx)}
                          >
                            Void
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

type ExpenseSortKey = "date" | "amountMinor" | "description";

export function ExpensesTable({
  expenses,
  projects,
  onEdit,
  onVoid,
}: {
  expenses: readonly FinanceExpense[];
  projects: readonly ProjectRef[];
  onEdit: (expense: FinanceExpense) => void;
  onVoid: (expense: FinanceExpense) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ExpenseSortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = expenses.filter((expense) => {
      if (categoryFilter !== "all" && expense.category !== categoryFilter) return false;
      if (statusFilter !== "all" && expense.paymentStatus !== statusFilter) return false;
      if (!needle) return true;
      return (
        expense.description.toLowerCase().includes(needle) ||
        (expense.vendor ?? "").toLowerCase().includes(needle) ||
        (expense.receiptRef ?? "").toLowerCase().includes(needle)
      );
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a: FinanceExpense, b: FinanceExpense) => {
      if (sortKey === "amountMinor") return (a.amountMinor - b.amountMinor) * direction;
      if (sortKey === "description") return a.description.localeCompare(b.description) * direction;
      return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) * direction;
    });
  }, [expenses, search, categoryFilter, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: ExpenseSortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <input
          className="h-8 w-56 rounded-md border bg-background px-3 text-sm"
          placeholder="Search expenses…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Paid & unpaid</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} record(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <SortHeader label="Description" active={sortKey === "description"} direction={sortDir} onClick={() => toggleSort("description")} />
              </th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">
                <SortHeader label="Amount" active={sortKey === "amountMinor"} direction={sortDir} onClick={() => toggleSort("amountMinor")} />
              </th>
              <th className="px-3 py-2">
                <SortHeader label="Date" active={sortKey === "date"} direction={sortDir} onClick={() => toggleSort("date")} />
              </th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No expenses yet — add the first expense record.
                </td>
              </tr>
            ) : (
              visible.map((expense) => {
                const payMeta =
                  PAY_STATUS_META[expense.paymentStatus] ??
                  ({ label: expense.paymentStatus, variant: "neutral" as StatusBadgeVariant });
                return (
                  <tr
                    key={expense.id}
                    className={`border-t ${expense.voidedAt ? "opacity-60" : ""}`}
                    title={expense.voidReason ? `Voided: ${expense.voidReason}` : undefined}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{expense.description}</div>
                      {expense.vendor ? (
                        <div className="text-xs text-muted-foreground">{expense.vendor}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {expense.projectId
                        ? resolveProjectName(projects, expense.projectId) ?? expense.projectId
                        : "General"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {CATEGORY_LABELS[expense.category] ?? expense.category}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMinorAmount(expense.amountMinor, expense.currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatDate(expense.date)}
                      {expense.paidOn ? (
                        <div className="text-xs text-muted-foreground">Paid on {expense.paidOn}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Badge variant={payMeta.variant}>{payMeta.label}</Badge>
                        {expense.voidedAt ? <Badge variant="neutral">Voided</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {!expense.voidedAt ? (
                          <>
                            <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => onEdit(expense)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              onClick={() => onVoid(expense)}
                            >
                              Void
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
    </div>
  );
}