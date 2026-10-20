// تحليلات الجودة — تطبيع دفاعي لوحدة الاختبار الموجودة
// المقامات معرّفة صراحة: passRate = passed ÷ (passed + failed) — المحجوبة/المتخطاة/غير المنفذة مش بتتحسب منفذة
import type { QualityGateView, QualitySnapshot } from "@/types/reports";
import type { ScheduleProject } from "@/types/timeline";

function asRec(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

function readStr(source: unknown, keys: string[]): string | undefined {
  const rec = asRec(source);
  if (!rec) return undefined;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

export type CaseOutcome = "passed" | "failed" | "blocked" | "skipped" | "not_executed";

export function caseOutcome(raw: unknown): CaseOutcome {
  const s = (readStr(raw, ["status", "result", "outcome", "state"]) ?? "").toLowerCase();
  if (s.includes("pass") || s === "success") return "passed";
  if (s.includes("fail")) return "failed";
  if (s.includes("block")) return "blocked";
  if (s.includes("skip")) return "skipped";
  return "not_executed";
}

const CLOSED_BUG_STATUSES = new Set(["closed", "resolved", "fixed", "verified", "done", "cancelled", "rejected", "duplicate"]);

export function bugIsOpen(raw: unknown): boolean {
  const rec = asRec(raw);
  if (!rec) return false;
  for (const k of ["resolvedAt", "closedAt"]) {
    const v = rec[k];
    if (typeof v === "string" && v.trim() !== "") return false;
  }
  const s = (readStr(rec, ["status", "state"]) ?? "open").toLowerCase();
  return !CLOSED_BUG_STATUSES.has(s);
}

export function normalizeSeverity(raw: string | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (s === "blocker" || s === "critical") return "critical";
  if (s === "major" || s === "high") return "high";
  if (s === "normal" || s === "medium") return "medium";
  if (s === "minor" || s === "trivial" || s === "low") return "low";
  return s === "" ? "unspecified" : s;
}

export function buildQualitySnapshot(input: {
  cases: unknown[];
  bugs: unknown[];
  gates: unknown[];
  executions: unknown[];
  projects: ScheduleProject[];
}): QualitySnapshot {
  const projectName = new Map(input.projects.map((p) => [p.id, p.name] as const));

  let passed = 0, failed = 0, blocked = 0, skipped = 0, notExecuted = 0;
  const perProject = new Map<string, { casesTotal: number; passed: number; failed: number }>();
  for (const raw of input.cases) {
    const outcome = caseOutcome(raw);
    if (outcome === "passed") passed++;
    else if (outcome === "failed") failed++;
    else if (outcome === "blocked") blocked++;
    else if (outcome === "skipped") skipped++;
    else notExecuted++;
    const pid = readStr(raw, ["projectId"]);
    if (pid) {
      const agg = perProject.get(pid) ?? { casesTotal: 0, passed: 0, failed: 0 };
      agg.casesTotal++;
      if (outcome === "passed") agg.passed++;
      if (outcome === "failed") agg.failed++;
      perProject.set(pid, agg);
    }
  }
  const casesTotal = input.cases.length;
  const executed = passed + failed;
  const touched = executed + blocked + skipped;

  let bugsTotal = 0, bugsOpen = 0;
  const severitySums = new Map<string, number>();
  const statusSums = new Map<string, number>();
  const bugsPerProject = new Map<string, { total: number; open: number }>();
  for (const raw of input.bugs) {
    bugsTotal++;
    const isOpen = bugIsOpen(raw);
    const pid = readStr(raw, ["projectId"]);
    if (pid) {
      const b = bugsPerProject.get(pid) ?? { total: 0, open: 0 };
      b.total++;
      if (isOpen) b.open++;
      bugsPerProject.set(pid, b);
    }
    if (!isOpen) continue;
    bugsOpen++;
    const sev = normalizeSeverity(readStr(raw, ["severity", "priority"]));
    severitySums.set(sev, (severitySums.get(sev) ?? 0) + 1);
    const st = (readStr(raw, ["status", "state"]) ?? "open").toLowerCase();
    statusSums.set(st, (statusSums.get(st) ?? 0) + 1);
  }

  let retestsTotal = 0, retestsPassed = 0;
  for (const raw of input.executions) {
    const rec = asRec(raw);
    const kind = (readStr(raw, ["type", "kind", "executionType"]) ?? "").toLowerCase();
    const flag = rec?.["isRetest"] === true;
    if (!kind.includes("retest") && !flag) continue;
    retestsTotal++;
    if (caseOutcome(raw) === "passed") retestsPassed++;
  }

  const gates: QualityGateView[] = input.gates.map((raw, i) => {
    const s = (readStr(raw, ["status", "result", "state"]) ?? "").toLowerCase();
    const status: QualityGateView["status"] = s.includes("pass")
      ? "passed"
      : s.includes("fail")
        ? "failed"
        : s.includes("block")
          ? "blocked"
          : "unknown";
    return {
      id: readStr(raw, ["id"]) ?? `gate-${i}`,
      name: readStr(raw, ["name", "title"]) ?? `بوابة ${i + 1}`,
      projectId: readStr(raw, ["projectId"]),
      status,
      detail: readStr(raw, ["detail", "notes", "description"]),
    };
  });

  return {
    available: casesTotal > 0 || bugsTotal > 0 || gates.length > 0,
    casesTotal, passed, failed, blocked, skipped, notExecuted,
    executed,
    passRate: executed === 0 ? null : passed / executed,
    coverage: casesTotal === 0 ? null : touched / casesTotal,
    bugsTotal, bugsOpen,
    bugsBySeverity: [...severitySums.entries()].map(([severity, count]) => ({ severity, count })).sort((a, b) => b.count - a.count),
    bugsByStatus: [...statusSums.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    bugsByProject: [...bugsPerProject.entries()]
      .map(([projectId, b]) => ({ projectId, projectName: projectName.get(projectId) ?? projectId, total: b.total, open: b.open }))
      .sort((a, b) => b.open - a.open),
    retestsTotal, retestsPassed,
    retestsAvailable: input.executions.length > 0,
    gates,
    byProject: [...perProject.entries()]
      .map(([projectId, agg]) => ({
        projectId,
        projectName: projectName.get(projectId) ?? projectId,
        casesTotal: agg.casesTotal,
        passed: agg.passed,
        failed: agg.failed,
        passRate: agg.passed + agg.failed === 0 ? null : agg.passed / (agg.passed + agg.failed),
      }))
      .sort((a, b) => b.casesTotal - a.casesTotal),
  };
}