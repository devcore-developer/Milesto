import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProjectStatusBadge, PriorityBadge } from "@/components/metrics/status-badge";
import { DeadlineIndicator } from "@/components/common/deadline-indicator";
import { Progress } from "@/components/ui/progress";
import { projects } from "@/data/projects";
import { formatCurrency } from "@/lib/utils";

export function ShowcaseTable() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Project table</h2>
      <p className="text-xs text-muted-foreground">Compact, scannable list of active projects with progress, deadlines, and budget health.</p>
      <div className="rounded-lg border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[180px]">Progress</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Budget used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => {
              const used = Math.round((p.spent / p.budget) * 100);
              const overBudget = used > 90;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      <span className="text-2xs text-muted-foreground">{p.id} · {p.client}</span>
                    </div>
                  </TableCell>
                  <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={p.progress} className="h-1.5" />
                      <span className="w-8 text-right text-2xs tabular-nums text-muted-foreground">{p.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell><DeadlineIndicator iso={p.deadline} completed={p.status === "completed"} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6"><AvatarFallback className="text-2xs">{p.owner.initials}</AvatarFallback></Avatar>
                      <span className="hidden text-xs text-foreground sm:inline">{p.owner.name}</span>
                    </div>
                  </TableCell>
                  <TableCell><PriorityBadge priority={p.priority} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-medium tabular-nums text-foreground">
                        {formatCurrency(p.spent)} <span className="text-muted-foreground">/ {formatCurrency(p.budget)}</span>
                      </span>
                      <span className={`text-2xs tabular-nums ${overBudget ? "text-danger" : "text-muted-foreground"}`}>
                        {used}% used
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}