import type { Project, Task, Deliverable } from "@/types";
import type { DashboardFilters } from "./dashboard-context";
import { daysUntil } from "./utils";

export function getFilteredData(filters: DashboardFilters, allProjects: Project[], allTasks: Task[], allDeliverables: Deliverable[]) {
  const filteredProjects = allProjects.filter((p: Project) => {
    if (filters.category !== "all" && p.category !== filters.category) return false;
    if (filters.status !== "all" && p.status !== filters.status) return false;
    if (filters.projectId !== "all" && p.id !== filters.projectId) return false;
    return true;
  });

  const projectIds = new Set(filteredProjects.map((p: Project) => p.id));
  const filteredTasks = allTasks.filter((t: Task) => projectIds.has(t.projectId));
  const filteredDeliverables = allDeliverables.filter((d: Deliverable) => projectIds.has(d.projectId));

  return { filteredProjects, filteredTasks, filteredDeliverables };
}

export function calculateKPIs(projects: Project[], tasks: Task[], deliverables: Deliverable[]) {
  const activeProjects = projects.filter((p: Project) => p.status === "in-progress" || p.status === "at-risk").length;
  
  const totalWeight = projects.reduce((sum: number, p: Project) => sum + p.weight, 0);
  const weightedProgress = totalWeight > 0 
    ? projects.reduce((sum: number, p: Project) => sum + (p.progress * p.weight), 0) / totalWeight 
    : 0;

  const completedTasks = tasks.filter((t: Task) => t.status === "done").length;
  const overdueTasks = tasks.filter((t: Task) => t.status !== "done" && daysUntil(t.due) < 0).length;
  
  const upcomingDeliverables = deliverables.filter((d: Deliverable) => d.status !== "approved" && daysUntil(d.due) >= 0).length;

  const contractValue = projects.reduce((sum: number, p: Project) => sum + p.contractValue, 0);
  const paymentsReceived = projects.reduce((sum: number, p: Project) => sum + p.paymentsReceived, 0);
  const outstandingReceivables = contractValue - paymentsReceived;

  return {
    totalProjects: projects.length,
    activeProjects,
    weightedProgress: Math.round(weightedProgress),
    completedTasks,
    overdueTasks,
    upcomingDeliverables,
    contractValue,
    paymentsReceived,
    outstandingReceivables,
  };
}