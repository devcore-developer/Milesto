"use client";

import { useState } from "react";

import { FinanceProvider, useFinance } from "@/lib/finance-context";
import { NotesProvider } from "@/lib/notes-context";
import { TimelineProvider, useTimeline } from "@/providers/TimelineProvider";
import { useProjects } from "@/lib/project-context";

type Project = ReturnType<typeof useProjects>["projects"][number];
type Milestone = ReturnType<typeof useTimeline>["milestones"][number];
type MilestoneStatus = Milestone["status"];
type FinanceObligation = ReturnType<typeof useFinance>["obligations"][number];
type FinanceTransaction = ReturnType<typeof useFinance>["transactions"][number];

type TabKey = "overview" | "delivery" | "finance";

type ProjectRow = {
  id: string;
  name: string;
  milestonesTotal: number;
  planned: number;
  inProgress: number;
  done: number;
  overdue: number;
  obligationCount: number;
  cancelledCount: number;
  totalDueMinor: number;
  totalPaidMinor: number;
  remainingMinor: number;
};

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "delivery", label: "Delivery & Progress" },
  { key: "finance", label: "Financial" },
];

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function statusLabel(status: MilestoneStatus): string {
  if (status === "done") return "Done";
  if (status === "in-progress") return "In progress";
  return "Planned";
}

function statusChipClass(status: MilestoneStatus): string {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in-progress") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatAmount(minor: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatDate(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function isOverdue(milestone: Milestone, today: string): boolean {
  if (milestone.status === "done") return false;
  return (
    typeof milestone.dueDate === "string" &&
    milestone.dueDate !== "" &&
    milestone.dueDate < today
  );
}

function paidMinorFor(
  obligationId: string,
  transactions: ReadonlyArray<FinanceTransaction>,
): number {
  let paid = 0;
  for (const tx of transactions) {
    if (tx.obligationId === obligationId && !tx.voidedAt) {
      paid += tx.amountMinor;
    }
  }
  return paid;
}

function projectDisplayName(project: Project): string {
  const candidate = project as unknown as { name?: unknown; title?: unknown };
  if (typeof candidate.name === "string" && candidate.name.trim().length > 0) {
    return candidate.name;
  }
  if (typeof candidate.title === "string" && candidate.title.trim().length > 0) {
    return candidate.title;
  }
  return "Unnamed project";
}

function projectNameFor(projectId: string, projects: ReadonlyArray<Project>): string {
  const project = projects.find((item) => item.id === projectId);
  return project ? projectDisplayName(project) : "Unknown project";
}

