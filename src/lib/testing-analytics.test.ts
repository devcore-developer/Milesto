import { describe, expect, it } from "vitest";
import {
  computeTestingKPIs,
  defaultTestingFilters,
  getLatestStatus,
  type TestingDataset,
} from "@/lib/testing-analytics";
import type { Bug, TestCase, TestExecution } from "@/types";

const makeCase = (id: string, overrides: Partial<TestCase> = {}): TestCase => ({
  id,
  projectId: "PRJ-1042",
  title: `Case ${id}`,
  type: "Manual",
  priority: "Medium",
  riskLevel: "Low",
  steps: ["Step 1"],
  expected: "Expected",
  archived: false,
  createdAt: "2024-08-01T00:00:00.000Z",
  updatedAt: "2024-08-01T00:00:00.000Z",
  ...overrides,
});

const makeExec = (testCaseId: string, status: TestExecution["status"], date: string): TestExecution => ({
  id: `EX-${testCaseId}-${date}`,
  testCaseId,
  status,
  date,
  source: "manual",
  createdAt: date,
});

const makeBug = (overrides: Partial<Bug>): Bug => ({
  id: "BUG-X",
  projectId: "PRJ-1042",
  title: "Bug",
  severity: "Critical",
  status: "Open",
  createdAt: "2024-08-01T00:00:00.000Z",
  updatedAt: "2024-08-01T00:00:00.000Z",
  ...overrides,
});

const dataset: TestingDataset = {
  testCases: [
    makeCase("TC-1", { priority: "High" }),
    makeCase("TC-2", { priority: "Critical" }),
    makeCase("TC-3", { projectId: "PRJ-1037", priority: "Critical", phaseId: "PHS-2" }),
    makeCase("TC-9", { archived: true, title: "Old case" }),
  ],
  executions: [
    makeExec("TC-1", "Pass", "2024-08-01T10:00:00.000Z"),
    makeExec("TC-1", "Fail", "2024-08-10T10:00:00.000Z"),
    makeExec("TC-2", "Fail", "2024-08-05T10:00:00.000Z"),
    makeExec("TC-3", "Pass", "2024-08-05T10:00:00.000Z"),
    makeExec("TC-9", "Pass", "2024-08-02T10:00:00.000Z"),
  ],
  bugs: [
    makeBug({ id: "BUG-1" }),
    makeBug({ id: "BUG-2", status: "Closed" }),
    makeBug({ id: "BUG-3", projectId: "PRJ-1037", severity: "High", status: "In Progress" }),
  ],
  gates: [
    {
      id: "QG-1",
      phaseId: "PHS-2",
      projectId: "PRJ-1037",
      requiredExecuted: 1,
      requiredPassed: 1,
      requiredPassRate: 100,
      requireNoCriticalBugs: false,
      requireNoHighBugs: false,
      requireManualApproval: true,
      status: "Pending",
      updatedAt: "2024-08-01T00:00:00.000Z",
    },
  ],
};

describe("getLatestStatus", () => {
  it("returns the latest status", () => {
    expect(getLatestStatus("TC-1", dataset.executions)).toBe("Fail");
  });

  it("falls back to Not Run for never-executed cases", () => {
    expect(getLatestStatus("TC-404", dataset.executions)).toBe("Not Run");
  });
});

describe("computeTestingKPIs", () => {
  const kpis = computeTestingKPIs(dataset, defaultTestingFilters);

  it("excludes archived cases from totals", () => {
    expect(kpis.totalCases).toBe(3);
    expect(kpis.archivedCases).toBe(1);
  });

  it("counts latest results per case", () => {
    expect(kpis.results).toEqual({ Pass: 1, Fail: 2, Blocked: 0, Skipped: 0, "Not Run": 0 });
    expect(kpis.passRate).toBe(33);
  });

  it("separates execution count from case count (archived case executions excluded)", () => {
    expect(kpis.totalExecutions).toBe(4);
  });

  it("counts open bugs by severity and ignores closed ones", () => {
    expect(kpis.openBugs).toBe(2);
    expect(kpis.bugsBySeverity).toEqual({ Critical: 1, High: 1, Medium: 0, Low: 0 });
  });

  it("lists rerun candidates (latest Fail or Blocked)", () => {
    expect(kpis.rerunCandidates.map((tc) => tc.id)).toEqual(["TC-1", "TC-2"]);
  });

  it("groups failing critical cases by project", () => {
    expect(kpis.failedCriticalByProject).toEqual([
      { projectId: "PRJ-1042", cases: [expect.objectContaining({ id: "TC-2" })] },
    ]);
  });

  it("flags pending gates that are actually ready", () => {
    expect(kpis.phasesAwaitingApproval.map((gate) => gate.id)).toEqual(["QG-1"]);
  });

  it("respects the project filter", () => {
    const scoped = computeTestingKPIs(dataset, { ...defaultTestingFilters, projectId: "PRJ-1042" });
    expect(scoped.totalCases).toBe(2);
    expect(scoped.passRate).toBe(0);
    expect(scoped.openBugs).toBe(1);
  });
});