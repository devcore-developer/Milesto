import { describe, expect, it } from "vitest";
import type { FinanceExpense, FinanceObligation, FinanceTransaction } from "@/types/finance";
import {
  addMonths,
  compactPatch,
  filterExpenses,
  getCollectedTotals,
  getCollectionRate,
  getNetCashTotals,
  getObligationStatus,
  isISODate,
  monthOf,
  monthSpan,
  netPaidOf,
  parseAmountToMinor,
  remainingOf,
  sumCurrencyAmounts,
  buildMonthlyCashFlow,
  buildCumulativeCashFlow,
  type FinanceWorkspace,
} from "@/lib/finance-calculations";

let seq = 0;

function makeObligation(overrides: Partial<FinanceObligation> = {}): FinanceObligation {
  seq += 1;
  return {
    id: `o-${seq}`,
    projectId: "p1",
    title: `Obligation ${seq}`,
    description: "",
    amountMinor: 100000,
    currency: "EGP",
    dueDate: "2025-01-10",
    reference: "",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  seq += 1;
  return {
    id: `t-${seq}`,
    obligationId: "o-1",
    projectId: "p1",
    type: "payment",
    amountMinor: 10000,
    currency: "EGP",
    date: "2025-01-05",
    method: "cash",
    reference: "",
    notes: "",
    createdAt: "2025-01-05T00:00:00.000Z",
    updatedAt: "2025-01-05T00:00:00.000Z",
    ...overrides,
  };
}

function makeExpense(overrides: Partial<FinanceExpense> = {}): FinanceExpense {
  seq += 1;
  return {
    id: `e-${seq}`,
    description: `Expense ${seq}`,
    amountMinor: 5000,
    currency: "EGP",
    date: "2025-01-20",
    category: "software",
    projectId: null,
    vendor: "",
    paymentStatus: "paid",
    receiptRef: "",
    notes: "",
    createdAt: "2025-01-20T00:00:00.000Z",
    updatedAt: "2025-01-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("money parsing", () => {
  it("parses plain and decimal amounts into exact minor units", () => {
    expect(parseAmountToMinor("1200")).toBe(120000);
    expect(parseAmountToMinor("1200.5")).toBe(120050);
    expect(parseAmountToMinor("0.01")).toBe(1);
    expect(parseAmountToMinor(" 12 ")).toBe(1200);
  });

  it("rejects invalid amounts without ever throwing", () => {
    expect(parseAmountToMinor("")).toBeNaN();
    expect(parseAmountToMinor("abc")).toBeNaN();
    expect(parseAmountToMinor("-5")).toBeNaN();
    expect(parseAmountToMinor("12.345")).toBeNaN();
    expect(parseAmountToMinor("1,000")).toBeNaN();
    expect(parseAmountToMinor("100000000000")).toBeNaN();
  });
});

describe("currency sums", () => {
  it("groups per currency and never merges currencies", () => {
    const sums = sumCurrencyAmounts([
      { currency: "EGP", minor: 500 },
      { currency: "USD", minor: 200 },
      { currency: "EGP", minor: 300 },
    ]);
    expect(sums).toEqual([
      { currency: "EGP", minor: 800 },
      { currency: "USD", minor: 200 },
    ]);
  });

  it("collected totals exclude voided transactions and count refunds negatively", () => {
    const txs = [
      makeTransaction({ amountMinor: 40000, type: "payment" }),
      makeTransaction({ amountMinor: 20000, type: "payment", voidedAt: "2025-02-01T00:00:00.000Z", voidReason: "dup" }),
      makeTransaction({ amountMinor: 5000, type: "refund" }),
    ];
    expect(getCollectedTotals(txs, {})).toEqual([{ currency: "EGP", minor: 35000 }]);
  });
});

describe("obligation derived values", () => {
  const obligation = makeObligation({ amountMinor: 100000 });

  it("computes net paid ignoring voided transactions", () => {
    const txs = [
      makeTransaction({ obligationId: obligation.id, amountMinor: 40000 }),
      makeTransaction({ obligationId: obligation.id, amountMinor: 20000, voidedAt: "x", voidReason: "y" }),
      makeTransaction({ obligationId: obligation.id, amountMinor: 5000, type: "refund" }),
    ];
    expect(netPaidOf(obligation, txs)).toBe(35000);
    expect(remainingOf(obligation, txs)).toBe(65000);
  });

  it("follows the status precedence: cancelled → paid → overdue → due → partially_paid → planned", () => {
    const txs = [
      makeTransaction({ obligationId: obligation.id, amountMinor: 40000 }),
    ];
    expect(getObligationStatus(obligation, [], "2025-01-05")).toBe("planned");
    expect(getObligationStatus(obligation, txs, "2025-01-05")).toBe("partially_paid");
    expect(getObligationStatus(obligation, txs, "2025-01-10")).toBe("due");
    expect(getObligationStatus(obligation, txs, "2025-01-11")).toBe("overdue");
    expect(
      getObligationStatus(
        obligation,
        [makeTransaction({ obligationId: obligation.id, amountMinor: 100000 })],
        "2025-01-11",
      ),
    ).toBe("paid");
    expect(
      getObligationStatus(
        makeObligation({ cancelledAt: "2025-01-02T00:00:00.000Z" }),
        [],
        "2025-01-11",
      ),
    ).toBe("cancelled");
  });

  it("clamps remaining at zero when refunds exceed payments", () => {
    const txs = [makeTransaction({ obligationId: obligation.id, amountMinor: 120000, type: "refund" })];
    expect(remainingOf(obligation, txs)).toBe(0);
  });
});

describe("filters", () => {
  it("filters expenses by project, keeping general expenses only in the unfiltered view", () => {
    const expenses = [
      makeExpense({ projectId: "p1" }),
      makeExpense({ projectId: null }),
      makeExpense({ projectId: "p2" }),
    ];
    expect(filterExpenses(expenses, { projectId: "p1" })).toHaveLength(1);
    expect(filterExpenses(expenses, {})).toHaveLength(3);
  });

  it("applies date ranges inclusively", () => {
    const txs = [
      makeTransaction({ date: "2025-01-01" }),
      makeTransaction({ date: "2025-01-15" }),
      makeTransaction({ date: "2025-01-31" }),
    ];
    expect(getCollectedTotals(txs, { fromDate: "2025-01-15", toDate: "2025-01-31" })[0].minor).toBe(
      20000,
    );
  });
});

describe("monthly cash flow", () => {
  it("counts paid expenses only and never treats unpaid expenses as cash out", () => {
    const workspace: FinanceWorkspace = {
      obligations: [],
      transactions: [
        makeTransaction({ obligationId: "x", date: "2025-01-15", amountMinor: 50000 }),
        makeTransaction({ obligationId: "x", date: "2025-02-01", amountMinor: 20000 }),
        makeTransaction({ obligationId: "x", date: "2025-02-10", amountMinor: 5000, type: "refund" }),
      ],
      expenses: [
        makeExpense({ paymentStatus: "paid", date: "2025-01-20", paidOn: "2025-01-21", amountMinor: 30000 }),
        makeExpense({ paymentStatus: "unpaid", date: "2025-01-25", amountMinor: 7000 }),
        makeExpense({ paymentStatus: "paid", date: "2025-03-05", amountMinor: 10000, currency: "USD" }),
      ],
      profiles: [],
    };
    const rows = buildMonthlyCashFlow(workspace, {});
    expect(rows).toEqual([
      { month: "2025-01", currency: "EGP", collectedMinor: 50000, paidExpenseMinor: 30000, netMinor: 20000 },
      { month: "2025-02", currency: "EGP", collectedMinor: 15000, paidExpenseMinor: 0, netMinor: 15000 },
      { month: "2025-03", currency: "USD", collectedMinor: 0, paidExpenseMinor: 10000, netMinor: -10000 },
    ]);
    const cumulative = buildCumulativeCashFlow(rows);
    expect(cumulative.map((c) => c.cumulativeNetMinor)).toEqual([20000, 35000, -10000]);
  });
});

describe("misc helpers", () => {
  it("validates ISO dates including leap years", () => {
    expect(isISODate("2024-02-29")).toBe(true);
    expect(isISODate("2023-02-29")).toBe(false);
    expect(isISODate("2025-04-31")).toBe(false);
    expect(isISODate("2025-13-01")).toBe(false);
  });

  it("moves months across year boundaries", () => {
    expect(addMonths("2024-12", 1)).toBe("2025-01");
    expect(addMonths("2024-01", -1)).toBe("2023-12");
    expect(monthOf("2025-03-15")).toBe("2025-03");
    expect(monthSpan("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthSpan("2025-03", "2025-01")).toEqual([]);
  });

  it("computes collection rate with a null guard for zero invoiced", () => {
    expect(getCollectionRate([{ currency: "USD", minor: 50000 }], [{ currency: "USD", minor: 100000 }])).toEqual([
      { currency: "USD", percent: 50 },
    ]);
    expect(getCollectionRate([{ currency: "USD", minor: 100 }], [{ currency: "USD", minor: 0 }])).toEqual([
      { currency: "USD", percent: null },
    ]);
  });

  it("computes net cash as collected minus paid expenses", () => {
    const net = getNetCashTotals(
      [makeTransaction({ amountMinor: 60000 })],
      [makeExpense({ paymentStatus: "paid", amountMinor: 15000 }), makeExpense({ paymentStatus: "unpaid", amountMinor: 9999 })],
      {},
    );
    expect(net).toEqual([{ currency: "EGP", minor: 45000 }]);
  });

  it("compactPatch drops undefined but keeps null and falsy values", () => {
    expect(compactPatch({ a: undefined, b: null, c: 0, d: "" })).toEqual({ b: null, c: 0, d: "" });
  });
});