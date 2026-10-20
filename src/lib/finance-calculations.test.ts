import { describe, expect, it } from "vitest";
import type { FinanceObligation, ProjectFinanceProfile } from "@/types/finance";
import {
  buildProjectFinanceRows,
  getContractedValue,
  validateExpenseInput,
  validateObligationInput,
  validateProfileInput,
  validateTransactionInput,
  assertValid,
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
    dueDate: "2025-03-01",
    reference: "",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ProjectFinanceProfile> = {}): ProjectFinanceProfile {
  seq += 1;
  return {
    projectId: "p1",
    contractValueMinor: 1000000,
    currency: "EGP",
    contractDate: "2025-01-01",
    expectedDeliveryDate: "",
    paymentTerms: "",
    agreementNotes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("contracted value sources", () => {
  it("prefers the finance profile and falls back to active obligations", () => {
    const obligations = [
      makeObligation({ amountMinor: 400000 }),
      makeObligation({ amountMinor: 600000, cancelledAt: "2025-02-01T00:00:00.000Z" }),
    ];
    const withProfile = getContractedValue(
      { obligations, profiles: [makeProfile({ contractValueMinor: 1000000 })] },
      {},
    );
    expect(withProfile.source).toBe("profiles");
    expect(withProfile.totals).toEqual([{ currency: "EGP", minor: 1000000 }]);

    const withoutProfile = getContractedValue({ obligations, profiles: [] }, {});
    expect(withoutProfile.source).toBe("obligations");
    expect(withoutProfile.totals).toEqual([{ currency: "EGP", minor: 400000 }]);

    const mixed = getContractedValue(
      { obligations: [...obligations, makeObligation({ projectId: "p2" })], profiles: [makeProfile()] },
      {},
    );
    expect(mixed.source).toBe("mixed");
  });

  it("returns none when there is no data at all", () => {
    expect(getContractedValue({ obligations: [], profiles: [] }, {}).source).toBe("none");
  });
});

describe("project finance rows", () => {
  it("derives per-project, per-currency figures from real records only", () => {
    const workspace: FinanceWorkspace = {
      obligations: [makeObligation({ amountMinor: 400000, dueDate: "2025-03-01" })],
      transactions: [
        { ...makeObligation, id: "unused" } as never, // placeholder removed below
      ].slice(0, 0),
      expenses: [],
      profiles: [makeProfile({ contractValueMinor: 1000000 })],
    };
    workspace.transactions = [
      {
        id: "t-1",
        obligationId: "o-1",
        projectId: "p1",
        type: "payment",
        amountMinor: 100000,
        currency: "EGP",
        date: "2025-02-01",
        method: "bank_transfer",
        reference: "",
        notes: "",
        createdAt: "2025-02-01T00:00:00.000Z",
        updatedAt: "2025-02-01T00:00:00.000Z",
      },
    ];
    workspace.expenses = [
      {
        id: "e-1",
        description: "Hosting",
        amountMinor: 20000,
        currency: "EGP",
        date: "2025-02-05",
        category: "hosting",
        projectId: "p1",
        vendor: "",
        paymentStatus: "paid",
        receiptRef: "",
        notes: "",
        createdAt: "2025-02-05T00:00:00.000Z",
        updatedAt: "2025-02-05T00:00:00.000Z",
      },
      {
        id: "e-2",
        description: "Ads",
        amountMinor: 5000,
        currency: "EGP",
        date: "2025-02-06",
        category: "marketing",
        projectId: "p1",
        vendor: "",
        paymentStatus: "unpaid",
        receiptRef: "",
        notes: "",
        createdAt: "2025-02-06T00:00:00.000Z",
        updatedAt: "2025-02-06T00:00:00.000Z",
      },
    ];

    const rows = buildProjectFinanceRows(workspace, {}, "2025-03-10");
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.projectId).toBe("p1");
    expect(row.currency).toBe("EGP");
    expect(row.contractedMinor).toBe(1000000);
    expect(row.contractedSource).toBe("profile");
    expect(row.invoicedMinor).toBe(400000);
    expect(row.collectedMinor).toBe(100000);
    expect(row.outstandingMinor).toBe(300000);
    expect(row.expensesPaidMinor).toBe(20000);
    expect(row.expensesUnpaidMinor).toBe(5000);
    expect(row.netCashMinor).toBe(80000);
    expect(row.overdueMinor).toBe(300000);
    expect(row.dueThisMonthMinor).toBe(0);
  });
});

describe("validation", () => {
  it("rejects invalid obligations with clear messages", () => {
    expect(
      validateObligationInput({
        projectId: "p1",
        title: "  ",
        amountMinor: 100,
        currency: "EGP",
        dueDate: "2025-01-01",
      }).ok,
    ).toBe(false);
    expect(
      validateObligationInput({
        projectId: "p1",
        title: "T",
        amountMinor: 0,
        currency: "EGP",
        dueDate: "2025-01-01",
      }).ok,
    ).toBe(false);
    expect(
      validateObligationInput({
        projectId: "p1",
        title: "T",
        amountMinor: 10.5,
        currency: "EGP",
        dueDate: "2025-01-01",
      }).ok,
    ).toBe(false);
    expect(
      validateObligationInput({
        projectId: "p1",
        title: "T",
        amountMinor: 100,
        currency: "EGP",
        dueDate: "2023-02-29",
      }).ok,
    ).toBe(false);
    expect(
      validateObligationInput({
        projectId: "p1",
        title: "T",
        amountMinor: 100,
        currency: "EGP",
        dueDate: "2024-02-29",
      }).ok,
    ).toBe(true);
  });

  it("enforces currency match between transaction and obligation", () => {
    const obligation = makeObligation({ currency: "EGP" });
    const result = validateTransactionInput(obligation, {
      obligationId: obligation.id,
      type: "payment",
      amountMinor: 100,
      currency: "USD",
      date: "2025-01-01",
      method: "cash",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("EGP");
  });

  it("rejects negative and non-integer expenses", () => {
    expect(
      validateExpenseInput({
        description: "Hosting",
        amountMinor: -1,
        currency: "EGP",
        date: "2025-01-01",
        category: "hosting",
        projectId: null,
        paymentStatus: "unpaid",
      }).ok,
    ).toBe(false);
    expect(
      validateExpenseInput({
        description: "Hosting",
        amountMinor: 2500,
        currency: "EGP",
        date: "2025-01-01",
        category: "hosting",
        projectId: null,
        paymentStatus: "paid",
        paidOn: "2025-13-01",
      }).ok,
    ).toBe(false);
  });

  it("requires a positive contract value and valid contract date", () => {
    expect(
      validateProfileInput({
        projectId: "p1",
        contractValueMinor: 0,
        currency: "EGP",
        contractDate: "2025-01-01",
      }).ok,
    ).toBe(false);
    expect(
      validateProfileInput({
        projectId: "p1",
        contractValueMinor: 500000,
        currency: "EGP",
        contractDate: "not-a-date",
      }).ok,
    ).toBe(false);
  });

  it("assertValid throws the validation message", () => {
    expect(() =>
      assertValid({ ok: false, error: "boom" }),
    ).toThrowError("boom");
    expect(() => assertValid({ ok: true })).not.toThrow();
  });
});