"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/project-context";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectTable } from "@/components/projects/project-table";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { LayoutGrid, Table as TableIcon, Plus, Search } from "lucide-react";
import { PROJECT_CATEGORIES } from "@/lib/project-categories";

function ProjectsContent() {
  const { projects } = useProjects();
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sortBy, setSortBy] = useState("lastUpdated");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (search) {
      result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()));
    }
    if (category !== "all") result = result.filter(p => p.category === category);
    if (status !== "all") result = result.filter(p => p.status === status);
    if (priority !== "all") result = result.filter(p => p.priority === priority);

    switch (sortBy) {
      case "name": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "deadline": result.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()); break;
      case "progress": result.sort((a, b) => b.progress - a.progress); break;
      case "lastUpdated": default: result.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()); break;
    }

    return result;
  }, [projects, search, category, status, priority, sortBy]);

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === "in-progress" || p.status === "at-risk").length;
  const completedProjects = projects.filter(p => p.status === "completed").length;
  const overdueProjects = projects.filter(p => p.status !== "completed" && new Date(p.deadline) < new Date()).length;

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setStatus("all");
    setPriority("all");
    setSortBy("lastUpdated");
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Projects" 
        description="Manage your project portfolio, track progress, and categorize work."
        actions={<Button onClick={() => setIsFormOpen(true)}><Plus className="h-4 w-4" /> Create Project</Button>}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-semibold">{totalProjects}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-semibold text-blue-600">{activeProjects}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-semibold text-green-600">{completedProjects}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-xl font-semibold text-red-600">{overdueProjects}</p></Card>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search projects..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {PROJECT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
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
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lastUpdated">Recently Updated</SelectItem>
              <SelectItem value="deadline">Deadline</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden rounded-md border border-border p-1 md:flex">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={view === "table" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setView("table")}><TableIcon className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm font-medium">No projects found</p>
          <p className="text-xs text-muted-foreground">Try adjusting your search or filters.</p>
          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">Clear filters</Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProjects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : (
        <ProjectTable projects={filteredProjects} />
      )}

      <ProjectFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  );
}

export default function ProjectsPage() {
  return <ProjectsContent />;
}