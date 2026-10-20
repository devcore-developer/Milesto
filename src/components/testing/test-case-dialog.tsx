"use client";

import { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";

import type { TestCase } from "@/types";
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

const TEST_TYPES = ["Manual", "Automated", "Integration", "API", "UI"] as const;
const TEST_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
const RISK_LEVELS = ["Low", "Medium", "High"] as const;

// Mirrors the rules of src/lib/testing-schema.ts (testCaseSchema) so the form
// stays self-contained and type-safe.
const testCaseFormSchema = z
  .object({
    title: z
      .string()
      .min(5, "Title must be between 5 and 120 characters")
      .max(120, "Title must be between 5 and 120 characters"),
    projectId: z.string().min(1, "Project is required"),
    phaseId: z.string().optional(),
    taskId: z.string().optional(),
    type: z.enum(TEST_TYPES),
    priority: z.enum(TEST_PRIORITIES),
    riskLevel: z.enum(RISK_LEVELS),
    description: z.string().optional(),
    preconditions: z.string().optional(),
    steps: z
      .array(z.object({ value: z.string().trim().min(1, "A step cannot be empty") }))
      .min(1, "Add at least one step")
      .max(20, "A case cannot have more than 20 steps"),
    expected: z.string().min(1, "Expected result is required"),
    tags: z.string().optional(),
    externalRefs: z.string().optional(),
  })
  .refine((values) => !values.taskId || Boolean(values.phaseId), {
    message: "Select a phase before linking a task",
    path: ["taskId"],
  });

type TestCaseFormValues = z.infer<typeof testCaseFormSchema>;

function toList(raw: string | undefined): string[] | undefined {
  const items = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

export interface TestCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: TestCase | null;
  defaultProjectId?: string;
}

export function TestCaseDialog({ open, onOpenChange, editing, defaultProjectId }: TestCaseDialogProps) {
  const { projects, phases, tasks, createTestCase, updateTestCase } = useProjects();

  const form = useForm<TestCaseFormValues>({
    resolver: zodResolver(testCaseFormSchema),
    defaultValues: {
      title: "",
      projectId: defaultProjectId ?? "",
      phaseId: undefined,
      taskId: undefined,
      type: "Manual",
      priority: "Medium",
      riskLevel: "Medium",
      description: "",
      preconditions: "",
      steps: [{ value: "" }],
      expected: "",
      tags: "",
      externalRefs: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "steps" });

  const watchedProjectId = form.watch("projectId");
  const watchedPhaseId = form.watch("phaseId");

  const availablePhases = useMemo(
    () => phases.filter((phase) => phase.projectId === watchedProjectId),
    [phases, watchedProjectId],
  );
  const availableTasks = useMemo(
    () => tasks.filter((task) => task.phaseId === watchedPhaseId),
    [tasks, watchedPhaseId],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        title: editing.title,
        projectId: editing.projectId,
        phaseId: editing.phaseId,
        taskId: editing.taskId,
        type: editing.type,
        priority: editing.priority,
        riskLevel: editing.riskLevel,
        description: editing.description ?? "",
        preconditions: editing.preconditions ?? "",
        steps: editing.steps.length > 0 ? editing.steps.map((step) => ({ value: step })) : [{ value: "" }],
        expected: editing.expected,
        tags: (editing.tags ?? []).join(", "),
        externalRefs: (editing.externalRefs ?? []).join(", "),
      });
    } else {
      form.reset({
        title: "",
        projectId: defaultProjectId ?? "",
        phaseId: undefined,
        taskId: undefined,
        type: "Manual",
        priority: "Medium",
        riskLevel: "Medium",
        description: "",
        preconditions: "",
        steps: [{ value: "" }],
        expected: "",
        tags: "",
        externalRefs: "",
      });
    }
  }, [editing, open, defaultProjectId, form]);

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      projectId: values.projectId,
      phaseId: values.phaseId || undefined,
      taskId: values.taskId || undefined,
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      type: values.type,
      priority: values.priority,
      riskLevel: values.riskLevel,
      preconditions: values.preconditions?.trim() || undefined,
      steps: values.steps.map((step) => step.value).filter(Boolean),
      expected: values.expected.trim(),
      tags: toList(values.tags),
      externalRefs: toList(values.externalRefs),
    };

    if (editing) {
      updateTestCase(editing.id, payload);
    } else {
      createTestCase(payload);
    }
    onOpenChange(false);
  });

  const stepsError = form.formState.errors.steps as
    | { root?: { message?: string }; message?: string }
    | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? "Edit test case" : "New test case"}
            {editing ? <Badge variant="neutral">{editing.id}</Badge> : null}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the case definition. Recorded executions and their history are never modified."
              : "A stable ID (TC-…) is generated automatically when the case is created."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tc-title">Title</Label>
            <Input
              id="tc-title"
              placeholder="e.g. Checkout rejects an expired discount code"
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
              <FieldError message={form.formState.errors.taskId?.message} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEST_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEST_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Risk level</Label>
              <Controller
                control={form.control}
                name="riskLevel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RISK_LEVELS.map((risk) => (
                        <SelectItem key={risk} value={risk}>
                          {risk}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tc-description">Description (optional)</Label>
              <Textarea id="tc-description" rows={2} {...form.register("description")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-preconditions">Preconditions (optional)</Label>
              <Textarea
                id="tc-preconditions"
                rows={2}
                placeholder="e.g. User is signed in with a saved payment method"
                {...form.register("preconditions")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Steps (executed in order)</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <span className="mt-2 min-w-6 text-sm text-muted-foreground">{index + 1}.</span>
                <div className="flex-1 space-y-1">
                  <Input placeholder={`Step ${index + 1}`} {...form.register(`steps.${index}.value`)} />
                  <FieldError message={form.formState.errors.steps?.[index]?.value?.message} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                  aria-label={`Remove step ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <FieldError message={stepsError?.root?.message ?? stepsError?.message} />
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={() => append({ value: "" })}
              disabled={fields.length >= 20}
            >
              <Plus className="h-4 w-4" /> Add step
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tc-expected">Expected result</Label>
            <Textarea id="tc-expected" rows={2} {...form.register("expected")} />
            <FieldError message={form.formState.errors.expected?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tc-tags">Tags (comma separated, optional)</Label>
              <Input id="tc-tags" placeholder="smoke, checkout, p1" {...form.register("tags")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-refs">External references (optional)</Label>
              <Input id="tc-refs" placeholder="JIRA-123, Spec-4.2" {...form.register("externalRefs")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Create test case"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}