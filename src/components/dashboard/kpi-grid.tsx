"use client";

import { MetricCard } from "@/components/metrics/metric-card";
import { FolderKanban, Activity, TrendingUp, CheckCircle2, AlertTriangle, CalendarClock, FileText, DollarSign, Clock } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { getFilteredData, calculateKPIs } from "@/lib/dashboard-metrics";
import { useProjects } from "@/lib/project-context";
import { tasks as allTasks } from "@/data/tasks";
import { deliverables as allDeliverables } from "@/data/deliverables";
import { formatCompactCurrency, formatPercent } from "@/lib/utils";

export function KpiGrid() {
  const { filters } = useDashboard();
  const { projects } = useProjects();
  
  const { filteredProjects, filteredTasks, filteredDeliverables } = getFilteredData(filters, projects, allTasks, allDeliverables);
  const kpis = calculateKPIs(filteredProjects, filteredTasks, filteredDeliverables);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <MetricCard icon={FolderKanban} accent="blue" label="Total Projects" value={String(kpis.totalProjects)} hint="Across all active filters" />
      <MetricCard icon={Activity} accent="teal" label="Active Projects" value={String(kpis.activeProjects)} hint="In progress or at risk" />
      <MetricCard icon={TrendingUp} accent="green" label="Avg. Weighted Progress" value={formatPercent(kpis.weightedProgress)} hint="Weighted by project size" />
      <MetricCard icon={CheckCircle2} accent="green" label="Completed Tasks" value={String(kpis.completedTasks)} delta={{value: "+12%", direction: "up", tone: "positive"}} />
      <MetricCard icon={AlertTriangle} accent="amber" label="Overdue Tasks" value={String(kpis.overdueTasks)} delta={{value: "-2", direction: "down", tone: "positive"}} />
      <MetricCard icon={CalendarClock} accent="violet" label="Upcoming Deliverables" value={String(kpis.upcomingDeliverables)} hint="Due in 30 days" />
      <MetricCard icon={FileText} accent="blue" label="Total Contract Value" value={formatCompactCurrency(kpis.contractValue)} hint="Expected revenue" />
      <MetricCard icon={DollarSign} accent="green" label="Payments Received" value={formatCompactCurrency(kpis.paymentsReceived)} delta={{value: "+$4.2K", direction: "up", tone: "positive"}} />
      <MetricCard icon={Clock} accent="amber" label="Outstanding Receivables" value={formatCompactCurrency(kpis.outstandingReceivables)} hint="Awaiting payment" />
    </div>
  );
}