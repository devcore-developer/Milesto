"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DeadlineIndicator } from "@/components/common/deadline-indicator";
import { ProjectStatusBadge, PriorityBadge } from "@/components/metrics/status-badge";
import { formatCurrency } from "@/lib/utils";
import type { Project } from "@/types";
import { CalendarDays, DollarSign } from "lucide-react";

export function ProjectCard({ project }: { project: Project }) {
  const outstanding = project.contractValue - project.paymentsReceived;
  return (
    <Link href={`/projects/${project.id}`} className="block h-full">
      <Card className="flex h-full flex-col p-4 transition-shadow hover:shadow-md" interactive>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{project.name}</h3>
            <p className="line-clamp-2 text-xs text-muted-foreground text-pretty">{project.description}</p>
          </div>
          <Badge variant="outline" className="shrink-0">{project.category}</Badge>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
        </div>

        <div className="mb-4 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-1.5" />
        </div>

        <div className="mt-auto space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Deadline</span>
            <DeadlineIndicator iso={project.deadline} completed={project.status === "completed"} />
          </div>
          {project.contractValue > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Outstanding</span>
              <span className="font-medium text-foreground">{formatCurrency(outstanding)}</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}