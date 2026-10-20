"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ExecutionStatusBadge, GateStatusBadge } from "@/components/testing/testing-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/lib/project-context";
import {
  computeTestingKPIs,
  defaultTestingFilters,
  getLatestStatus,
  type TestingFilters,
} from "@/lib/testing-analytics";
import type { BugSeverity, ExecutionStatus, TestType } from "@/types";

const RESULT_ORDER: ExecutionStatus[] = ["Pass", "Fail", "Blocked", "Skipped", "Not Run"];

const RESULT_COLORS: Record<string, string> = {
  Pass: "#16a34a",
  Fail: "#dc2626",
  Blocked: "#d97706",
  Skipped: "#64748b",
  "Not Run": "#94a3b8",
};

const SEVERITY_ORDER: BugSeverity[] = ["Critical", "High", "Medium", "Low"];

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#d97706",
  Low: "#16a34a",
};

const TEST_TYPES: TestType[] = ["Manual", "Automated", "Integration", "API", "UI"];

interface TestingDashboardProps {
  filters?: TestingFilters;
  onFiltersChange?: (next: TestingFilters) => void;
  onReviewGates?: () => void;
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-red-600 dark:text-red-400"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

  return (
    <div className="card-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TestingDashboard({
  filters: filtersProp,
  onFiltersChange,
  onReviewGates,
}: TestingDashboardProps) {
  const [internalFilters, setInternalFilters] = useState<TestingFilters>(defaultTestingFilters);
  const filters = filtersProp ?? internalFilters;

  const updateFilters = (next: TestingFilters) => {
    if (onFiltersChange) {
      onFiltersChange(next);
    } else {
      setInternalFilters(next);
    }
  };

  const setFilter = <K extends keyof TestingFilters>(key: K, value: TestingFilters[K]) => {
    updateFilters({ ...filters, [key]: value } as TestingFilters);
  };

  const { projects, phases, getAllTestCases, getAllExecutions, getBugs, getGates } =
    useProjects();

  const executions = getAllExecutions();

  const kpis = useMemo(
    () =>
      computeTestingKPIs(
        {
          testCases: getAllTestCases(),
          executions: getAllExecutions(),
          bugs: getBugs(),
          gates: getGates(),
        },
        filters,
        { recentLimit: 8 },
      ),
    [getAllTestCases, getAllExecutions, getBugs, getGates, filters],
  );

  const resultRows = RESULT_ORDER.map((status) => ({
    status,
    count: kpis.results[status],
  }));

  const severityRows = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: kpis.bugsBySeverity[severity],
  })).filter((row) => row.count > 0);

  const severitySummary =
    severityRows.length > 0
      ? severityRows.map((row) => `${row.severity}: ${row.count}`).join(" · ")
      : "No open bugs";

  const caseTitleById = useMemo(() => {
    const map = new Map<string, string>();
    getAllTestCases().forEach((item) => map.set(item.id, item.title));
    return map;
  }, [getAllTestCases]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((project) => map.set(project.id, project.name));
    return map;
  }, [projects]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card-surface space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Search</span>
            <Input
              value={filters.search}
              placeholder="ID, title or tag…"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Project</span>
            <Select value={filters.projectId} onValueChange={(value) => setFilter("projectId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Phase</span>
            <Select value={filters.phaseId} onValueChange={(value) => setFilter("phaseId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All phases</SelectItem>
                {phases
                  .filter(
                    (phase) =>
                      filters.projectId === "all" || phase.projectId === filters.projectId,
                  )
                  .map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <Select
              value={filters.type}
              onValueChange={(value) => setFilter("type", value as TestingFilters["type"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TEST_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Latest result</span>
            <Select
              value={filters.latestStatus}
              onValueChange={(value) =>
                setFilter("latestStatus", value as TestingFilters["latestStatus"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {RESULT_ORDER.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilter("dateFrom", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilter("dateTo", event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="subtle"
              size="sm"
              className="w-full"
              onClick={() => updateFilters({ ...defaultTestingFilters })}
            >
              Reset filters
            </Button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total test cases"
          value={String(kpis.totalCases)}
          hint={`${kpis.totalExecutions} execution records · ${kpis.archivedCases} archived`}
        />
        <KpiCard
          label="Pass rate"
          value={`${kpis.passRate}%`}
          hint="Latest result per case — Pass ÷ (Pass + Fail) only"
          tone={kpis.passRate >= 80 ? "success" : kpis.passRate >= 50 ? "warning" : "danger"}
        />
        <KpiCard
          label="Open bugs"
          value={String(kpis.openBugs)}
          hint={severitySummary}
          tone={kpis.openBugs > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Rerun candidates"
          value={String(kpis.rerunCandidates.length)}
          hint="Cases whose latest result is Fail or Blocked"
          tone={kpis.rerunCandidates.length > 0 ? "danger" : "success"}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-4">
          <h3 className="text-sm font-semibold">Latest results distribution</h3>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resultRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {resultRows.map((row) => (
                    <Cell key={row.status} fill={RESULT_COLORS[row.status] ?? "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-surface p-4">
          <h3 className="text-sm font-semibold">Open bugs by severity</h3>
          {severityRows.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No open bugs for the current filters.
            </p>
          ) : (
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityRows}
                    dataKey="count"
                    nameKey="severity"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {severityRows.map((row) => (
                      <Cell
                        key={row.severity}
                        fill={SEVERITY_COLORS[row.severity] ?? "#64748b"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-4">
          <h3 className="text-sm font-semibold">Rerun candidates</h3>
          {kpis.rerunCandidates.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No failed or blocked cases waiting for a rerun.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {kpis.rerunCandidates.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    {item.id} — {item.title}
                  </span>
                  <ExecutionStatusBadge status={getLatestStatus(item.id, executions)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-surface p-4">
          <h3 className="text-sm font-semibold">Projects with failed critical tests</h3>
          {kpis.failedCriticalByProject.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No critical test failures right now.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {kpis.failedCriticalByProject.map((row) => (
                <li
                  key={row.projectId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">
                    {projectNameById.get(row.projectId) ?? row.projectId}
                  </span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {row.cases.length}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Phases awaiting approval</h3>
            {onReviewGates ? (
              <Button size="sm" variant="subtle" onClick={onReviewGates}>
                Open quality gates
              </Button>
            ) : null}
          </div>
          {kpis.phasesAwaitingApproval.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No phases are waiting for approval right now.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {kpis.phasesAwaitingApproval.map((gate) => {
                const phase = phases.find((item) => item.id === gate.phaseId);
                return (
                  <li
                    key={gate.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate">{phase?.name ?? gate.phaseId}</span>
                    <GateStatusBadge status={gate.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card-surface p-4">
          <h3 className="text-sm font-semibold">Recent executions</h3>
          {kpis.recentExecutions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No executions recorded yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Test case</th>
                    <th className="py-2 pr-3 font-medium">Result</th>
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Build</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.recentExecutions.map((execution) => (
                    <tr key={execution.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3">
                        {String(execution.date).slice(0, 10)}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="block max-w-[220px] truncate">
                          {caseTitleById.get(execution.testCaseId) ?? execution.testCaseId}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <ExecutionStatusBadge status={execution.status} />
                      </td>
                      <td className="py-2 pr-3 capitalize">{execution.source}</td>
                      <td className="py-2 pr-3">{execution.buildId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TestingDashboard;