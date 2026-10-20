/**
 * Timeline & Deliverables — domain tests (Phase 10 quality gate).
 *
 * These run in a plain node environment against the pure layer in
 * lib/timeline.ts. "today" is always injected, so every assertion is
 * deterministic — no reliance on the real clock.
 */

import { describe, expect, it } from "vitest";
import {
  DELIVERABLE_TRANSITIONS,
  MILESTONE_TRANSITIONS,
  addDaysISO,
  addMonthsISO,
  buildMonthMatrix,
  buildTimelineEvents,
  canTransitionDeliverable,
  canTransitionMilestone,
  daysInMonth,
  detectDependencyCycle,
  diffInDays,
  formatMonthLabel,
  formatTimelineDate,
  isDeliverableOverdue,
  isISODate,
  isLeapYear,
  isMilestoneOverdue,
  monthOf,
  monthSpan,
  nextTimelineId,
  unknownDependencies,
  type Milestone,
  type TimelineDeliverable,
} from "@/lib/timeline";

/* ------------------------------- fixtures -------------------------------- */

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "MS-01",
    projectId: "PRJ-1042",
    title: "Core build complete",
    dueDate: "2024-08-15",
    status: "planned",
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function deliverable(overrides: Partial<TimelineDeliverable> = {}): TimelineDeliverable {
  return {
    id: "DLV-01",
    projectId: "PRJ-1042",
    name: "Component library v1",
    dueDate: "2024-08-01",
    status: "in-progress",
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

/* ------------------------------- dates ----------------------------------- */

describe("date primitives", () => {
  it("accepts real dates and rejects malformed ones", () => {
    expect(isISODate("2024-08-15")).toBe(true);
    expect(isISODate("2024-02-29")).toBe(true); // leap day
    expect(isISODate("2023-02-29")).toBe(false); // non-leap year
    expect(isISODate("2024-02-30")).toBe(false);
    expect(isISODate("2024-13-01")).toBe(false);
    expect(isISODate("2024-00-10")).toBe(false);
    expect(isISODate("2024-08")).toBe(false);
    expect(isISODate("15/08/2024")).toBe(false);
    expect(isISODate("")).toBe(false);
    expect(isISODate(null)).toBe(false);
    expect(isISODate(42)).toBe(false);
  });

  it("knows leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 12)).toBe(31);
    expect(daysInMonth(2024, 13)).toBe(0);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysISO("2024-08-15", 0)).toBe("2024-08-15");
    expect(addDaysISO("2024-08-31", 1)).toBe("2024-09-01");
    expect(addDaysISO("2024-02-28", 1)).toBe("2024-02-29"); // leap
    expect(addDaysISO("2023-02-28", 1)).toBe("2023-03-01"); // non-leap
    expect(addDaysISO("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDaysISO("2024-01-01", -1)).toBe("2023-12-31");
  });

  it("computes signed day differences", () => {
    expect(diffInDays("2024-08-01", "2024-08-15")).toBe(14);
    expect(diffInDays("2024-08-15", "2024-08-01")).toBe(-14);
    expect(diffInDays("2024-02-28", "2024-03-01")).toBe(2);
  });

  it("adds months and clamps short months", () => {
    expect(addMonthsISO("2024-01-31", 1)).toBe("2024-02-29"); // leap clamp
    expect(addMonthsISO("2023-01-31", 1)).toBe("2023-02-28");
    expect(addMonthsISO("2024-08-15", 6)).toBe("2025-02-15");
    expect(addMonthsISO("2024-08-15", -9)).toBe("2023-11-15");
    expect(addMonthsISO("2024-12-31", 2)).toBe("2025-02-28"); // 2025 is not a leap year
    expect(addMonthsISO("2023-12-31", 2)).toBe("2024-02-29"); // 2024 is
  });

  it("derives month keys, spans and labels", () => {
    expect(monthOf("2024-08-15")).toBe("2024-08");
    expect(monthSpan("2024-06-01", "2024-08-31")).toBe(3);
    expect(monthSpan("2024-08-01", "2024-08-01")).toBe(1);
    expect(monthSpan("2024-11-01", "2025-02-10")).toBe(4);
    expect(formatMonthLabel("2024-02")).toBe("Feb 2024");
    expect(formatTimelineDate("2024-02-09")).toBe("9 Feb 2024");
    expect(formatTimelineDate("not-a-date")).toBe("not-a-date");
  });
});

/* ----------------------------- transitions ------------------------------- */

describe("status transitions", () => {
  it("allows only the documented milestone transitions", () => {
    expect(canTransitionMilestone("planned", "in-progress")).toBe(true);
    expect(canTransitionMilestone("in-progress", "done")).toBe(true);
    expect(canTransitionMilestone("planned", "at-risk")).toBe(true);
    expect(canTransitionMilestone("done", "in-progress")).toBe(false); // terminal
    expect(canTransitionMilestone("cancelled", "planned")).toBe(false);
    expect(canTransitionMilestone("planned", "done")).toBe(false); // no skipping
    expect(canTransitionMilestone("planned", "planned")).toBe(false);
    // Map coverage: every listed transition is legal, nothing else.
    for (const [from, targets] of Object.entries(MILESTONE_TRANSITIONS)) {
      for (const to of targets) {
        expect(canTransitionMilestone(from as Milestone["status"], to)).toBe(true);
      }
    }
  });

  it("keeps deliverables on their explicit workflow", () => {
    expect(canTransitionDeliverable("pending", "in-progress")).toBe(true);
    expect(canTransitionDeliverable("in-progress", "submitted")).toBe(true);
    expect(canTransitionDeliverable("submitted", "approved")).toBe(true);
    expect(canTransitionDeliverable("submitted", "in-progress")).toBe(true); // rework
    expect(canTransitionDeliverable("approved", "in-progress")).toBe(false); // terminal
    expect(canTransitionDeliverable("pending", "approved")).toBe(false);
    expect(canTransitionDeliverable("pending", "pending")).toBe(false);
    for (const [from, targets] of Object.entries(DELIVERABLE_TRANSITIONS)) {
      for (const to of targets) {
        expect(canTransitionDeliverable(from as TimelineDeliverable["status"], to)).toBe(true);
      }
    }
  });
});

/* ------------------------------ dependencies ------------------------------ */

describe("dependency integrity", () => {
  it("flags unknown dependency ids", () => {
    const items = [milestone({ id: "MS-01" }), milestone({ id: "MS-02", dependencies: ["MS-01", "MS-99"] })];
    expect(unknownDependencies(items)).toEqual(["MS-99"]);
    expect(unknownDependencies([milestone()])).toEqual([]);
  });

  it("accepts acyclic chains", () => {
    const chain = [
      milestone({ id: "MS-01" }),
      milestone({ id: "MS-02", dependencies: ["MS-01"] }),
      milestone({ id: "MS-03", dependencies: ["MS-02"] }),
    ];
    expect(detectDependencyCycle(chain)).toBeNull();
  });

  it("detects self-cycles and two-node cycles", () => {
    const self = [milestone({ id: "MS-01", dependencies: ["MS-01"] })];
    expect(detectDependencyCycle(self)).toEqual(["MS-01", "MS-01"]);

    const two = [
      milestone({ id: "MS-01", dependencies: ["MS-02"] }),
      milestone({ id: "MS-02", dependencies: ["MS-01"] }),
    ];
    const cycle = detectDependencyCycle(two);
    expect(cycle).not.toBeNull();
    expect(cycle?.length).toBe(3);
  });
});

/* -------------------------------- overdue --------------------------------- */

describe("overdue detection", () => {
  it("marks unfinished past milestones overdue", () => {
    expect(isMilestoneOverdue(milestone({ status: "planned", dueDate: "2024-08-10" }), "2024-08-15")).toBe(true);
    expect(isMilestoneOverdue(milestone({ status: "at-risk", dueDate: "2024-08-10" }), "2024-08-15")).toBe(true);
    expect(isMilestoneOverdue(milestone({ status: "planned", dueDate: "2024-08-15" }), "2024-08-15")).toBe(false);
    expect(isMilestoneOverdue(milestone({ status: "done", dueDate: "2024-08-10" }), "2024-08-15")).toBe(false);
    expect(isMilestoneOverdue(milestone({ status: "cancelled", dueDate: "2024-08-10" }), "2024-08-15")).toBe(false);
  });

  it("needs an agreed date before a deliverable can be overdue", () => {
    expect(isDeliverableOverdue(deliverable({ dueDate: "2024-08-10" }), "2024-08-15")).toBe(true);
    expect(isDeliverableOverdue(deliverable({ dueDate: undefined }), "2024-08-15")).toBe(false);
    expect(isDeliverableOverdue(deliverable({ status: "approved", dueDate: "2024-08-10" }), "2024-08-15")).toBe(false);
  });
});

/* --------------------------- derived events ------------------------------- */

describe("buildTimelineEvents", () => {
  const today = "2024-08-15";

  it("derives events from milestones, deliverables and payments, sorted by date", () => {
    const events = buildTimelineEvents({
      milestones: [milestone({ id: "MS-02", dueDate: "2024-08-20" }), milestone({ id: "MS-01", dueDate: "2024-08-01", status: "done" })],
      deliverables: [deliverable({ id: "DLV-01", dueDate: "2024-08-10" })],
      customEvents: [
        {
          id: "EVT-01",
          title: "Stakeholder demo",
          date: "2024-08-12",
          kind: "custom",
          status: "planned",
          createdAt: "2024-06-01T00:00:00.000Z",
        },
      ],
      paymentDues: [
        { id: "POB-001", projectId: "PRJ-1042", title: "Milestone 2 — UI delivery", dueDate: "2024-08-25" },
        { id: "POB-002", projectId: "PRJ-1042", title: "Cancelled instalment", dueDate: "2024-08-05", cancelled: true },
      ],
      today,
    });

    expect(events.map((e) => e.date)).toEqual(["2024-08-01", "2024-08-10", "2024-08-12", "2024-08-20", "2024-08-25"]);
    expect(events.some((e) => e.sourceId === "POB-002")).toBe(false); // cancelled obligations never appear
    expect(events.filter((e) => e.kind === "payment").length).toBe(1);
    const milestoneEvent = events.find((e) => e.sourceId === "MS-01");
    expect(milestoneEvent?.status).toBe("done");
    expect(milestoneEvent?.overdue).toBe(false); // done is never overdue
  });

  it("recomputes overdue flags from the injected today", () => {
    const events = buildTimelineEvents({
      milestones: [milestone({ id: "MS-09", dueDate: "2024-08-10" })],
      deliverables: [deliverable({ id: "DLV-09", dueDate: "2024-08-01" })],
      customEvents: [],
      today,
    });
    for (const event of events) {
      expect(event.overdue).toBe(true);
      expect(event.id.startsWith("evt:")).toBe(true);
    }
  });

  it("skips deliverables that have no agreed due date", () => {
    const events = buildTimelineEvents({
      milestones: [],
      deliverables: [deliverable({ dueDate: undefined })],
      customEvents: [],
      today,
    });
    expect(events).toHaveLength(0);
  });

  it("marks planned custom events in the past as overdue", () => {
    const events = buildTimelineEvents({
      milestones: [],
      deliverables: [],
      customEvents: [
        { id: "EVT-01", title: "Retro", date: "2024-08-01", kind: "custom", status: "planned" },
        { id: "EVT-02", title: "Done retro", date: "2024-08-01", kind: "custom", status: "done" },
      ],
      today,
    });
    expect(events.find((e) => e.id === "EVT-01")?.overdue).toBe(true);
    expect(events.find((e) => e.id === "EVT-02")?.overdue).toBe(false);
  });
});

/* ------------------------------ calendar grid ----------------------------- */

describe("buildMonthMatrix", () => {
  it("covers every day of a leap February exactly once", () => {
    const weeks = buildMonthMatrix(2024, 1); // Feb 2024 (0-based month index)
    const days = weeks.flat();
    expect(days.filter((d) => d.inMonth)).toHaveLength(29);
    // Feb 1 2024 was a Thursday → the grid starts on Sunday 2024-01-28.
    expect(days[0]?.date).toBe("2024-01-28");
    expect(days[0]?.inMonth).toBe(false);
    expect(days[4]?.date).toBe("2024-02-01");
    expect(days[4]?.inMonth).toBe(true);
    // Every row has exactly 7 cells and dates are consecutive.
    for (const week of weeks) expect(week).toHaveLength(7);
    for (let i = 1; i < days.length; i += 1) {
      expect(diffInDays(days[i - 1]?.date ?? "", days[i]?.date ?? "")).toBe(1);
    }
  });

  it("returns an empty grid for invalid months", () => {
    expect(buildMonthMatrix(2024, 12)).toEqual([]);
    expect(buildMonthMatrix(2024, -1)).toEqual([]);
  });
});

/* --------------------------------- ids ------------------------------------ */

describe("nextTimelineId", () => {
  it("continues the numeric sequence of a prefix", () => {
    expect(nextTimelineId("MS", ["MS-01", "MS-02", "MS-11"])).toBe("MS-12");
    expect(nextTimelineId("MS", [])).toBe("MS-01");
    expect(nextTimelineId("DLV", ["DLV-07", "EVT-99"])).toBe("DLV-08");
  });
});