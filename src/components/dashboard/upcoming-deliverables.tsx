"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeadlineIndicator } from "@/components/common/deadline-indicator";
import { EmptyState } from "@/components/common/empty-state";
import { useDashboard } from "@/lib/dashboard-context";
import { getFilteredData } from "@/lib/dashboard-metrics";
import { useProjects } from "@/lib/project-context";
import { tasks as allTasks } from "@/data/tasks";
import { deliverables as allDeliverables } from "@/data/deliverables";
import { projects as allProjects } from "@/data/projects"; // تمت الإضافة
import { Package } from "lucide-react";

export function UpcomingDeliverables() {
  const { filters } = useDashboard();
  const { projects } = useProjects();
  
  // تم تحديث الاستدعاء ليتلقى 4 معطيات
  const { filteredDeliverables } = getFilteredData(filters, projects, allTasks, allDeliverables);

  const sorted = [...filteredDeliverables]
    .filter((d) => d.status !== "approved")
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Deliverables</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <EmptyState icon={Package} title="No upcoming deliverables" description="All deliverables for the current filter are approved." className="mx-5 mb-5 border-0 bg-transparent py-8" />
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((d) => {
              const project = allProjects.find((p) => p.id === d.projectId);
              return (
                <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{project?.name || "Unknown Project"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={d.status === "in-progress" ? "info" : "neutral"} className="capitalize">
                      {d.status.replace("-", " ")}
                    </Badge>
                    <DeadlineIndicator iso={d.due} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}