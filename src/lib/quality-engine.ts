import type { Bug, BugStatus, ExecutionStatus, QualityGate, TestCase, TestExecution } from "@/types";

/** Bug statuses that keep a bug "open" for gate purposes. */
export const OPEN_BUG_STATUSES: BugStatus[] = ["Open", "In Progress", "Retest"];

export function getLatestExecution(
  testCaseId: string,
  executions: TestExecution[]
): TestExecution | undefined {
  return executions
    .filter((execution) => execution.testCaseId === testCaseId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

export interface PassRateOptions {
  /** Statuses excluded from the denominator. Default: Not Run, Skipped, Blocked (spec §8). */
  exclude?: ExecutionStatus[];
}

/**
 * Pass rate = Pass / (Pass + Fail) by default.
 * Not Run, Skipped and Blocked are excluded from the denominator unless stated.
 */
export function calculatePassRate(executions: TestExecution[], options?: PassRateOptions): number {
  const exclude = options?.exclude ?? ["Not Run", "Skipped", "Blocked"];
  const valid = executions.filter((execution) => !exclude.includes(execution.status));
  if (valid.length === 0) return 0;
  const passed = valid.filter((execution) => execution.status === "Pass").length;
  return Math.round((passed / valid.length) * 100);
}

export interface GateMetrics {
  totalCases: number;
  executed: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
  passRate: number;
  openCriticalBugs: number;
  openHighBugs: number;
}

export interface GateReadiness {
  isReady: boolean;
  reasons: string[];
  metrics: GateMetrics;
}

/**
 * Computes gate readiness from ACTUAL data (spec §7):
 * - latest result per test case of the gate's phase
 * - "executed" = latest status is Pass, Fail or Blocked (attempted)
 * - Skipped and never-executed cases count as not run
 * - pass rate over Pass+Fail only
 * - open Critical/High bugs on the gate's project
 */
export function evaluateGate(
  gate: QualityGate,
  testCases: TestCase[],
  executions: TestExecution[],
  bugs: Bug[]
): GateReadiness {
  const phaseCases = testCases.filter((tc) => tc.phaseId === gate.phaseId && !tc.archived);

  const latestPerCase = phaseCases
    .map((tc) => getLatestExecution(tc.id, executions))
    .filter((execution): execution is TestExecution => Boolean(execution));

  const executedList = latestPerCase.filter(
    (e) => e.status === "Pass" || e.status === "Fail" || e.status === "Blocked"
  );
  const passed = executedList.filter((e) => e.status === "Pass").length;
  const failed = executedList.filter((e) => e.status === "Fail").length;
  const blocked = executedList.filter((e) => e.status === "Blocked").length;
  const skipped = latestPerCase.filter((e) => e.status === "Skipped").length;
  const notRun = phaseCases.length - executedList.length - skipped;
  const passRate = calculatePassRate(latestPerCase);

  const projectBugs = bugs.filter((bug) => bug.projectId === gate.projectId);
  const openCriticalBugs = projectBugs.filter(
    (bug) => bug.severity === "Critical" && OPEN_BUG_STATUSES.includes(bug.status)
  ).length;
  const openHighBugs = projectBugs.filter(
    (bug) => bug.severity === "High" && OPEN_BUG_STATUSES.includes(bug.status)
  ).length;

  const reasons: string[] = [];
  if (phaseCases.length === 0) {
    reasons.push("No active test cases are linked to this phase yet.");
  } else {
    if (executedList.length < gate.requiredExecuted) {
      reasons.push(`Executed ${executedList.length} of ${gate.requiredExecuted} required test(s).`);
    }
    if (passed < gate.requiredPassed) {
      reasons.push(`Passed ${passed} of ${gate.requiredPassed} required pass(es).`);
    }
    if (passRate < gate.requiredPassRate) {
      reasons.push(`Pass rate is ${passRate}%, required is ${gate.requiredPassRate}%.`);
    }
    if (gate.requireNoCriticalBugs && openCriticalBugs > 0) {
      reasons.push(`${openCriticalBugs} open critical bug(s) must be resolved first.`);
    }
    if (gate.requireNoHighBugs && openHighBugs > 0) {
      reasons.push(`${openHighBugs} open high-severity bug(s) must be resolved first.`);
    }
  }

  return {
    isReady: reasons.length === 0,
    reasons,
    metrics: {
      totalCases: phaseCases.length,
      executed: executedList.length,
      passed,
      failed,
      blocked,
      skipped,
      notRun,
      passRate,
      openCriticalBugs,
      openHighBugs,
    },
  };
}