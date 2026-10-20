"use client";

/**
 * Timeline & Deliverables workspace (Phase 8, hardened in Phase 10).
 *
 * Owns the toolbar (search, project filter, view switcher), the headline
 * stats, the add-event dialog and the shared event-details dialog. The three
 * views (Stream / List / Calendar) are purely presentational and receive
 * plain props — which is why none of them pass or accept a "today" prop on
 * the dialog anymore.
 */

import * as React from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Flag, List, Plus, Rows3, Search } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/lib/project-context";
import { useTimeline } from "@/providers/TimelineProvider";
import { todayISO } from "@/lib/timeline";
import type { TimelineEvent } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import { CalendarView } from "./CalendarView";
import { ListView } from "./ListView";
import { StreamView } from "./StreamView";
import { EventDetailsDialog } from "./timeline-ui";

type ViewMode = "stream" | "list" | "calendar";

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "stream", label: "Stream", icon: Rows3 },
  { value: "list", label: "List", icon: List },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
];

const selectClasses =
  "h-9 w-[180px] rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TimelineWorkspace() {
  const { events, today, persistenceError, addEvent } = useTimeline();
  const { projects } = useProjects();

  const [view, setView] = React.useState<ViewMode>("stream");
  const [query, setQuery] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<TimelineEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  // Add-event form state (values may be "" while typing — validated on submit).
  const [formTitle, setFormTitle] = React.useState("");
  const [formDate, setFormDate] = React.useState<string>(todayISO());
  const [formProject, setFormProject] = React.useState<string>("none");
  const [formNotes, setFormNotes] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const projectNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) map.set(project.id, project.name);
    return map;
  }, [projects]);

  const getProjectName = React.useCallback(
    (projectId: string | undefined) => (projectId ? projectNameById.get(projectId) : undefined),
    [projectNameById]
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (projectFilter !== "all" && event.projectId !== projectFilter) return false;
      if (!needle) return true;
      return (
        event.title.toLowerCase().includes(needle) ||
        (event.description?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [events, query, projectFilter]);

  const stats = React.useMemo(() => {
    const overdue = filtered.filter((e) => e.overdue && e.status === "planned").length;
    const done = filtered.filter((e) => e.status === "done").length;
    return { total: filtered.length, overdue, done };
  }, [filtered]);

  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleSelect = React.useCallback((event: TimelineEvent) => {
    setSelected(event);
    setDetailsOpen(true);
  }, []);

  const openAddDialog = React.useCallback(() => {
    setFormTitle("");
    setFormDate(todayISO());
    setFormProject("none");
    setFormNotes("");
    setFormError(null);
    setAddOpen(true);
  }, []);

  const handleAddSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const result = addEvent({
        title: formTitle,
        date: formDate,
        projectId: formProject === "none" ? undefined : formProject,
        description: formNotes.trim() === "" ? undefined : formNotes.trim(),
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setAddOpen(false);
    },
    [addEvent, formDate, formNotes, formProject, formTitle]
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Timeline & Deliverables"
        description="Milestones, deliverables and payment dates on one calendar — derived live from project, timeline and finance records."
        actions={
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4" aria-hidden />
            Add event
          </Button>
        }
      />

      {persistenceError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-warning/60 bg-warning-soft/60 px-4 py-3 text-sm text-warning-foreground"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{persistenceError} Timeline changes may not survive a refresh in this browser.</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Events in view</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats.total}</p>
        </div>
        <div className={cn("rounded-lg border border-border bg-card p-4", stats.overdue > 0 && "border-danger/60")}>
          <p className="text-xs font-medium text-muted-foreground">Overdue</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", stats.overdue > 0 ? "text-danger" : "text-foreground")}>
            {stats.overdue}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Completed</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums text-foreground">
            <CheckCircle2 className="h-4 w-4 text-success-foreground" aria-hidden />
            {stats.done}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={handleSearchChange}
            placeholder="Search events…"
            aria-label="Search timeline events"
            className="w-56 pl-8"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProjectFilter(e.target.value)}
          className={selectClasses}
          aria-label="Filter by project"
        >
          <option value="all">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-1 rounded-lg border border-border p-1" role="tablist" aria-label="Timeline view">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = view === option.value;
            return (
              <Button
                key={option.value}
                size="sm"
                variant={active ? "subtle" : "ghost"}
                role="tab"
                aria-selected={active}
                onClick={() => setView(option.value)}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {view === "stream" && (
        <StreamView events={filtered} today={today} getProjectName={getProjectName} onSelect={handleSelect} />
      )}
      {view === "list" && (
        <ListView events={filtered} today={today} getProjectName={getProjectName} onSelect={handleSelect} />
      )}
      {view === "calendar" && (
        <CalendarView events={filtered} today={today} getProjectName={getProjectName} onSelect={handleSelect} />
      )}

      <EventDetailsDialog
        event={selected}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        projectName={getProjectName(selected?.projectId)}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add timeline event</DialogTitle>
            <DialogDescription>
              Custom events appear alongside milestones, deliverables and payment dates.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={formTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormTitle(e.target.value)}
                placeholder="e.g. Kick-off workshop"
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={formDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-project">Project (optional)</Label>
              <Select
                value={formProject}
                onValueChange={(value: string) => setFormProject(value)}
              >
                <SelectTrigger id="event-project" aria-label="Project">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-notes">Notes (optional)</Label>
              <Textarea
                id="event-notes"
                value={formNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormNotes(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
            {formError && (
              <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Flag className="h-4 w-4" aria-hidden />
                Save event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TimelineWorkspace;