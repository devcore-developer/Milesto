import { describe, expect, it } from "vitest";

import { FINANCE_SEED } from "@/data/finance-data";
import {
  addSameCurrency,
  formatMinorAmount,
  minorToMajorString,
  parseAmountToMinor,
} from "@/lib/money";
import {
  getCollected,
  getCollectedByProject,
  getCollectionRate,
  getContractedValue,
  getCumulativeNetCashFlow,
  getDueThisMonthReceivables,
  getInvoicedValue,
  getMonthlyCashFlow,
  getObligationPaidMinor,
  getObligationRemainingMinor,
  getObligationStatus,
  getOutstandingReceivables,
  getOutstandingExpenses,
  getOverdueReceivables,
  getPaidExpenses,
  getProjectFinanceSummary,
  getProjectProfitComparison,
  getScheduledFutureCollections,
  isISODate,
  nextFinanceId,
  todayISO,
  validateExpenseInput,
  validateObligationInput,
  validateObligationUpdate,
  validateProfileInput,
  validateTransactionInput,
} from "@/lib/finance";
import type {
  Currency,
  CurrencyAmount,
  FinanceExpense,
  FinanceObligation,
  FinanceTransaction,
  ProjectFinanceProfile,
} from "@/types/finance";

const TODAY = "2026-10-20";

function amountOf(amounts: CurrencyAmount[], currency: Currency): number {
  const found = amounts.find((a) => a.currency === currency);
  return found ? found.minor : 0;
}

