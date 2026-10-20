import type {
  Bug,
  BugSeverity,
  BugStatus,
  ExecutionStatus,
  QualityGate,
  TestCase,
  TestExecution,
  TestType,
} from "@/types";
import { evaluateGate, getLatestExecution } from "@/lib/quality-engine";

export interface TestingFilters {
  projectId: string; // "all" or a project id
  phaseId: string; // "all" or a phase id
  type: TestType | "all";
  latestStatus: ExecutionStatus | "all";
  dateFrom: string; // "" = no lower bound (yyyy-mm-dd)
  dateTo: string; // "" = no upper bound
  search: string;
}

export const defaultTestingFilters: TestingFilters = {
  projectId: "all",
  phaseId: "all",
  type: "all",
  latestStatus: "all",
  dateFrom: "",
  dateTo: "",
  search: "",
};

export interface TestingDataset {
  testCases: TestCase[];
  executions: TestExecution[];
  bugs: Bug[];
  gates: QualityGate[];
}

export const OPEN_BUG_STATUSES: BugStatus[] = ["Open", "In Progress", "Retest"];

export function getLatestStatus(testCaseId: string, executions: TestExecution[]): ExecutionStatus {
  const latest = getLatestExecution(testCaseId, executions);
  return latest ? latest.status : "Not Run";
}

export function matchesDateRange(iso: string, from: string, to: string): boolean {
  const time = new Date(iso).getTime();
  if (from && time < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && time > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

/** Filters the ACTIVE (non-archived) test cases. "latestStatus" uses the latest execution per case. */
export function filterTestCases(
  testCases: TestCase[],
  executions: TestExecution[],
  filters: TestingFilters,
  options?: { includeArchived?: boolean }
): TestCase[] {
  const query = filters.search.trim().toLowerCase();
  return testCases.filter((tc) => {
    if (!options?.includeArchived && tc.archived) return false;
    if (filters.projectId !== "all" && tc.projectId !== filters.projectId) return false;
    if (filters.phaseId !== "all" && tc.phaseId !== filters.phaseId) return false;
    if (filters.type !== "all" && tc.type !== filters.type) return false;
    if (filters.latestStatus !== "all" && getLatestStatus(tc.id, executions) !== filters.latestStatus) {
      return false;
    }
    if (query) {
      const haystack = [tc.id, tc.title, ...(tc.tags ?? [])].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export interface TestingKPIs {
  totalCases: number;
  archivedCases: number;
  /** Execution records in the current scope — deliberately separate from case counts (spec §2). */
  totalExecutions: number;
  executionsInWindow: number;
  results: Record<ExecutionStatus, number>;
  passRate: number;
  openBugs: number;
  bugsBySeverity: Record<BugSeverity, number>;
  rerunCandidates: TestCase[];
  failedCriticalByProject: { projectId: string; cases: TestCase[] }[];
  phasesAwaitingApproval: QualityGate[];
  recentExecutions: TestExecution[];
}

/** One dataset in → all KPIs out (spec §2). */
export function computeTestingKPIs(
  dataset: TestingDataset,
  filters: TestingFilters = defaultTestingFilters,
  options?: { recentLimit?: number }
): TestingKPIs {
  const cases = filterTestCases(dataset.testCases, dataset.executions, filters);
  const archivedCases = dataset.testCases.filter((tc) => {
    if (!tc.archived) return false;
    return filters.projectId === "all" || tc.projectId === filters.projectId;
  });

  const results: Record<ExecutionStatus, number> = {
    Pass: 0,
    Fail: 0,
    Blocked: 0,
    Skipped: 0,
    "Not Run": 0,
  };
  cases.forEach((tc) => {
    results[getLatestStatus(tc.id, dataset.executions)] += 1;
  });

  const passCount = results.Pass;
  const failCount = results.Fail;
  const passRate = passCount + failCount > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : 0;

  const scopedBugs = dataset.bugs.filter(
    (bug) => filters.projectId === "all" || bug.projectId === filters.projectId
  );
  const openBugs = scopedBugs.filter((bug) => OPEN_BUG_STATUSES.includes(bug.status));
  const bugsBySeverity: Record<BugSeverity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  openBugs.forEach((bug) => {
    bugsBySeverity[bug.severity] += 1;
  });

  const rerunCandidates = cases.filter((tc) => {
    const status = getLatestStatus(tc.id, dataset.executions);
    return status === "Fail" || status === "Blocked";
  });

  const failedCriticalMap = new Map<string, TestCase[]>();
  cases.forEach((tc) => {
    if (tc.priority === "Critical" && getLatestStatus(tc.id, dataset.executions) === "Fail") {
      const list = failedCriticalMap.get(tc.projectId) ?? [];
      list.push(tc);
      failedCriticalMap.set(tc.projectId, list);
    }
  });

  const caseIds = new Set(cases.map((tc) => tc.id));
  const scopedExecutions = dataset.executions.filter((e) => caseIds.has(e.testCaseId));
  const executionsInWindow = scopedExecutions.filter((e) =>
    matchesDateRange(e.date, filters.dateFrom, filters.dateTo)
  ).length;

  const phasesAwaitingApproval = dataset.gates.filter((gate) => {
    if (filters.projectId !== "all" && gate.projectId !== filters.projectId) return false;
    if (gate.status === "Ready for Review") return true;
    if (gate.status !== "Pending") return false;
    return evaluateGate(gate, dataset.testCases, dataset.executions, dataset.bugs).isReady;
  });

  const recentExecutions = [...scopedExecutions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, options?.recentLimit ?? 8);

  return {
    totalCases: cases.length,
    archivedCases: archivedCases.length,
    totalExecutions: scopedExecutions.length,
    executionsInWindow,
    results,
    passRate,
    openBugs: openBugs.length,
    bugsBySeverity,
    rerunCandidates,
    failedCriticalByProject: Array.from(failedCriticalMap.entries()).map(([projectId, list]) => ({
      projectId,
      cases: list,
    })),
    phasesAwaitingApproval,
    recentExecutions,
  };
}

// ─── Automated import matching (§5) ───

export interface ImportedResult {
  testCaseId: string;
  status: "Pass" | "Fail" | "Blocked" | "Skipped";
  message?: string;
}

export interface ImportPreview {
  matched: ImportedResult[];
  unmatched: ImportedResult[];
}

/** Pure matching: keeps only results whose testCaseId exists locally; the rest are reported honestly. */
export function matchImportedResults(results: ImportedResult[], testCases: TestCase[]): ImportPreview {
  const ids = new Set(testCases.map((tc) => tc.id));
  const matched: ImportedResult[] = [];
  const unmatched: ImportedResult[] = [];
  results.forEach((result) => {
    if (ids.has(result.testCaseId)) matched.push(result);
    else unmatched.push(result);
  });
  return { matched, unmatched };
}