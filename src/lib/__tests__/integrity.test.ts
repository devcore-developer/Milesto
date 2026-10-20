import { describe, expect, it } from "vitest";
import {
  findBrokenReferences,
  findDateInversions,
  findDateIssues,
  findDuplicateIds,
  runIntegrityChecks,
  summarizeIntegrity,
} from "@/lib/integrity";

describe("findDuplicateIds", () => {
  it("flags duplicate ids as errors", () => {
    const issues = findDuplicateIds([{ id: "a" }, { id: "b" }, { id: "a" }], "task");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "DUPLICATE_ID",
      severity: "error",
      entity: "task",
      entityId: "a",
    });
  });

  it("passes clean data", () => {
    expect(findDuplicateIds([{ id: "a" }, { id: "b" }], "task")).toEqual([]);
  });
});

describe("findBrokenReferences", () => {
  const items = [
    { id: "t1", projectId: "p1" },
    { id: "t2", projectId: "missing" },
    { id: "t3", projectId: null },
  ];

  it("flags references to missing targets and allows empty optional refs", () => {
    const issues = findBrokenReferences(items, "projectId", ["p1"], {
      entity: "task",
      refName: "project",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "BROKEN_REFERENCE", entityId: "t2" });
  });

  it("can require non-empty references", () => {
    const issues = findBrokenReferences(items, "projectId", ["p1"], {
      entity: "task",
      refName: "project",
      allowEmpty: false,
    });
    expect(issues.map((issue) => issue.code).sort()).toEqual([
      "BROKEN_REFERENCE",
      "MISSING_REFERENCE",
    ]);
  });
});

describe("findDateIssues", () => {
  it("accepts optional/empty dates and rejects impossible ones", () => {
    const issues = findDateIssues(
      [
        { id: "d1", dueDate: "2024-02-29", startDate: null },
        { id: "d2", dueDate: "2023-02-29" },
        { id: "d3", dueDate: "2026-02-30" },
      ],
      "deliverable",
      ["dueDate", "startDate"],
    );
    expect(issues.map((issue) => issue.entityId)).toEqual(["d2", "d3"]);
    expect(issues.every((issue) => issue.code === "INVALID_DATE")).toBe(true);
  });
});

describe("findDateInversions", () => {
  it("flags ranges where the start date is after the end date", () => {
    const issues = findDateInversions(
      [
        { id: "r1", plannedStart: "2026-05-10", dueDate: "2026-05-01" },
        { id: "r2", plannedStart: "2026-05-01", dueDate: "2026-05-10" },
        { id: "r3", plannedStart: "2026-05-01", dueDate: null },
      ],
      "deliverable",
      [{ startField: "plannedStart", endField: "dueDate", label: "planned window" }],
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "INVERTED_DATE_RANGE",
      entityId: "r1",
      severity: "warning",
    });
  });
});

describe("runIntegrityChecks + summarizeIntegrity", () => {
  it("composes checks and survives throwing checks", () => {
    const issues = runIntegrityChecks([
      () => findDuplicateIds([{ id: "a" }, { id: "a" }], "task"),
      () => {
        throw new Error("boom");
      },
      () => [],
    ]);
    expect(issues.map((issue) => issue.code)).toEqual(["DUPLICATE_ID", "CHECK_FAILED"]);
    const summary = summarizeIntegrity(issues);
    expect(summary).toMatchObject({ total: 2, errors: 2, warnings: 0, infos: 0 });
    expect(summary.byCode).toEqual({ DUPLICATE_ID: 1, CHECK_FAILED: 1 });
  });
});