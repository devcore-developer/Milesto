"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";

import type { Bug } from "@/types";
import { useProjects } from "@/lib/project-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const BUG_SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
const BUG_STATUSES = ["Open", "In Progress", "Fixed", "Retest", "Closed", "Deferred"] as const;
const RESOLVED_STATUSES = ["Fixed", "Closed", "Deferred"] as const;

// Mirrors the rules of src/lib/testing-schema.ts (bugSchema).
const bugFormSchema = z
  .object({
    title: z
      .string()
      .min(5, "Title must be at least 5 characters")
      .max(140, "Title must be at most 140 characters"),
    projectId: z.string().min(1, "Project is required"),
    phaseId: z.string().optional(),
    taskId: z.string().optional(),
    testCaseId: z.string().optional(),
    severity: z.enum(BUG_SEVERITIES),
    status: z.enum(BUG_STATUSES),
    description: z.string().optional(),
    steps: z.string().optional(),
    expected: z.string().optional(),
    actual: z.string().optional(),
    resolutionNotes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (
      (RESOLVED_STATUSES as readonly string[]).includes(values.status) &&
      (!values.resolutionNotes || values.resolutionNotes.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolutionNotes"],
        message: "Resolution notes are required when a bug moves to Fixed, Closed or Deferred",
      });
    }
  });

type BugFormValues = z.infer<typeof bugFormSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

export interface BugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Bug | null;
  defaultProjectId?: string;
  defaultTestCaseId?: string;
}

export function BugDialog({
  open,
  onOpenChange,
  editing,
  defaultProjectId,
  defaultTestCaseId,
}: BugDialogProps) {
  const { projects, phases, tasks, getTestCases, getAllTestCases, createBug, updateBug } =
    useProjects();

  const form = useForm<BugFormValues>({
    resolver: zodResolver(bugFormSchema),
    defaultValues: {
      title: "",
      projectId: defaultProjectId ?? "",
      phaseId: undefined,
      taskId: undefined,
      testCaseId: defaultTestCaseId ?? undefined,
      severity: "Medium",
      status: "Open",
      description: "",
      steps: "",
      expected: "",
      actual: "",
      resolutionNotes: "",
    },
  });

  const watchedProjectId = form.watch("projectId");
  const watchedPhaseId = form.watch("phaseId");
  const watchedStatus = form.watch("status");

  const availablePhases = useMemo(
    () => phases.filter((phase) => phase.projectId === watchedProjectId),
    [phases, watchedProjectId],
  );
  const availableTasks = useMemo(
    () => tasks.filter((task) => task.phaseId === watchedPhaseId),
    [tasks, watchedPhaseId],
  );

  const caseOptions = useMemo(() => {
    const list = getTestCases(watchedProjectId || undefined);
    if (editing?.testCaseId && !list.some((testCase) => testCase.id === editing.testCaseId)) {
      const archived = getAllTestCases().find((testCase) => testCase.id === editing.testCaseId);
      if (archived) return [archived, ...list];
    }
    return list;
  }, [getTestCases, getAllTestCases, watchedProjectId, editing]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        title: editing.title,
        projectId: editing.projectId,
        phaseId: editing.phaseId,
        taskId: editing.taskId,
        testCaseId: editing.testCaseId,
        severity: editing.severity,
        status: editing.status,
        description: editing.description ?? "",
        steps: editing.steps ?? "",
        expected: editing.expected ?? "",
        actual: editing.actual ?? "",
        resolutionNotes: editing.resolutionNotes ?? "",
      });
    } else {
      form.reset({
        title: "",
        projectId: defaultProjectId ?? "",
        phaseId: undefined,
        taskId: undefined,
        testCaseId: defaultTestCaseId ?? undefined,
        severity: "Medium",
        status: "Open",
        description: "",
        steps: "",
        expected: "",
        actual: "",
        resolutionNotes: "",
      });
    }
  }, [editing, open, defaultProjectId, defaultTestCaseId, form]);

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      projectId: values.projectId,
      phaseId: values.phaseId || undefined,
      taskId: values.taskId || undefined,
      testCaseId: values.testCaseId || undefined,
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      severity: values.severity,
      status: values.status,
      steps: values.steps?.trim() || undefined,
      expected: values.expected?.trim() || undefined,
      actual: values.actual?.trim() || undefined,
      resolutionNotes: values.resolutionNotes?.trim() || undefined,
    };

    if (editing) {
      updateBug(editing.id, payload);
    } else {
      createBug(payload);
    }
    onOpenChange(false);
  });

  const needsResolutionNotes = (RESOLVED_STATUSES as readonly string[]).includes(watchedStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? "Edit bug" : "Report bug"}
            {editing ? <Badge variant="neutral">{editing.id}</Badge> : null}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update severity, status or resolution details for this bug."
              : "A stable ID (BUG-…) is generated automatically when the bug is created."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Workflow reminder: completing a task or phase never resolves a bug. A bug is only
            resolved here, through an explicit status change (Fixed / Closed) with resolution notes.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bug-title">Title</Label>
            <Input
              id="bug-title"
              placeholder="e.g. Invoice totals show zero for saved invoices"
              {...form.register("title")}
            />
            <FieldError message={form.formState.errors.title?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Controller
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("phaseId", undefined);
                      form.setValue("taskId", undefined);
                      form.setValue("testCaseId", undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={form.formState.errors.projectId?.message} />
            </div>

            <div className="space-y-1.5">
              <Label>Phase (optional)</Label>
              <Controller
                control={form.control}
                name="phaseId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(value) => {
                      field.onChange(value === "none" ? undefined : value);
                      form.setValue("taskId", undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No phase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No phase</SelectItem>
                      {availablePhases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          {phase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Task (optional)</Label>
              <Controller
                control={form.control}
                name="taskId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                    disabled={availableTasks.length === 0 && !field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No task</SelectItem>
                      {availableTasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Controller
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUG_SEVERITIES.map((severity) => (
                        <SelectItem key={severity} value={severity}>
                          {severity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUG_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Test case (optional)</Label>
              <Controller
                control={form.control}
                name="testCaseId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not linked" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {caseOptions.map((testCase) => (
                        <SelectItem key={testCase.id} value={testCase.id}>
                          {testCase.id} · {testCase.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bug-description">Description (optional)</Label>
            <Textarea id="bug-description" rows={2} {...form.register("description")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="bug-steps">Repro steps (optional)</Label>
              <Textarea
                id="bug-steps"
                rows={3}
                placeholder="1. Open…&#10;2. Click…"
                {...form.register("steps")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bug-expected">Expected (optional)</Label>
              <Textarea id="bug-expected" rows={3} {...form.register("expected")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bug-actual">Actual (optional)</Label>
              <Textarea id="bug-actual" rows={3} {...form.register("actual")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bug-resolution">
              Resolution notes {needsResolutionNotes ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="bug-resolution"
              rows={2}
              placeholder="How was it fixed, or why was it deferred?"
              {...form.register("resolutionNotes")}
            />
            <FieldError message={form.formState.errors.resolutionNotes?.message} />
          </div>

          <DialogFooter>
            <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Report bug"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}