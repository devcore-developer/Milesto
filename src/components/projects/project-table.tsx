"use client";

import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProjectStatusBadge, PriorityBadge } from "@/components/metrics/status-badge";
import { DeadlineIndicator } from "@/components/common/deadline-indicator";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import type { Project } from "@/types";

export function ProjectTable({ projects }: { projects: Project[] }) {
  return (
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
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id} className="cursor-pointer" onClick={() => window.location.href = `/projects/${p.id}`}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <span className="text-2xs text-muted-foreground">{p.category}</span>
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
                <span className="text-xs font-medium tabular-nums text-foreground">
                  {p.contractValue > 0 ? formatCurrency(p.contractValue) : "—"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}