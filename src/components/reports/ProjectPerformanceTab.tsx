"use client";

/**
 * Reports — Project performance tab (Phase 9, hardened in Phase 10).
 *
 * Fix notes (Phase 10 audit):
 * - milestones/deliverables now come from useReports() (provided by
 *   ReportsProvider through the Timeline module) with their real types, so
 *   every callback parameter is explicitly typed (no implicit any).
 * - The milestone status label map is fully typed Record<MilestoneStatus, …>.
 * - Money is never summed across currencies: this tab reports per-obligation
 *   overdue counts and per-project rows in the project's own currency only.
 * - obligationRemaining is now a local helper — "@/lib/finance" never
 *   exported it — typed directly against the Finance module's real types,
 *   and obligation fields follow the real records (cancelledAt, not cancelled).
 */

import * as React from "react";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectStatusBadge } from "@/components/metrics/status-badge";
import { useReports } from "@/providers/ReportsProvider";
import {
  type Milestone,
  type MilestoneStatus,
  type TimelineDeliverable,
} from "@/lib/timeline";
import { cn } from "@/lib/utils";
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

const MILESTONE_LABELS: Record<MilestoneStatus, string> = {
  planned: "Planned",
  "in-progress": "In Progress",
  done: "Done",
  "at-risk": "At Risk",
  cancelled: "Cancelled",
};

interface ProjectRow {
  id: string;
  name: string;
  status: React.ComponentProps<typeof ProjectStatusBadge>["status"];
  progress: number;
  milestonesDone: number;
  milestonesTotal: number;
  deliverablesApproved: number;
  deliverablesTotal: number;
  openBugs: number;
  overduePayments: number;
}

function isMilestoneClosed(milestone: Milestone): boolean {
  return milestone.status === "done";
}

function isDeliverableApproved(deliverable: TimelineDeliverable): boolean {
  return deliverable.status === "approved";
}

export function ProjectPerformanceTab() {
  const { today, projects, milestones, deliverables, bugs, obligations, transactions } = useReports();

  const [projectFilter, setProjectFilter] = React.useState<string>("all");

  const rows = React.useMemo<ProjectRow[]>(() => {
    const scoped = projectFilter === "all" ? projects : projects.filter((p) => p.id === projectFilter);
    return scoped
      .map((project) => {
        const projectMilestones = milestones.filter((m) => m.projectId === project.id);
        const projectDeliverables = deliverables.filter((d) => d.projectId === project.id);
        const projectBugs = bugs.filter((b) => b.projectId === project.id && b.status !== "Closed");
        const projectOverduePayments = obligations.filter(
          (o) => o.projectId === project.id && !o.cancelledAt && o.dueDate < today && obligationRemaining(o, transactions) > 0
        ).length;
        return {
          id: project.id,
          name: project.name,
          status: project.status,
          progress: project.progress,
          milestonesDone: projectMilestones.filter(isMilestoneClosed).length,
          milestonesTotal: projectMilestones.length,
          deliverablesApproved: projectDeliverables.filter(isDeliverableApproved).length,
          deliverablesTotal: projectDeliverables.length,
          openBugs: projectBugs.length,
          overduePayments: projectOverduePayments,
        };
      })
      .sort((a: ProjectRow, b: ProjectRow) => a.name.localeCompare(b.name));
  }, [bugs, deliverables, milestones, obligations, projectFilter, projects, today, transactions]);

  const hasAnyRow = projects.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Delivery posture per project: milestones, deliverables, open bugs and overdue payments.
        </p>
        <select
          value={projectFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProjectFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter by project"
        >
          <option value="all">All projects</option>
          {[...projects]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
        </select>
      </div>

      {!hasAnyRow ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to see its delivery performance here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-28 text-right">Progress</TableHead>
                <TableHead className="w-32 text-right">Milestones</TableHead>
                <TableHead className="w-32 text-right">Deliverables</TableHead>
                <TableHead className="w-24 text-right">Open bugs</TableHead>
                <TableHead className="w-28 text-right">Overdue pays</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.progress}%</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      row.milestonesTotal > 0 && row.milestonesDone < row.milestonesTotal && "text-foreground"
                    )}
                  >
                    {row.milestonesDone}/{row.milestonesTotal}
                    {row.milestonesTotal > 0 && row.milestonesDone === row.milestonesTotal && (
                      <Badge variant="success" className="ml-2">
                        All done
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.deliverablesApproved}/{row.deliverablesTotal}
                  </TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", row.openBugs > 0 && "font-medium text-danger")}
                  >
                    {row.openBugs}
                  </TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", row.overduePayments > 0 && "font-medium text-danger")}
                  >
                    {row.overduePayments}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Milestone counts use the timeline module&rsquo;s records ({MILESTONE_LABELS.done} counts as closed). Payment
        counts include only active obligations past their due date with a remaining balance.
      </p>
    </div>
  );
}

export default ProjectPerformanceTab;