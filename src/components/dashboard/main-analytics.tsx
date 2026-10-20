"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { getFilteredData } from "@/lib/dashboard-metrics";
import { useProjects } from "@/lib/project-context";
import { tasks as allTasks } from "@/data/tasks";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { formatCompactCurrency, daysUntil } from "@/lib/utils";
import type { Project, Task } from "@/types";

export function MainAnalytics() {
  const { filters } = useDashboard();
  const { projects } = useProjects();
  const { filteredProjects, filteredTasks } = getFilteredData(filters, projects, allTasks, []);

  // 1. Progress Over Time
  const progressData = filteredProjects[0]?.history?.map((h: { date: string; progress: number }) => {
    const entry: Record<string, string | number> = { date: h.date };
    filteredProjects.forEach((p: Project) => {
      entry[p.name] = p.history?.find((ph: { date: string; progress: number }) => ph.date === h.date)?.progress || 0;
    });
    return entry;
  }) || [];

  // 2. Project Comparison
  const comparisonData = filteredProjects.map((p: Project) => ({
    name: p.name,
    progress: p.progress,
  }));

  // 3. Distribution (by Status)
  const statusMap = new Map<string, number>();
  filteredProjects.forEach((p: Project) => {
    statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1);
  });
  const distributionData = Array.from(statusMap.entries()).map(([name, value], i: number) => ({
    name: name.replace("-", " "),
    value,
    colorVar: `var(--chart-${(i % 6) + 1})`,
  }));

  // 4. Task Completion
  const taskStatusMap = new Map<string, number>();
  filteredTasks.forEach((t: Task) => {
    taskStatusMap.set(t.status, (taskStatusMap.get(t.status) || 0) + 1);
  });
  const taskData = [{
    name: "Tasks",
    todo: taskStatusMap.get("todo") || 0,
    "in-progress": taskStatusMap.get("in-progress") || 0,
    "in-review": taskStatusMap.get("in-review") || 0,
    blocked: taskStatusMap.get("blocked") || 0,
    done: taskStatusMap.get("done") || 0,
  }];

  // 5. Financial Overview
  const financeData = [{
    name: "Finance",
    received: filteredProjects.reduce((s: number, p: Project) => s + p.paymentsReceived, 0),
    outstanding: filteredProjects.reduce((s: number, p: Project) => s + (p.contractValue - p.paymentsReceived), 0),
  }];

  // 6. Deadline Overview
  const deadlineBuckets = { overdue: 0, week: 0, month: 0, later: 0 };
  filteredTasks.forEach((t: Task) => {
    if (t.status === "done") return;
    const days = daysUntil(t.due);
    if (days < 0) deadlineBuckets.overdue++;
    else if (days <= 7) deadlineBuckets.week++;
    else if (days <= 30) deadlineBuckets.month++;
    else deadlineBuckets.later++;
  });
  const deadlineData = [
    { name: "Overdue", value: deadlineBuckets.overdue, colorVar: "var(--chart-6)" },
    { name: "Next 7 days", value: deadlineBuckets.week, colorVar: "var(--chart-4)" },
    { name: "Next 30 days", value: deadlineBuckets.month, colorVar: "var(--chart-1)" },
    { name: "Later", value: deadlineBuckets.later, colorVar: "var(--chart-2)" },
  ];

  if (filteredProjects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
        <p className="text-sm font-medium text-foreground">No projects match your filters</p>
        <p className="text-xs text-muted-foreground">Adjust your filters to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <AreaChartCard
        title="Project Progress Over Time"
        description="Historical progress snapshots (Demo Data)"
        data={progressData}
        xKey="date"
        series={filteredProjects.slice(0, 3).map((p: Project, i: number) => ({
          key: p.name,
          name: p.name,
          color: `hsl(var(--chart-${i + 1}))`,
        }))}
        format="percent"
        className="lg:col-span-2"
      />
      
      <DonutChartCard
        title="Project Distribution"
        description="By current status"
        data={distributionData}
        centerLabel="Projects"
        centerValue={String(filteredProjects.length)}
      />

      <BarChartCard
        title="Project Comparison"
        description="Progress comparison across selected projects"
        data={comparisonData}
        yKey="name"
        xKey="progress"
        series={[{ key: "progress", name: "Progress", color: "hsl(var(--chart-1))" }]}
        layout="vertical"
        format="percent"
        height={300}
        className="lg:col-span-2"
      />

      <BarChartCard
        title="Task Completion"
        description="Current task status breakdown"
        data={taskData}
        xKey="name"
        series={[
          { key: "todo", name: "Todo", color: "hsl(var(--muted-foreground))" },
          { key: "in-progress", name: "In Progress", color: "hsl(var(--chart-1))" },
          { key: "in-review", name: "In Review", color: "hsl(var(--chart-5))" },
          { key: "blocked", name: "Blocked", color: "hsl(var(--chart-6))" },
          { key: "done", name: "Done", color: "hsl(var(--chart-3))" },
        ]}
        stackId="a"
        height={300}
      />

      <BarChartCard
        title="Financial Overview"
        description="Received vs. Outstanding receivables"
        data={financeData}
        xKey="name"
        format="currency"
        series={[
          { key: "received", name: "Received", color: "hsl(var(--chart-3))" },
          { key: "outstanding", name: "Outstanding", color: "hsl(var(--chart-4))" },
        ]}
        height={300}
      />

      <DonutChartCard
        title="Deadline Overview"
        description="Upcoming task due dates"
        data={deadlineData.filter(d => d.value > 0)}
        centerLabel="Total Due"
        centerValue={String(deadlineData.reduce((s: number, d: { value: number }) => s + d.value, 0))}
      />
    </div>
  );
}