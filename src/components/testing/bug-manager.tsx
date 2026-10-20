"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BugStatusBadge, SeverityBadge } from "@/components/testing/testing-badges";
import { bugSchema, type BugFormValues } from "@/lib/testing-schema";
import { OPEN_BUG_STATUSES } from "@/lib/quality-engine";
import { useProjects } from "@/lib/project-context";
import type { Bug, BugSeverity, BugStatus } from "@/types";

const SEVERITIES: BugSeverity[] = ["Critical", "High", "Medium", "Low"];
const BUG_STATUSES: BugStatus[] = ["Open", "In Progress", "Fixed", "Retest", "Closed", "Deferred"];
const NEEDS_RESOLUTION: BugStatus[] = ["Fixed", "Closed", "Deferred"];

function orUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function BugManager() {
  const { projects, phases, tasks, getBugs, createBug, updateBug, getTestCases } = useProjects();

  const [projectFilter, setProjectFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bug | null>(null);

  const bugs = getBugs();

  const visible = bugs.filter((b) => {
    if (projectFilter && b.projectId !== projectFilter) return false;
    if (severityFilter && b.severity !== severityFilter) return false;
    if (statusFilter && b.status !== statusFilter) return false;
    if (search) {
      const hay = `${b.id} ${b.title}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const openBySeverity = SEVERITIES.map((severity) => ({
    severity,
    count: bugs.filter((b) => b.severity === severity && OPEN_BUG_STATUSES.includes(b.status)).length,
  }));

  const form = useForm<BugFormValues>({
    resolver: zodResolver(bugSchema),
    defaultValues: {
      title: "", description: "", projectId: "", phaseId: "", taskId: "", testCaseId: "",
      severity: "Medium", status: "Open", steps: "", expected: "", actual: "", resolutionNotes: "",
    },
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = form;

  const projectId = watch("projectId");
  const status = watch("status");
  const projectPhases = phases.filter((p) => p.projectId === projectId);
  const phaseTasks = tasks.filter((t) => t.phaseId === watch("phaseId"));
  const projectCases = projectId ? getTestCases(projectId) : [];

  function openCreate() {
    setEditing(null);
    reset({
      title: "", description: "",
      projectId: projectFilter || projects[0]?.id || "",
      phaseId: "", taskId: "", testCaseId: "",
      severity: "Medium", status: "Open",
      steps: "", expected: "", actual: "", resolutionNotes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(bug: Bug) {
    setEditing(bug);
    reset({
      title: bug.title,
      description: bug.description ?? "",
      projectId: bug.projectId,
      phaseId: bug.phaseId ?? "",
      taskId: bug.taskId ?? "",
      testCaseId: bug.testCaseId ?? "",
      severity: bug.severity,
      status: bug.status,
      steps: bug.steps ?? "",
      expected: bug.expected ?? "",
      actual: bug.actual ?? "",
      resolutionNotes: bug.resolutionNotes ?? "",
    });
    setDialogOpen(true);
  }

  const onSubmit = handleSubmit((values) => {
    const payload = {
      ...values,
      description: orUndefined(values.description),
      phaseId: values.phaseId || undefined,
      taskId: values.taskId || undefined,
      testCaseId: values.testCaseId || undefined,
      steps: orUndefined(values.steps),
      expected: orUndefined(values.expected),
      actual: orUndefined(values.actual),
      resolutionNotes: orUndefined(values.resolutionNotes),
    };
    if (editing) updateBug(editing.id, payload);
    else createBug(payload);
    setDialogOpen(false);
  });

  return (
    <div className="grid gap-4">
      <div className="card-surface flex flex-wrap items-end gap-3 p-4">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bug ID or title…" className="w-52" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Project</label>
          <Select value={projectFilter || "all"} onValueChange={(v) => setProjectFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Severity</label>
          <Select value={severityFilter || "all"} onValueChange={(v) => setSeverityFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All severities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {BUG_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ms-auto">
          <Button onClick={openCreate}>New bug</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {openBySeverity.map((entry) => (
          <span key={entry.severity} className="card-surface flex items-center gap-2 px-3 py-2 text-sm">
            <SeverityBadge severity={entry.severity} />
            <span className="text-muted-foreground">{entry.count} open</span>
          </span>
        ))}
      </div>

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Bug</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Linked case</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="grid">
                    <span className="font-medium">{b.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">{b.id}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><SeverityBadge severity={b.severity} /></td>
                <td className="px-4 py-3"><BugStatusBadge status={b.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{projects.find((p) => p.id === b.projectId)?.name ?? b.projectId}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.testCaseId ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{String(b.updatedAt).slice(0, 10)}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="subtle" className="h-8 px-2 text-xs" onClick={() => openEdit(b)}>Edit</Button>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No bugs match these filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.id}` : "New bug"}</DialogTitle>
            <DialogDescription>Bugs are resolved here only — completing the related task never closes a bug automatically.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input {...register("title")} placeholder="Short, specific summary" />
              {errors.title?.message ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea {...register("description")} rows={2} placeholder="What is wrong?" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <Select value={projectId || undefined} onValueChange={(v) => { setValue("projectId", v); setValue("phaseId", ""); setValue("taskId", ""); setValue("testCaseId", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.projectId?.message ? <p className="text-xs text-red-600">{errors.projectId.message}</p> : null}
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Phase</label>
                <Select value={watch("phaseId") || "none"} onValueChange={(v) => { setValue("phaseId", v === "none" ? "" : v); setValue("taskId", ""); }}>
                  <SelectTrigger><SelectValue placeholder="No phase" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No phase</SelectItem>
                    {projectPhases.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Task (optional)</label>
                <Select value={watch("taskId") || "none"} onValueChange={(v) => setValue("taskId", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="No task" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No task</SelectItem>
                    {phaseTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Linked test case (optional)</label>
                <Select value={watch("testCaseId") || "none"} onValueChange={(v) => setValue("testCaseId", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="No linked case" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked case</SelectItem>
                    {projectCases.map((c) => <SelectItem key={c.id} value={c.id}>{c.id} — {c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Severity</label>
                <Select value={watch("severity")} onValueChange={(v) => setValue("severity", v as BugSeverity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={status} onValueChange={(v) => setValue("status", v as BugStatus, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUG_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Steps to reproduce</label>
                <Textarea {...register("steps")} rows={3} placeholder="Optional" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Expected</label>
                <Textarea {...register("expected")} rows={3} placeholder="Optional" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Actual</label>
                <Textarea {...register("actual")} rows={3} placeholder="Optional" />
              </div>
            </div>
            {NEEDS_RESOLUTION.includes(status) ? (
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Resolution notes (required for {status})</label>
                <Textarea {...register("resolutionNotes")} rows={2} placeholder="How was this fixed, or why was it deferred?" />
                {errors.resolutionNotes?.message ? <p className="text-xs text-red-600">{errors.resolutionNotes.message}</p> : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="subtle" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Save changes" : "Create bug"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}