function obligation(overrides: Partial<FinanceObligation> = {}): FinanceObligation {
  return {
    id: "OB-1",
    projectId: "PRJ-001",
    title: "Milestone 1",
    amountMinor: 100_000,
    currency: "USD",
    dueDate: "2026-03-01",
    cancelledAt: null,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

function transaction(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id: "TXN-1",
    obligationId: "OB-1",
    projectId: "PRJ-001",
    type: "payment",
    amountMinor: 100_000,
    currency: "USD",
    date: "2026-03-01",
    method: "bank_transfer",
    voidedAt: null,
    createdAt: "2026-03-01T12:00:00.000Z",
    updatedAt: "2026-03-01T12:00:00.000Z",
    ...overrides,
  };
}

function expense(overrides: Partial<FinanceExpense> = {}): FinanceExpense {
  return {
    id: "EXP-1",
    description: "Hosting",
    amountMinor: 50_000,
    currency: "USD",
    date: "2026-03-02",
    category: "hosting",
    projectId: null,
    paymentStatus: "paid",
    paidOn: "2026-03-03",
    voidedAt: null,
    createdAt: "2026-03-02T12:00:00.000Z",
    updatedAt: "2026-03-02T12:00:00.000Z",
    ...overrides,
  };
}

function profile(overrides: Partial<ProjectFinanceProfile> = {}): ProjectFinanceProfile {
  return {
    projectId: "PRJ-001",
    contractValueMinor: 200_000,
    currency: "USD",
    contractDate: "2026-01-01",
    expectedDeliveryDate: null,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("money primitives", () => {
  it("parses decimal amounts into exact minor units", () => {
    expect(parseAmountToMinor("1234.56", "USD")).toBe(123_456);
    expect(parseAmountToMinor("1,234.56", "USD")).toBe(123_456);
    expect(parseAmountToMinor("0.5", "USD")).toBe(50);
    expect(parseAmountToMinor(" 72000 ", "EGP")).toBe(7_200_000);
  });

  it("rejects malformed, negative, too-precise and too-large amounts", () => {
    expect(parseAmountToMinor("-5", "USD")).toBeNull();
    expect(parseAmountToMinor("", "USD")).toBeNull();
    expect(parseAmountToMinor("abc", "USD")).toBeNull();
    expect(parseAmountToMinor("12.345", "USD")).toBeNull();
    expect(parseAmountToMinor("100000000000", "USD")).toBeNull();
  });

  it("converts minor units back to major strings and formatted labels", () => {
    expect(minorToMajorString(123_456, "USD")).toBe("1234.56");
    expect(minorToMajorString(5, "USD")).toBe("0.05");
    expect(minorToMajorString(100_000, "USD")).toBe("1000.00");
    expect(formatMinorAmount(123_456, "USD")).toBe("USD 1,234.56");
    expect(formatMinorAmount(-500, "USD")).toBe("-USD 5.00");
  });

  it("refuses to add amounts across currencies", () => {
    expect(() =>
      addSameCurrency({ currency: "USD", minor: 100 }, { currency: "EGP", minor: 200 }),
    ).toThrow();
  });
});

describe("obligation balances and derived status", () => {
  it("settles fully with one payment", () => {
    const ob = obligation();
    const txs = [transaction({ amountMinor: 100_000 })];
    expect(getObligationPaidMinor(ob, txs)).toBe(100_000);
    expect(getObligationRemainingMinor(ob, txs)).toBe(0);
    expect(getObligationStatus(ob, txs, TODAY)).toBe("paid");
  });

  it("supports several transactions settling one obligation partially", () => {
    const ob = obligation({ dueDate: "2026-11-01" });
    const txs = [
      transaction({ id: "TXN-1", amountMinor: 40_000 }),
      transaction({ id: "TXN-2", amountMinor: 35_000, date: "2026-04-01" }),
    ];
    expect(getObligationPaidMinor(ob, txs)).toBe(75_000);
    expect(getObligationRemainingMinor(ob, txs)).toBe(25_000);
    expect(getObligationStatus(ob, txs, TODAY)).toBe("partially_paid");
  });

  it("marks past-due remaining balances as overdue", () => {
    const ob = obligation({ dueDate: "2026-09-01" });
    const txs = [transaction({ amountMinor: 40_000 })];
    expect(getObligationStatus(ob, txs, TODAY)).toBe("overdue");
  });

  it("derives due/planned for unpaid obligations by due date", () => {
    expect(getObligationStatus(obligation({ dueDate: TODAY }), [], TODAY)).toBe("due");
    expect(getObligationStatus(obligation({ dueDate: "2026-12-01" }), [], TODAY)).toBe("planned");
  });

  it("keeps cancelled obligations excluded from payment states", () => {
    const ob = obligation({ cancelledAt: "2026-05-01T00:00:00.000Z" });
    expect(getObligationStatus(ob, [], TODAY)).toBe("cancelled");
  });

  it("re-opens a settled obligation after a partial refund", () => {
    const ob = obligation({ dueDate: "2026-03-01" });
    const txs = [
      transaction({ amountMinor: 100_000, date: "2026-02-01" }),
      transaction({ type: "refund", amountMinor: 25_000, date: "2026-02-10" }),
    ];
    expect(getObligationPaidMinor(ob, txs)).toBe(75_000);
    expect(getObligationStatus(ob, txs, TODAY)).toBe("overdue");
  });
});

describe("collected cash (transactions only)", () => {
  it("nets payments minus refunds and excludes voided transactions", () => {
    const txs = [
      transaction({ id: "TXN-1", amountMinor: 100_000, date: "2026-02-01" }),
      transaction({ id: "TXN-2", type: "refund", amountMinor: 20_000, date: "2026-02-10" }),
      transaction({
        id: "TXN-3",
        amountMinor: 999_999,
        date: "2026-02-15",
        voidedAt: "2026-02-16T00:00:00.000Z",
      }),
    ];
    expect(amountOf(getCollected(txs), "USD")).toBe(80_000);
  });

  it("applies project and date-range filters", () => {
    const txs = [
      transaction({ id: "TXN-1", projectId: "PRJ-001", amountMinor: 100_000, date: "2026-02-01" }),
      transaction({ id: "TXN-2", projectId: "PRJ-002", amountMinor: 30_000, date: "2026-03-01" }),
    ];
    expect(amountOf(getCollected(txs, { projectId: "PRJ-001" }), "USD")).toBe(100_000);
    expect(
      amountOf(getCollected(txs, { dateRange: { from: "2026-03-01", to: "2026-03-31" } }), "USD"),
    ).toBe(30_000);
  });

  it("keeps refund-only windows negative instead of hiding them", () => {
    const txs = [transaction({ type: "refund", amountMinor: 20_000, date: "2026-02-10" })];
    expect(
      amountOf(getCollected(txs, { dateRange: { from: "2026-02-05", to: "2026-02-28" } }), "USD"),
    ).toBe(-20_000);
  });
});

describe("receivable splits", () => {
  const obligations = [
    obligation({ id: "OB-A", amountMinor: 50_000, dueDate: "2026-09-15" }), // overdue
    obligation({ id: "OB-B", amountMinor: 80_000, dueDate: "2026-12-05" }), // partial → scheduled
    obligation({ id: "OB-C", amountMinor: 20_000, dueDate: TODAY }), // due today
    obligation({
      id: "OB-D",
      amountMinor: 70_000,
      dueDate: "2026-08-01",
      cancelledAt: "2026-07-01T00:00:00.000Z",
    }),
  ];
  const txs = [transaction({ id: "TXN-B1", obligationId: "OB-B", amountMinor: 30_000, date: "2026-06-01" })];

  it("splits outstanding money into overdue / due-today / scheduled future", () => {
    expect(amountOf(getOutstandingReceivables(obligations, txs), "USD")).toBe(120_000);
    expect(amountOf(getOverdueReceivables(obligations, txs, TODAY), "USD")).toBe(50_000);
    expect(amountOf(getDueThisMonthReceivables(obligations, txs, "2026-10"), "USD")).toBe(20_000);
    expect(amountOf(getScheduledFutureCollections(obligations, txs, TODAY), "USD")).toBe(50_000);
  });

  it("excludes cancelled obligations from every split", () => {
    expect(amountOf(getOutstandingReceivables([obligations[3]], []), "USD")).toBe(0);
  });
});

describe("expenses: cash vs committed", () => {
  const expenses = [
    expense({ id: "EXP-1", amountMinor: 50_000, paymentStatus: "paid", paidOn: "2026-03-03" }),
    expense({ id: "EXP-2", amountMinor: 30_000, paymentStatus: "unpaid", paidOn: null }),
    expense({
      id: "EXP-3",
      amountMinor: 70_000,
      paymentStatus: "paid",
      paidOn: "2026-03-05",
      voidedAt: "2026-03-06T00:00:00.000Z",
    }),
  ];

  it("counts only paid, non-voided expenses as cash out", () => {
    expect(amountOf(getPaidExpenses(expenses), "USD")).toBe(50_000);
    expect(amountOf(getOutstandingExpenses(expenses), "USD")).toBe(30_000);
  });

  it("falls back to the expense date when paidOn is missing", () => {
    const fallback = [expense({ paidOn: null, date: "2026-02-15" })];
    expect(
      amountOf(getPaidExpenses(fallback, { dateRange: { from: "2026-02-01", to: "2026-02-28" } }), "USD"),
    ).toBe(50_000);
  });

  it("never merges currencies together", () => {
    const mixed = [
      expense({ id: "EXP-1", currency: "USD", amountMinor: 50_000 }),
      expense({ id: "EXP-2", currency: "EGP", amountMinor: 90_000 }),
    ];
    const paid = getPaidExpenses(mixed);
    expect(paid).toHaveLength(2);
    expect(amountOf(paid, "USD")).toBe(50_000);
    expect(amountOf(paid, "EGP")).toBe(90_000);
  });
});

describe("monthly cash flow aggregation", () => {
  const dataset = {
    obligations: [],
    transactions: [
      transaction({ amountMinor: 100_000, currency: "USD", date: "2026-01-15" }),
    ],
    expenses: [
      expense({ amountMinor: 40_000, currency: "USD", date: "2026-03-02", paidOn: "2026-03-10" }),
      expense({ amountMinor: 9_000, currency: "EGP", date: "2026-02-01", paidOn: "2026-02-01" }),
    ],
  };

  it("aggregates by month, zero-fills gaps, and keeps currencies separate", () => {
    const rows = getMonthlyCashFlow(dataset, {
      dateRange: { from: "2026-01-01", to: "2026-03-31" },
    });
    expect(rows).toHaveLength(6); // 3 months × 2 currencies

    const usdJan = rows.find((r) => r.month === "2026-01" && r.currency === "USD");
    const usdFeb = rows.find((r) => r.month === "2026-02" && r.currency === "USD");
    const usdMar = rows.find((r) => r.month === "2026-03" && r.currency === "USD");
    const egpFeb = rows.find((r) => r.month === "2026-02" && r.currency === "EGP");

    expect(usdJan && { c: usdJan.collectedMinor, e: usdJan.paidExpenseMinor, n: usdJan.netMinor }).toEqual({
      c: 100_000,
      e: 0,
      n: 100_000,
    });
    expect(usdFeb && { c: usdFeb.collectedMinor, e: usdFeb.paidExpenseMinor, n: usdFeb.netMinor }).toEqual({
      c: 0,
      e: 0,
      n: 0,
    });
    expect(usdMar && { c: usdMar.collectedMinor, e: usdMar.paidExpenseMinor, n: usdMar.netMinor }).toEqual({
      c: 0,
      e: 40_000,
      n: -40_000,
    });
    expect(egpFeb?.paidExpenseMinor).toBe(9_000);
  });

  it("builds a running cumulative net cash series", () => {
    const cumulative = getCumulativeNetCashFlow(dataset, {
      dateRange: { from: "2026-01-01", to: "2026-03-31" },
    });
    const usd = cumulative.filter((r) => r.currency === "USD");
    expect(usd.map((r) => r.cumulativeMinor)).toEqual([100_000, 100_000, 60_000]);
  });

  it("returns nothing when no real records exist", () => {
    expect(getMonthlyCashFlow({ obligations: [], transactions: [], expenses: [] })).toEqual([]);
  });
});

describe("per-project series and profit", () => {
  const dataset = {
    obligations: [],
    transactions: [
      transaction({ projectId: "PRJ-001", amountMinor: 100_000, currency: "USD", date: "2026-03-01" }),
      transaction({ projectId: "PRJ-002", amountMinor: 20_000, currency: "EGP", date: "2026-03-02" }),
    ],
    expenses: [
      expense({ projectId: "PRJ-001", amountMinor: 40_000, currency: "USD", paidOn: "2026-03-06" }),
      expense({ projectId: "PRJ-001", amountMinor: 30_000, currency: "EGP", paidOn: "2026-03-06" }),
    ],
  };

  it("computes profit per project per currency without cross-currency sums", () => {
    const rows = getProjectProfitComparison(dataset);
    const prj1Usd = rows.find((r) => r.projectId === "PRJ-001" && r.currency === "USD");
    const prj1Egp = rows.find((r) => r.projectId === "PRJ-001" && r.currency === "EGP");
    const prj2Egp = rows.find((r) => r.projectId === "PRJ-002" && r.currency === "EGP");
    expect(prj1Usd?.profitMinor).toBe(60_000);
    expect(prj1Egp?.profitMinor).toBe(-30_000);
    expect(prj2Egp?.profitMinor).toBe(20_000);
    expect(amountOf(getCollectedByProject(dataset), "USD")).toBe(100_000);
  });
});

describe("collection rate and summary", () => {
  it("returns null rate when nothing is invoiced", () => {
    const rates = getCollectionRate(
      [{ currency: "USD", minor: 200_000 }],
      [{ currency: "USD", minor: 100_000 }],
    );
    expect(rates[0]?.percent).toBe(50);
    const empty = getCollectionRate([], [{ currency: "EGP", minor: 50_000 }]);
    expect(empty[0]?.percent).toBeNull();
  });

  it("falls back to the obligation schedule when no profile exists", () => {
    const dataset = {
      obligations: [
        obligation({ id: "OB-1", amountMinor: 100_000 }),
        obligation({ id: "OB-2", amountMinor: 50_000 }),
      ],
      transactions: [],
      expenses: [],
    };
    const summary = getProjectFinanceSummary("PRJ-001", dataset, [], TODAY);
    expect(summary.hasProfile).toBe(false);
    expect(amountOf(summary.contractedValue, "USD")).toBe(150_000);
    expect(amountOf(summary.invoiced, "USD")).toBe(150_000);
    expect(amountOf(summary.outstanding, "USD")).toBe(150_000);
  });

  it("uses the profile contract value when available", () => {
    const dataset = {
      obligations: [obligation({ amountMinor: 100_000 })],
      transactions: [transaction({ amountMinor: 40_000 })],
      expenses: [expense({ projectId: "PRJ-001", amountMinor: 10_000 })],
    };
    const summary = getProjectFinanceSummary("PRJ-001", dataset, [profile()], TODAY);
    expect(summary.hasProfile).toBe(true);
    expect(amountOf(summary.contractedValue, "USD")).toBe(200_000);
    expect(amountOf(summary.invoiced, "USD")).toBe(100_000);
    expect(amountOf(summary.collected, "USD")).toBe(40_000);
    expect(amountOf(summary.outstanding, "USD")).toBe(60_000);
    expect(amountOf(summary.paidExpenses, "USD")).toBe(10_000);
    expect(amountOf(summary.netCash, "USD")).toBe(30_000);
    expect(summary.margins[0]?.percent).toBe(75);
  });
});

describe("validation rules", () => {
  it("rejects non-positive, non-integer amounts and bad dates", () => {
    expect(validateObligationInput({
      projectId: "PRJ-001",
      title: "Milestone",
      amountMinor: -1,
      currency: "USD",
      dueDate: "2026-03-01",
    }).ok).toBe(false);
    expect(validateObligationInput({
      projectId: "PRJ-001",
      title: "Milestone",
      amountMinor: 1.5,
      currency: "USD",
      dueDate: "2026-03-01",
    }).ok).toBe(false);
    expect(validateObligationInput({
      projectId: "PRJ-001",
      title: "Milestone",
      amountMinor: 100,
      currency: "USD",
      dueDate: "2026-13-01",
    }).ok).toBe(false);
  });

  it("handles leap years correctly", () => {
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2027-02-29")).toBe(false);
  });

  it("blocks obligation edits below the collected amount", () => {
    const ob = obligation();
    const txs = [transaction({ amountMinor: 100_000 })];
    expect(validateObligationUpdate({ amountMinor: 50_000 }, ob, txs).ok).toBe(false);
    expect(validateObligationUpdate({ amountMinor: 150_000 }, ob, txs).ok).toBe(true);
  });

  it("blocks over-settling, over-refunding and payments to cancelled obligations", () => {
    const ob = obligation({ amountMinor: 100_000 });
    expect(
      validateTransactionInput(
        { obligationId: "OB-1", type: "payment", amountMinor: 150_000, date: "2026-03-01", method: "cash" },
        ob,
        [],
      ).ok,
    ).toBe(false);

    const txs = [transaction({ amountMinor: 100_000 })];
    expect(
      validateTransactionInput(
        { obligationId: "OB-1", type: "refund", amountMinor: 120_000, date: "2026-03-05", method: "cash" },
        ob,
        txs,
      ).ok,
    ).toBe(false);

    const cancelled = obligation({ cancelledAt: "2026-05-01T00:00:00.000Z" });
    expect(
      validateTransactionInput(
        { obligationId: "OB-1", type: "payment", amountMinor: 50_000, date: "2026-05-02", method: "cash" },
        cancelled,
        [],
      ).ok,
    ).toBe(false);

    expect(
      validateTransactionInput(
        { obligationId: "OB-1", type: "payment", amountMinor: 60_000, date: "2026-03-01", method: "cash" },
        ob,
        [],
      ).ok,
    ).toBe(true);
  });

  it("validates expenses and profiles", () => {
    expect(validateExpenseInput({
      description: "",
      amountMinor: 100,
      currency: "USD",
      date: "2026-03-01",
      category: "hosting",
      paymentStatus: "unpaid",
    }).ok).toBe(false);
    expect(validateExpenseInput({
      description: "Hosting",
      amountMinor: 100,
      currency: "USD",
      date: "2026-03-01",
      category: "hosting",
      paymentStatus: "unpaid",
    }).ok).toBe(true);
    expect(validateProfileInput({
      projectId: "PRJ-001",
      contractValueMinor: 0,
      currency: "USD",
      contractDate: "2026-01-01",
    }).ok).toBe(false);
  });
});

describe("ids and dates", () => {
  it("generates sequential finance ids", () => {
    expect(nextFinanceId("OB", ["OB-1", "OB-7"])).toBe("OB-8");
    expect(nextFinanceId("TXN", [])).toBe("TXN-1");
  });

  it("formats today from local date parts", () => {
    expect(todayISO(new Date(2026, 9, 20, 15, 30))).toBe("2026-10-20");
  });
});

describe("seed dataset integrity", () => {
  it("keeps transactions consistent with their obligations", () => {
    const byId = new Map(FINANCE_SEED.obligations.map((o) => [o.id, o]));
    for (const tx of FINANCE_SEED.transactions) {
      const obligationRecord = byId.get(tx.obligationId);
      expect(obligationRecord).toBeDefined();
      expect(tx.currency).toBe(obligationRecord?.currency);
      expect(tx.projectId).toBe(obligationRecord?.projectId);
    }
  });

  it("never settles an obligation beyond its amount", () => {
    for (const obligationRecord of FINANCE_SEED.obligations) {
      expect(getObligationPaidMinor(obligationRecord, FINANCE_SEED.transactions)).toBeLessThanOrEqual(
        obligationRecord.amountMinor,
      );
    }
  });

  it("uses valid dates everywhere", () => {
    for (const expenseRecord of FINANCE_SEED.expenses) {
      expect(isISODate(expenseRecord.date)).toBe(true);
      if (expenseRecord.paymentStatus === "paid" && expenseRecord.paidOn) {
        expect(isISODate(expenseRecord.paidOn)).toBe(true);
      }
    }
    for (const obligationRecord of FINANCE_SEED.obligations) {
      expect(isISODate(obligationRecord.dueDate)).toBe(true);
    }
  });
});