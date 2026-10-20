"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineIndicator } from "@/components/common/deadline-indicator";
import { EmptyState } from "@/components/common/empty-state";
import { useDashboard } from "@/lib/dashboard-context";
import { getFilteredData } from "@/lib/dashboard-metrics";
import { useProjects } from "@/lib/project-context";
import { tasks as allTasks } from "@/data/tasks";
import { deliverables as allDeliverables } from "@/data/deliverables";
import { activities } from "@/data/activities";
import { projects as allProjects } from "@/data/projects"; // تمت الإضافة
import { CheckCircle2, AlertTriangle, CalendarClock, Activity as ActivityIcon } from "lucide-react";
import { daysUntil } from "@/lib/utils";
import type { Task } from "@/types";

export function MyDayActivity() {
  const { filters } = useDashboard();
  const { projects } = useProjects();
  
  // تم تحديث الاستدعاء ليتلقى 4 معطيات
  const { filteredTasks } = getFilteredData(filters, projects, allTasks, allDeliverables);

  const myDayTasks = filteredTasks
    .filter((t: Task) => t.status !== "done")
    .map((t: Task) => ({ ...t, days: daysUntil(t.due) }))
    .filter((t: Task & { days: number }) => t.days <= 7)
    .sort((a: Task & { days: number }, b: Task & { days: number }) => a.days - b.days)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* My Day */}
      <Card>
        <CardHeader>
          <CardTitle>My Day</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {myDayTasks.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="You're all caught up" description="No urgent tasks due in the next 7 days." className="mx-5 mb-5 border-0 bg-transparent py-8" />
          ) : (
            <ul className="divide-y divide-border">
              {myDayTasks.map((t: Task & { days: number }) => {
                const project = allProjects.find((p) => p.id === t.projectId);
                const isOverdue = t.days < 0;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/30">
                    <div className="flex items-start gap-3 min-w-0">
                      {isOverdue ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{project?.name || "Unknown"}</p>
                      </div>
                    </div>
                    <DeadlineIndicator iso={t.due} className="shrink-0" />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {activities.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/60 text-muted-foreground">
                  <ActivityIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{a.user}</span> {a.message}
                  </p>
                  <p className="text-2xs text-muted-foreground">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}