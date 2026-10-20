"use client";

/**
 * Reports — Overview tab (Phase 9, hardened in Phase 10).
 *
 * Fix notes (Phase 10 audit):
 * - Deliverable/milestone data now comes from the Reports context itself
 *   (ReportProvider mounts the Timeline provider), not from a missing module.
 * - DeliverableStatus is imported from "@/lib/timeline" (the type never lived
 *   in "@/types/reports"), so the label/variant maps are fully typed again.
 * - Sorting tolerates deliverables without an agreed due date.
 * - The local StatCard no longer accepts children — values are plain props.
 * - obligationRemaining/formatMoney are now local helpers — "@/lib/finance"
 *   and "@/lib/finance-format" never exported them — typed directly against
 *   the Finance module's real types (FinanceObligation / FinanceTransaction).
 * - Obligation fields follow the real Finance records: cancelledAt + title.
 */

import * as React from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { useReports } from "@/providers/ReportsProvider";
import { formatTimelineDate, type DeliverableStatus, type MilestoneStatus } from "@/lib/timeline";
import { DeliverableStatusBadge, MILESTONE_STATUS_LABELS } from "@/components/timeline/timeline-ui";
import { cn } from "@/lib/utils";
import type { TimelineDeliverable } from "@/lib/timeline";
import type { FinanceObligation, FinanceTransaction } from "@/types/finance";

/* ------------------------------ money helpers ----------------------------- */

/**
 * Remaining balance of a single obligation in its own minor units —
 * obligation amount minus every non-voided transaction recorded against it.
 * A cancelled obligation is settled by definition (remaining = 0).
 */
function obligationRemaining(
  obligation: Pick<FinanceObligation, "id" | "amountMinor" | "cancelledAt">,
  transactions: readonly FinanceTransaction[],
): number {
  if (obligation.cancelledAt) return 0;
  const paid = transactions
    .filter((t) => t.obligationId === obligation.id && !t.voidedAt)
    .reduce((sum, t) => sum + t.amountMinor, 0);
  return Math.max(obligation.amountMinor - paid, 0);
}

/** Formats integer minor units as a currency string (never mixes currencies). */
function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

/* ------------------------------ stat cards ------------------------------- */

type StatTone = "default" | "danger" | "success" | "warning";

const TONE_TEXT: Record<StatTone, string> = {
  default: "text-foreground",
  danger: "text-danger",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
}

function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/* -------------------------------- helpers -------------------------------- */

function dueSortKey(dueDate: string | undefined): string {
  // Deliverables without an agreed date sort last, deterministically.
  return dueDate ?? "9999-12-31";
}

const MILESTONE_ATTENTION_ORDER: Record<MilestoneStatus, number> = {
  "at-risk": 0,
  planned: 1,
  "in-progress": 2,
  done: 3,
  cancelled: 4,
};

function latestExecutionByCase(
  executions: { testCaseId: string; status: string; date: string }[]
): Map<string, { status: string; date: string }> {
  const latest = new Map<string, { status: string; date: string }>();
  for (const execution of executions) {
    const current = latest.get(execution.testCaseId);
    if (!current || execution.date > current.date) {
      latest.set(execution.testCaseId, { status: execution.status, date: execution.date });
    }
  }
  return latest;
}

/* --------------------------------- tab ----------------------------------- */

