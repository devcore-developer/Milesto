"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FilterX } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { projects } from "@/data/projects";

export function DashboardFilters() {
  const { filters, setFilters, resetFilters } = useDashboard();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Filters:</span>
      
      <Select
        value={filters.timeRange}
        onValueChange={(v) => setFilters((f) => ({ ...f, timeRange: v as any }))}
      >
        <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Time Range" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
          <SelectItem value="ytd">Year to Date</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.category}
        onValueChange={(v) => setFilters((f) => ({ ...f, category: v as any }))}
      >
        <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="Internal">Internal</SelectItem>
          <SelectItem value="Client Work">Client Work</SelectItem>
          <SelectItem value="R&D">R&D</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any }))}
      >
        <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="planning">Planning</SelectItem>
          <SelectItem value="in-progress">In Progress</SelectItem>
          <SelectItem value="on-hold">On Hold</SelectItem>
          <SelectItem value="at-risk">At Risk</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.projectId}
        onValueChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}
      >
        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground hover:text-foreground">
        <FilterX className="mr-1.5 h-3.5 w-3.5" /> Clear
      </Button>
    </div>
  );
}