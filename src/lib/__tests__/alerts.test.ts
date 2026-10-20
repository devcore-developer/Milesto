import { describe, expect, it } from "vitest";
import {
  alertKey,
  computeDeadlineAlerts,
  countAlertsByBucket,
  diffInDays,
  formatAlertDate,
  formatDaysRemaining,
  groupAlertsByBucket,
  isISODateString,
  localTodayISO,
  type AlertSourceItem,
} from "@/lib/alerts";

const TODAY = "2026-05-10";

const base = (overrides: Partial<AlertSourceItem> = {}): AlertSourceItem => ({
  id: "t1",
  title: "Task 1",
  kind: "task",
  dueDate: "2026-05-12",
  ...overrides,
});

describe("isISODateString", () => {
  it("accepts real calendar dates including leap days", () => {
    expect(isISODateString("2026-02-28")).toBe(true);
    expect(isISODateString("2024-02-29")).toBe(true);
    expect(isISODateString("2000-02-29")).toBe(true);
  });

  it("rejects impossible dates and malformed input", () => {
    expect(isISODateString("2023-02-29")).toBe(false);
    expect(isISODateString("1900-02-29")).toBe(false);
    expect(isISODateString("2026-02-30")).toBe(false);
    expect(isISODateString("2026-13-01")).toBe(false);
    expect(isISODateString("2026-00-10")).toBe(false);
    expect(isISODateString("2026-5-10")).toBe(false);
    expect(isISODateString("")).toBe(false);
    expect(isISODateString(20260510)).toBe(false);
    expect(isISODateString("2026-05-10T00:00:00Z")).toBe(false);
  });
});

describe("diffInDays", () => {
  it("counts whole days across month and leap boundaries", () => {
    expect(diffInDays("2026-05-10", "2026-05-12")).toBe(2);
    expect(diffInDays("2026-05-12", "2026-05-10")).toBe(-2);
    expect(diffInDays("2024-02-28", "2024-03-01")).toBe(2);
    expect(diffInDays("2023-02-28", "2023-03-01")).toBe(1);
    expect(diffInDays("2026-05-10", "2026-05-10")).toBe(0);
  });
});

describe("localTodayISO", () => {
  it("uses local calendar components without timezone shifting", () => {
    expect(localTodayISO(new Date(2026, 4, 10, 23, 59))).toBe("2026-05-10");
    expect(localTodayISO(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});

describe("computeDeadlineAlerts", () => {
  it("buckets overdue, today, next7 and next30, and drops items beyond 30 days", () => {
    const { alerts } = computeDeadlineAlerts(
      [
        base({ id: "a", dueDate: "2026-05-08" }),
        base({ id: "b", dueDate: "2026-04-11" }),
        base({ id: "c", dueDate: TODAY }),
        base({ id: "d", dueDate: "2026-05-12" }),
        base({ id: "e", dueDate: "2026-06-05" }),
        base({ id: "f", dueDate: "2026-07-01" }),
      ],
      { today: TODAY },
    );
    expect(alerts.map((alert) => alert.id)).toEqual(["b", "a", "c", "d", "e"]);
    expect(alerts.map((alert) => alert.bucket)).toEqual([
      "overdue",
      "overdue",
      "today",
      "next7",
      "next30",
    ]);
    expect(alerts.map((alert) => alert.severity)).toEqual([
      "critical",
      "critical",
      "high",
      "medium",
      "low",
    ]);
  });

  it("sorts most-overdue first within the overdue bucket", () => {
    const { alerts } = computeDeadlineAlerts(
      [base({ id: "near", dueDate: "2026-05-09" }), base({ id: "far", dueDate: "2026-04-01" })],
      { today: TODAY },
    );
    expect(alerts.map((alert) => alert.id)).toEqual(["far", "near"]);
  });

  it("excludes completed items unless explicitly included", () => {
    const items = [base({ completed: true })];
    expect(computeDeadlineAlerts(items, { today: TODAY }).alerts).toHaveLength(0);
    expect(computeDeadlineAlerts(items, { today: TODAY, includeCompleted: true }).alerts).toHaveLength(1);
  });

  it("skips invalid records without throwing and reports the count", () => {
    const { alerts, skipped } = computeDeadlineAlerts(
      [base(), base({ id: "" }), base({ title: "" }), base({ dueDate: "2026-02-30" })],
      { today: TODAY },
    );
    expect(alerts).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it("produces stable, idempotent alert keys", () => {
    const { alerts } = computeDeadlineAlerts(
      [base({ id: "x", kind: "payment", dueDate: "2026-05-11" })],
      { today: TODAY },
    );
    expect(alerts[0]?.key).toBe(alertKey("payment", "x", "2026-05-11"));
  });
});

describe("grouping helpers", () => {
  it("groups and counts by bucket", () => {
    const { alerts } = computeDeadlineAlerts(
      [
        base({ id: "a", dueDate: TODAY }),
        base({ id: "b", dueDate: "2026-05-11" }),
        base({ id: "c", dueDate: "2026-05-09" }),
      ],
      { today: TODAY },
    );
    const grouped = groupAlertsByBucket(alerts);
    expect(grouped.today.map((alert) => alert.id)).toEqual(["a"]);
    expect(grouped.overdue.map((alert) => alert.id)).toEqual(["c"]);
    expect(grouped.next7.map((alert) => alert.id)).toEqual(["b"]);
    expect(grouped.next30).toEqual([]);
    expect(countAlertsByBucket(alerts)).toEqual({ overdue: 1, today: 1, next7: 1, next30: 0 });
  });
});

describe("formatting", () => {
  it("formats day deltas and dates deterministically", () => {
    expect(formatDaysRemaining(-3)).toBe("3 days overdue");
    expect(formatDaysRemaining(-1)).toBe("1 day overdue");
    expect(formatDaysRemaining(0)).toBe("Due today");
    expect(formatDaysRemaining(1)).toBe("Due tomorrow");
    expect(formatDaysRemaining(5)).toBe("In 5 days");
    expect(formatAlertDate("2026-05-10")).toBe("10 May 2026");
    expect(formatAlertDate("garbage")).toBe("garbage");
  });
});