export function OverviewTab() {
  const { today, projects, tasks, milestones, deliverables, obligations, transactions, executions } = useReports();

  const activeProjects = projects.filter((p) => p.status === "in-progress" || p.status === "at-risk").length;

  const overdueTasks = tasks.filter((t) => t.status !== "done" && t.due < today).length;

  const dueSoonDeliverables = React.useMemo(
    () =>
      [...deliverables]
        .filter((d) => d.status !== "approved")
        .sort((a, b) => dueSortKey(a.dueDate).localeCompare(dueSortKey(b.dueDate)))
        .slice(0, 6),
    [deliverables]
  );

  const attentionMilestones = React.useMemo(
    () =>
      [...milestones]
        .filter((m) => m.status === "at-risk" || (m.status !== "done" && m.status !== "cancelled" && m.dueDate < today))
        .sort((a, b) => {
          const byOrder = MILESTONE_ATTENTION_ORDER[a.status] - MILESTONE_ATTENTION_ORDER[b.status];
          if (byOrder !== 0) return byOrder;
          return a.dueDate.localeCompare(b.dueDate);
        })
        .slice(0, 6),
    [milestones, today]
  );

  const overduePayments = React.useMemo(
    () =>
      obligations
        .filter((o) => !o.cancelledAt && o.dueDate < today && obligationRemaining(o, transactions) > 0)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6),
    [obligations, transactions, today]
  );

  const quality = React.useMemo(() => {
    const latest = latestExecutionByCase(executions.map((e) => ({ testCaseId: e.testCaseId, status: e.status, date: e.date })));
    const total = latest.size;
    let passed = 0;
    for (const entry of latest.values()) {
      if (entry.status === "Pass") passed += 1;
    }
    return { total, passed, rate: total > 0 ? Math.round((passed / total) * 100) : null };
  }, [executions]);

  const projectNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) map.set(project.id, project.name);
    return map;
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active projects" value={activeProjects} hint={`${projects.length} total`} />
        <StatCard label="Overdue tasks" value={overdueTasks} tone={overdueTasks > 0 ? "danger" : "default"} hint="Not done, past due" />
        <StatCard
          label="Deliverables in flight"
          value={deliverables.filter((d) => d.status !== "approved").length}
          hint={`${deliverables.filter((d) => d.status === "approved").length} approved`}
        />
        <StatCard
          label="Overdue payments"
          value={obligations.filter((o) => !o.cancelledAt && o.dueDate < today && obligationRemaining(o, transactions) > 0).length}
          tone="warning"
          hint="Open balance past due date"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
              Deliverables due next
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueSoonDeliverables.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing pending"
                description="Every deliverable is approved, or none carry a due date yet."
                className="py-8"
              />
            ) : (
              dueSoonDeliverables.map((deliverable: TimelineDeliverable) => (
                <div
                  key={deliverable.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{deliverable.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {projectNameById.get(deliverable.projectId) ?? deliverable.projectId}
                      {deliverable.dueDate ? ` · due ${formatTimelineDate(deliverable.dueDate)}` : " · no date agreed"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {deliverable.dueDate && deliverable.dueDate < today && (
                      <Badge variant="danger">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Overdue
                      </Badge>
                    )}
                    <DeliverableStatusBadge status={deliverable.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden />
              Milestones needing attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {attentionMilestones.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All milestones on track"
                description="No milestone is at risk or past its due date."
                className="py-8"
              />
            ) : (
              attentionMilestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{milestone.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {projectNameById.get(milestone.projectId) ?? milestone.projectId} · due{" "}
                      {formatTimelineDate(milestone.dueDate)}
                    </p>
                  </div>
                  <Badge
                    variant={milestone.status === "at-risk" ? "danger" : milestone.dueDate < today ? "warning" : "info"}
                  >
                    {MILESTONE_STATUS_LABELS[milestone.status]}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
              Overdue payment obligations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overduePayments.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No obligation is past its due date with an open balance.
              </p>
            ) : (
              overduePayments.map((obligation) => {
                const remaining = obligationRemaining(obligation, transactions);
                return (
                  <div
                    key={obligation.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{obligation.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {projectNameById.get(obligation.projectId) ?? obligation.projectId} · was due{" "}
                        {formatTimelineDate(obligation.dueDate)}
                      </p>
                    </div>
                    <Badge variant="danger">{formatMoney(remaining, obligation.currency)}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
              Quality snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Latest pass rate</span>
              <span className={cn("text-2xl font-semibold tabular-nums", quality.rate === null && "text-muted-foreground")}>
                {quality.rate === null ? "—" : `${quality.rate}%`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {quality.total === 0
                ? "No test executions recorded yet — run cases to see quality trends here."
                : `${quality.passed} of ${quality.total} test cases have a latest result of Pass.`}
            </p>
            <p className="text-xs text-muted-foreground">
              Derived from execution history only — never from archived or duplicated records.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default OverviewTab;