function buildProjectRows(
  projects: ReadonlyArray<Project>,
  milestones: ReadonlyArray<Milestone>,
  obligations: ReadonlyArray<FinanceObligation>,
  transactions: ReadonlyArray<FinanceTransaction>,
  today: string,
): ProjectRow[] {
  return projects.map((project) => {
    const projectMilestones = milestones.filter((item) => item.projectId === project.id);
    const done = projectMilestones.filter((item) => item.status === "done").length;
    const inProgress = projectMilestones.filter((item) => item.status === "in-progress").length;
    const planned = projectMilestones.filter((item) => item.status === "planned").length;
    const overdue = projectMilestones.filter((item) => isOverdue(item, today)).length;

    const projectObligations = obligations.filter(
      (item) => item.projectId === project.id && !item.cancelledAt,
    );
    const cancelledCount = obligations.filter(
      (item) => item.projectId === project.id && Boolean(item.cancelledAt),
    ).length;

    let totalDueMinor = 0;
    let totalPaidMinor = 0;
    for (const obligation of projectObligations) {
      totalDueMinor += obligation.amountMinor;
      totalPaidMinor += paidMinorFor(obligation.id, transactions);
    }

    return {
      id: project.id,
      name: projectDisplayName(project),
      milestonesTotal: projectMilestones.length,
      planned,
      inProgress,
      done,
      overdue,
      obligationCount: projectObligations.length,
      cancelledCount,
      totalDueMinor,
      totalPaidMinor,
      remainingMinor: Math.max(totalDueMinor - totalPaidMinor, 0),
    };
  });
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-rose-600"
          : "text-slate-900";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function ProgressBar({
  value,
  tone = "emerald",
}: {
  value: number;
  tone?: "emerald" | "sky";
}) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const barClass = tone === "sky" ? "bg-sky-500" : "bg-emerald-500";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function ReportsDashboard() {
  const { projects } = useProjects();
  const { obligations, transactions } = useFinance();
  const { milestones, hydrated } = useTimeline();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading reports data…
        </div>
      </div>
    );
  }

  const today = localToday();
  const rows = buildProjectRows(projects, milestones, obligations, transactions, today);

  const doneTotal = milestones.filter((item) => item.status === "done").length;
  const inProgressTotal = milestones.filter((item) => item.status === "in-progress").length;
  const overdueTotal = milestones.filter((item) => isOverdue(item, today)).length;
  const activeObligations = obligations.filter((item) => !item.cancelledAt).length;
  const cancelledObligations = obligations.filter((item) => Boolean(item.cancelledAt)).length;
  const totalDueMinor = rows.reduce((sum, row) => sum + row.totalDueMinor, 0);
  const totalPaidMinor = rows.reduce((sum, row) => sum + row.totalPaidMinor, 0);
  const remainingMinor = Math.max(totalDueMinor - totalPaidMinor, 0);

  const upcoming = milestones
    .filter(
      (item) =>
        item.status !== "done" &&
        typeof item.dueDate === "string" &&
        item.dueDate !== "",
    )
    .sort((a, b) => {
      const aDue = typeof a.dueDate === "string" ? a.dueDate : "";
      const bDue = typeof b.dueDate === "string" ? b.dueDate : "";
      if (aDue < bDue) return -1;
      if (aDue > bDue) return 1;
      return 0;
    })
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Reports &amp; Analytics</h1>
        <p className="text-sm text-slate-500">
          Cross-project analytics for delivery, progress, and financial health — updated as of{" "}
          {formatDate(today)}.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={
                active
                  ? "rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm"
                  : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <section className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Projects"
              value={formatInt(projects.length)}
              hint="Total projects tracked"
            />
            <StatCard
              label="Total milestones"
              value={formatInt(milestones.length)}
              hint="Across all projects"
            />
            <StatCard
              label="Completion rate"
              value={`${percentOf(doneTotal, milestones.length)}%`}
              tone="positive"
              hint="Completed milestones vs. total"
            />
            <StatCard label="In progress" value={formatInt(inProgressTotal)} tone="warning" />
            <StatCard
              label="Overdue"
              value={formatInt(overdueTotal)}
              tone={overdueTotal > 0 ? "danger" : "default"}
              hint="Compared to today"
            />
            <StatCard
              label="Active obligations"
              value={formatInt(activeObligations)}
              hint={
                cancelledObligations > 0
                  ? `${formatInt(cancelledObligations)} cancelled obligation(s) excluded`
                  : "Cancelled obligations excluded"
              }
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Project progress</h3>
            <div className="mt-4 space-y-4">
              {rows.map((row) => (
                <div key={row.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-800">{row.name}</span>
                    <span className="text-slate-500">
                      {formatInt(row.done)} / {formatInt(row.milestonesTotal)} done
                      {row.overdue > 0 ? ` · ${formatInt(row.overdue)} overdue` : ""}
                    </span>
                  </div>
                  <ProgressBar value={percentOf(row.done, row.milestonesTotal)} />
                </div>
              ))}
              {rows.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No projects yet — add a project from the Projects page and reports will show up
                  here.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "delivery" ? (
        <section className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Planned</th>
                  <th className="px-4 py-3 font-medium">In progress</th>
                  <th className="px-4 py-3 font-medium">Done</th>
                  <th className="px-4 py-3 font-medium">Overdue</th>
                  <th className="px-4 py-3 font-medium">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="text-slate-700">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3">{formatInt(row.planned)}</td>
                    <td className="px-4 py-3">{formatInt(row.inProgress)}</td>
                    <td className="px-4 py-3">{formatInt(row.done)}</td>
                    <td
                      className={
                        row.overdue > 0
                          ? "px-4 py-3 font-semibold text-rose-600"
                          : "px-4 py-3"
                      }
                    >
                      {formatInt(row.overdue)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProgressBar value={percentOf(row.done, row.milestonesTotal)} />
                        <span className="shrink-0 text-xs text-slate-500">
                          {percentOf(row.done, row.milestonesTotal)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Upcoming milestone due dates</h3>
            <ul className="mt-4 space-y-3">
              {upcoming.map((milestone) => {
                const dueLabel =
                  typeof milestone.dueDate === "string" && milestone.dueDate !== ""
                    ? formatDate(milestone.dueDate)
                    : "No due date";
                const overdueFlag = isOverdue(milestone, today);
                return (
                  <li
                    key={milestone.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900">{milestone.title}</p>
                      <p className="text-xs text-slate-500">
                        {projectNameFor(milestone.projectId, projects)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${statusChipClass(milestone.status)}`}
                      >
                        {statusLabel(milestone.status)}
                      </span>
                      <span
                        className={
                          overdueFlag
                            ? "text-xs font-semibold text-rose-600"
                            : "text-xs text-slate-500"
                        }
                      >
                        {dueLabel}
                      </span>
                    </div>
                  </li>
                );
              })}
              {upcoming.length === 0 ? (
                <li className="text-sm text-slate-500">
                  No open milestones with due dates.
                </li>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}

      {activeTab === "finance" ? (
        <section className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total due" value={formatAmount(totalDueMinor)} />
            <StatCard label="Total paid" value={formatAmount(totalPaidMinor)} tone="positive" />
            <StatCard
              label="Remaining"
              value={formatAmount(remainingMinor)}
              tone={remainingMinor > 0 ? "warning" : "positive"}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Active obligations</th>
                  <th className="px-4 py-3 font-medium">Cancelled</th>
                  <th className="px-4 py-3 font-medium">Total due</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Remaining</th>
                  <th className="px-4 py-3 font-medium">Payment progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="text-slate-700">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3">{formatInt(row.obligationCount)}</td>
                    <td className="px-4 py-3">{formatInt(row.cancelledCount)}</td>
                    <td className="px-4 py-3">{formatAmount(row.totalDueMinor)}</td>
                    <td className="px-4 py-3">{formatAmount(row.totalPaidMinor)}</td>
                    <td className="px-4 py-3">{formatAmount(row.remainingMinor)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProgressBar
                          tone="sky"
                          value={percentOf(row.totalPaidMinor, row.totalDueMinor)}
                        />
                        <span className="shrink-0 text-xs text-slate-500">
                          {percentOf(row.totalPaidMinor, row.totalDueMinor)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      No financial data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">
            Amounts are shown in each project&apos;s base currency without cross-currency
            conversion. Cancelled obligations and voided payments are excluded from the totals.
          </p>
        </section>
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <FinanceProvider>
      <NotesProvider>
        <TimelineProvider>
          <ReportsDashboard />
        </TimelineProvider>
      </NotesProvider>
    </FinanceProvider>
  );
}