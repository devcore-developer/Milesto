import { describe, expect, it } from "vitest";
import { calculatePassRate, evaluateGate, getLatestExecution } from "@/lib/quality-engine";
import type { Bug, QualityGate, TestCase, TestExecution } from "@/types";

const makeCase = (id: string, phaseId: string, projectId = "PRJ-1000"): TestCase => ({
  id,
  projectId,
  phaseId,
  title: `Case ${id}`,
  type: "Manual",
  priority: "Medium",
  riskLevel: "Low",
  steps: ["Step 1"],
  expected: "Works",
  archived: false,
  createdAt: "2024-08-01T00:00:00.000Z",
  updatedAt: "2024-08-01T00:00:00.000Z",
});

const exec = (testCaseId: string, status: TestExecution["status"], date: string): TestExecution => ({
  id: `EX-${testCaseId}-${status}-${date}`,
  testCaseId,
  status,
  date,
  source: "manual",
  createdAt: date,
});

const bugOf = (overrides: Partial<Bug>): Bug => ({
  id: "BUG-T",
  projectId: "PRJ-1000",
  title: "Bug",
  severity: "Critical",
  status: "Open",
  createdAt: "2024-08-01T00:00:00.000Z",
  updatedAt: "2024-08-01T00:00:00.000Z",
  ...overrides,
});

const gateOf = (overrides: Partial<QualityGate> = {}): QualityGate => ({
  id: "QG-TEST",
  phaseId: "PHS-1",
  projectId: "PRJ-1000",
  requiredExecuted: 1,
  requiredPassed: 1,
  requiredPassRate: 100,
  requireNoCriticalBugs: true,
  requireNoHighBugs: false,
  requireManualApproval: true,
  status: "Pending",
  updatedAt: "2024-08-01T00:00:00.000Z",
  ...overrides,
});

describe("getLatestExecution", () => {
  it("returns the newest execution by date", () => {
    const executions = [exec("TC-1", "Pass", "2024-08-01"), exec("TC-1", "Fail", "2024-08-10")];
    expect(getLatestExecution("TC-1", executions)?.status).toBe("Fail");
  });

  it("returns undefined when the case was never executed", () => {
    expect(getLatestExecution("TC-404", [])).toBeUndefined();
  });
});

describe("calculatePassRate", () => {
  it("excludes Not Run, Skipped and Blocked from the denominator by default", () => {
    const executions = [
      exec("TC-1", "Pass", "2024-08-01"),
      exec("TC-2", "Pass", "2024-08-01"),
      exec("TC-3", "Fail", "2024-08-01"),
      exec("TC-4", "Blocked", "2024-08-01"),
      exec("TC-5", "Not Run", "2024-08-01"),
      exec("TC-6", "Skipped", "2024-08-01"),
    ];
    expect(calculatePassRate(executions)).toBe(67);
  });

  it("returns 0 when nothing is conclusive", () => {
    expect(calculatePassRate([exec("TC-1", "Blocked", "2024-08-01")])).toBe(0);
  });

  it("can include blocked executions when explicitly asked", () => {
    const executions = [exec("TC-1", "Pass", "2024-08-01"), exec("TC-2", "Blocked", "2024-08-01")];
    expect(calculatePassRate(executions, { exclude: ["Not Run", "Skipped"] })).toBe(50);
  });
});

describe("evaluateGate", () => {
  it("is ready when all criteria are met", () => {
    const cases = [makeCase("TC-1", "PHS-1"), makeCase("TC-2", "PHS-1")];
    const executions = [exec("TC-1", "Pass", "2024-08-01"), exec("TC-2", "Pass", "2024-08-02")];
    const readiness = evaluateGate(gateOf({ requiredExecuted: 2, requiredPassed: 2 }), cases, executions, []);
    expect(readiness.isReady).toBe(true);
    expect(readiness.reasons).toHaveLength(0);
  });

  it("reports insufficient executed tests", () => {
    const cases = [makeCase("TC-1", "PHS-1"), makeCase("TC-2", "PHS-1")];
    const executions = [exec("TC-1", "Pass", "2024-08-01")];
    const readiness = evaluateGate(gateOf({ requiredExecuted: 2 }), cases, executions, []);
    expect(readiness.isReady).toBe(false);
    expect(readiness.reasons.some((reason) => reason.includes("Executed 1 of 2"))).toBe(true);
  });

  it("reports an insufficient pass rate", () => {
    const cases = [makeCase("TC-1", "PHS-1"), makeCase("TC-2", "PHS-1")];
    const executions = [exec("TC-1", "Pass", "2024-08-01"), exec("TC-2", "Fail", "2024-08-02")];
    const readiness = evaluateGate(gateOf({ requiredPassRate: 100 }), cases, executions, []);
    expect(readiness.reasons).toContain("Pass rate is 50%, required is 100%.");
  });

  it("blocks on open critical bugs", () => {
    const cases = [makeCase("TC-1", "PHS-1")];
    const executions = [exec("TC-1", "Pass", "2024-08-01")];
    const bugs = [bugOf({})];
    const readiness = evaluateGate(gateOf(), cases, executions, bugs);
    expect(readiness.isReady).toBe(false);
    expect(readiness.metrics.openCriticalBugs).toBe(1);
  });

  it("ignores closed critical bugs", () => {
    const cases = [makeCase("TC-1", "PHS-1")];
    const executions = [exec("TC-1", "Pass", "2024-08-01")];
    const bugs = [bugOf({ status: "Closed" })];
    const readiness = evaluateGate(gateOf(), cases, executions, bugs);
    expect(readiness.isReady).toBe(true);
  });

  it("is never ready when the phase has no active test cases", () => {
    const readiness = evaluateGate(gateOf(), [], [], []);
    expect(readiness.isReady).toBe(false);
    expect(readiness.reasons[0]).toContain("No active test cases");
  });
});