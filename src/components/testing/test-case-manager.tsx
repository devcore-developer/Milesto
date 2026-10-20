"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExecutionStatusBadge } from "@/components/testing/testing-badges";
import { RecordExecutionDialog } from "@/components/testing/record-execution-dialog";
import { filterTestCases, getLatestStatus, type TestingFilters } from "@/lib/testing-analytics";
import { testCaseSchema, type TestCaseFormValues } from "@/lib/testing-schema";
import { useProjects } from "@/lib/project-context";
import type { TestCase, TestPriority, TestRiskLevel, TestType } from "@/types";

const TEST_TYPES: TestType[] = ["Manual", "Automated", "Integration", "API", "UI"];
const PRIORITIES: TestPriority[] = ["Low", "Medium", "High", "Critical"];
const RISK_LEVELS: TestRiskLevel[] = ["Low", "Medium", "High"];

function orUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function TestCaseManager({ filters, onFiltersChange }: {
  filters: TestingFilters;
  onFiltersChange: (next: TestingFilters) => void;
}) {
  const {
    projects, phases, tasks,
    getAllTestCases, getAllExecutions, getExecutions,
    createTestCase, updateTestCase, archiveTestCase, duplicateTestCase, deleteTestCase,
  } = useProjects();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TestCase | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [historyCase, setHistoryCase] = useState<TestCase | null>(null);
  const [execCase, setExecCase] = useState<TestCase | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const allCases = getAllTestCases();
  const executions = getAllExecutions();
  const visible = filterTestCases(allCases, executions, filters, { includeArchived });

  const runsByCase = new Map<string, number>();
  for (const ex of executions) runsByCase.set(ex.testCaseId, (runsByCase.get(ex.testCaseId) ?? 0) + 1);

  const form = useForm<TestCaseFormValues>({
    resolver: zodResolver(testCaseSchema),
    defaultValues: {
      title: "", description: "", projectId: "", phaseId: "", taskId: "",
      type: "Manual", priority: "Medium", riskLevel: "Medium",
      preconditions: "", steps: [""], expected: "",
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = form;

  const steps = watch("steps");
  const projectId = watch("projectId");
  const phaseId = watch("phaseId");
  const projectPhases = phases.filter((p) => p.projectId === projectId);
  const phaseTasks = tasks.filter((t) => t.phaseId === phaseId);

  const stepsRootError = (errors.steps as { message?: string } | undefined)?.message;
  const stepItemError = (index: number) => (errors.steps as Array<{ message?: string }> | undefined)?.[index]?.message;

  function openCreate() {
    setEditing(null);
    setTagsText("");
    setDeleteMessage(null);
    form.reset({
      title: "", description: "",
      projectId: (filters.projectId !== "all" && filters.projectId) || projects[0]?.id || "",
      phaseId: "", taskId: "",
      type: "Manual", priority: "Medium", riskLevel: "Medium",
      preconditions: "", steps: [""], expected: "",
    });
    setDialogOpen(true);
  }

  function openEdit(caseItem: TestCase) {
    setEditing(caseItem);
    setTagsText((caseItem.tags ?? []).join(", "));
    form.reset({
      title: caseItem.title,
      description: caseItem.description ?? "",
      projectId: caseItem.projectId,
      phaseId: caseItem.phaseId ?? "",
      taskId: caseItem.taskId ?? "",
      type: caseItem.type,
      priority: caseItem.priority,
      riskLevel: caseItem.riskLevel,
      preconditions: caseItem.preconditions ?? "",
      steps: caseItem.steps.length > 0 ? [...caseItem.steps] : [""],
      expected: caseItem.expected,
    });
    setDialogOpen(true);
  }

  function updateStep(index: number, value: string) {
    const next = [...steps];
    next[index] = value;
    setValue("steps", next);
  }

  function addStep() {
    setValue("steps", [...steps, ""]);
  }

  function removeStep(index: number) {
    const next = steps.filter((_, i) => i !== index);
    setValue("steps", next.length > 0 ? next : [""]);
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const moved = next[index]!;
    next[index] = next[target]!;
    next[target] = moved;
    setValue("steps", next);
  }

  const onSubmit = handleSubmit((values) => {
    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      ...values,
      steps: values.steps.map((s) => s.trim()).filter(Boolean),
      description: orUndefined(values.description),
      preconditions: orUndefined(values.preconditions),
      phaseId: values.phaseId || undefined,
      taskId: values.taskId || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
    if (editing) updateTestCase(editing.id, payload);
    else createTestCase(payload);
    setDialogOpen(false);
  });

  function handleDelete(caseItem: TestCase) {
    const ok = deleteTestCase(caseItem.id);
    if (ok) {
      setDeleteMessage(null);
      return;
    }
    setDeleteMessage(`${caseItem.id} has execution history, so it cannot be deleted. Archive it instead — the history stays intact.`);
  }

  return (
    <div className="grid gap-4">
      <div className="card-surface flex flex-wrap items-end gap-3 p-4">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <Input value={filters.search ?? ""} onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })} placeholder="ID, title or tag…" className="w-52" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Project</label>
          <Select value={filters.projectId || "all"} onValueChange={(v) => onFiltersChange({ ...filters, projectId: v, phaseId: "all" })}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <Select value={filters.type || "all"} onValueChange={(v) => onFiltersChange({ ...filters, type: v as TestingFilters["type"] })}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Latest result</label>
          <Select value={filters.latestStatus || "all"} onValueChange={(v) => onFiltersChange({ ...filters, latestStatus: v as TestingFilters["latestStatus"] })}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Any status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {["Pass", "Fail", "Blocked", "Skipped", "Not Run"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="h-4 w-4" />
          Include archived
        </label>
        <div className="ms-auto">
          <Button onClick={openCreate}>New test case</Button>
        </div>
      </div>

      {deleteMessage ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{deleteMessage}</div>
      ) : null}

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Case</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Latest result</th>
              <th className="px-4 py-3 font-medium">Runs</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className={`border-b last:border-0 ${c.archived ? "opacity-60" : ""}`}>
                <td className="px-4 py-3">
                  <div className="grid">
                    <span className="font-medium">{c.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.id}{c.archived ? " · Archived" : ""}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.priority}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.riskLevel}</td>
                <td className="px-4 py-3"><ExecutionStatusBadge status={getLatestStatus(c.id, executions)} /></td>
                <td className="px-4 py-3 text-muted-foreground">{runsByCase.get(c.id) ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    {!c.archived ? (
                      <>
                        <Button variant="subtle" className="h-8 px-2 text-xs" onClick={() => setExecCase(c)}>Record</Button>
                        <Button variant="subtle" className="h-8 px-2 text-xs" onClick={() => setHistoryCase(c)}>History</Button>
                        <Button variant="subtle" className="h-8 px-2 text-xs" onClick={() => openEdit(c)}>Edit</Button>
                        <Button variant="subtle" className="h-8 px-2 text-xs" onClick={() => archiveTestCase(c.id)}>Archive</Button>
                      </>
                    ) : null}
                    <Button variant="subtle" className="h-8 px-2 text-xs" onClick={() => { duplicateTestCase(c.id); setDeleteMessage(null); }}>Copy</Button>
                    <Button variant="ghost" className="h-8 px-2 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(c)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No test cases match these filters yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.id}` : "New test case"}</DialogTitle>
            <DialogDescription>Steps run top to bottom. Every step needs text before you can save.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input {...register("title")} placeholder="What does this case verify?" />
              {errors.title?.message ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea {...register("description")} rows={2} placeholder="Optional context" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <Select value={projectId || undefined} onValueChange={(v) => { setValue("projectId", v); setValue("phaseId", ""); setValue("taskId", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.projectId?.message ? <p className="text-xs text-red-600">{errors.projectId.message}</p> : null}
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Phase</label>
                <Select value={phaseId || "none"} onValueChange={(v) => { setValue("phaseId", v === "none" ? "" : v); setValue("taskId", ""); }}>
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
                {errors.taskId?.message ? <p className="text-xs text-red-600">{errors.taskId.message}</p> : null}
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <Select value={watch("type")} onValueChange={(v) => setValue("type", v as TestType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={watch("priority")} onValueChange={(v) => setValue("priority", v as TestPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Risk level</label>
                <Select value={watch("riskLevel")} onValueChange={(v) => setValue("riskLevel", v as TestRiskLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Preconditions</label>
              <Textarea {...register("preconditions")} rows={2} placeholder="Optional setup needed before running" />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">Steps</label>
              {steps.map((step, i) => (
                <div key={i} className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{i + 1}.</span>
                    <Input value={step} onChange={(e) => updateStep(i, e.target.value)} placeholder={`Step ${i + 1}`} className="flex-1" />
                    <Button type="button" variant="subtle" className="h-9 w-9 p-0" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</Button>
                    <Button type="button" variant="subtle" className="h-9 w-9 p-0" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>↓</Button>
                    <Button type="button" variant="subtle" className="h-9 w-9 p-0" onClick={() => removeStep(i)} disabled={steps.length === 1}>✕</Button>
                  </div>
                  {stepItemError(i) ? <p className="ps-8 text-xs text-red-600">{stepItemError(i)}</p> : null}
                </div>
              ))}
              <div>
                <Button type="button" variant="subtle" onClick={addStep}>+ Add step</Button>
              </div>
              {stepsRootError ? <p className="text-xs text-red-600">{stepsRootError}</p> : null}
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Expected result</label>
              <Textarea {...register("expected")} rows={2} placeholder="What should happen when the case passes" />
              {errors.expected?.message ? <p className="text-xs text-red-600">{errors.expected.message}</p> : null}
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Tags (comma separated)</label>
              <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="smoke, checkout, regression" />
            </div>
            <DialogFooter>
              <Button type="button" variant="subtle" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Save changes" : "Create test case"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <RecordExecutionDialog testCase={execCase} open={execCase !== null} onOpenChange={(o) => { if (!o) setExecCase(null); }} />

      <Dialog open={historyCase !== null} onOpenChange={(o) => { if (!o) setHistoryCase(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Execution history — {historyCase?.id}</DialogTitle>
            <DialogDescription>Append-only record, newest first. Entries are never edited or removed.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto">
            {historyCase ? getExecutions(historyCase.id).map((ex) => (
              <div key={ex.id} className="grid gap-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <ExecutionStatusBadge status={ex.status} />
                  <span className="text-xs text-muted-foreground">{String(ex.date).slice(0, 10)} · {ex.source}</span>
                </div>
                <p className="text-sm">{ex.actual ?? ex.notes ?? "No notes recorded."}</p>
                <p className="text-xs text-muted-foreground">{[ex.environment, ex.buildId, ex.bugId ? `Bug ${ex.bugId}` : null].filter(Boolean).join(" · ") || "—"}</p>
              </div>
            )) : null}
            {historyCase && getExecutions(historyCase.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">Never executed — this case is currently “Not Run”.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}