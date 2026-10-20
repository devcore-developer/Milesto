import { describe, expect, it } from "vitest";
import { computeDeadlineAlerts } from "@/lib/alerts";
import {
  buildFinanceAlertItems,
  collectedMinorForObligation,
  isObligationSettled,
  type SettleableObligation,
  type SettleableTransaction,
} from "@/lib/finance-alerts";

const obligation = (overrides: Partial<SettleableObligation> = {}): SettleableObligation => ({
  id: "ob-1",
  projectId: "p1",
  title: "Milestone 1 payment",
  amountMinor: 100_000,
  dueDate: "2026-05-01",
  ...overrides,
});

const tx = (overrides: Partial<SettleableTransaction> = {}): SettleableTransaction => ({
  obligationId: "ob-1",
  type: "payment",
  amountMinor: 40_000,
  ...overrides,
});

describe("collectedMinorForObligation", () => {
  it("sums payments minus refunds and ignores voided transactions", () => {
    const transactions = [
      tx({ amountMinor: 60_000 }),
      tx({ type: "refund", amountMinor: 10_000 }),
      tx({ amountMinor: 5_000, voidedAt: "2026-04-21T00:00:00.000Z" }),
    ];
    expect(collectedMinorForObligation(obligation(), transactions)).toBe(50_000);
  });

  it("returns 0 for obligations with no transactions", () => {
    expect(collectedMinorForObligation(obligation(), [])).toBe(0);
  });
});

describe("isObligationSettled", () => {
  it("is settled only when collections cover the full amount", () => {
    expect(isObligationSettled(obligation(), [tx({ amountMinor: 100_000 })])).toBe(true);
    expect(isObligationSettled(obligation(), [tx({ amountMinor: 99_999 })])).toBe(false);
  });
});

describe("buildFinanceAlertItems", () => {
  it("marks settled obligations completed and drops cancelled ones; engine then filters", () => {
    const items = buildFinanceAlertItems(
      [
        obligation({ id: "open" }),
        obligation({ id: "settled" }),
        obligation({ id: "cancelled", cancelledAt: "2026-04-01T00:00:00.000Z" }),
      ],
      [tx({ obligationId: "settled", amountMinor: 100_000 })],
    );
    // Builder contract: cancelled is dropped, settled is flagged completed.
    expect(items.map((item) => item.id)).toEqual(["open", "settled"]);
    expect(items.find((item) => item.id === "open")?.completed).toBe(false);
    expect(items.find((item) => item.id === "settled")?.completed).toBe(true);
    // Engine contract: completed items never raise alerts.
    const { alerts } = computeDeadlineAlerts(items, { today: "2026-05-10" });
    expect(alerts.map((alert) => alert.id)).toEqual(["open"]);
  });

  it("resolves project names and deep links when provided", () => {
    const items = buildFinanceAlertItems([obligation()], [], {
      projectNames: { p1: "Website Redesign" },
      urlBuilder: (o) => `/finance?obligation=${o.id}`,
    });
    expect(items[0]?.projectName).toBe("Website Redesign");
    expect(items[0]?.url).toBe("/finance?obligation=ob-1");
  });

  it("feeds the alert engine: overdue unsettled obligations become critical alerts", () => {
    const items = buildFinanceAlertItems(
      [obligation({ dueDate: "2026-04-01" })],
      [tx({ amountMinor: 10_000 })],
    );
    const { alerts } = computeDeadlineAlerts(items, { today: "2026-05-10" });
    expect(alerts[0]?.bucket).toBe("overdue");
    expect(alerts[0]?.severity).toBe("critical");
    expect(alerts[0]?.daysRemaining).toBe(-39);
  });
});