"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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

const EXECUTION_STATUSES = ["Pass", "Fail", "Blocked", "Skipped"] as const;

// Mirrors the rules of src/lib/testing-schema.ts (executionSchema).
const executionFormSchema = z
  .object({
    status: z.enum(EXECUTION_STATUSES),
    date: z.string().min(1, "Execution date is required"),
    environment: z.string().optional(),
    buildId: z.string().optional(),
    actual: z.string().optional(),
    notes: z.string().optional(),
    bugId: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.status === "Fail" && (!values.actual || values.actual.trim().length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actual"],
        message: "Record the actual result (at least 5 characters) when a case fails",
      });
    }
  });

type ExecutionFormValues = z.infer<typeof executionFormSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

export interface ExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: TestCase;
}

export function ExecutionDialog({ open, onOpenChange, testCase }: ExecutionDialogProps) {
  const { createExecution, getBugs } = useProjects();

  const projectBugs = useMemo(() => getBugs(testCase.projectId), [getBugs, testCase.projectId]);

  const form = useForm<ExecutionFormValues>({
    resolver: zodResolver(executionFormSchema),
    defaultValues: {
      status: "Pass",
      date: new Date().toISOString().slice(0, 10),
      environment: "",
      buildId: "",
      actual: "",
      notes: "",
      bugId: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      status: "Pass",
      date: new Date().toISOString().slice(0, 10),
      environment: "",
      buildId: "",
      actual: "",
      notes: "",
      bugId: undefined,
    });
  }, [open, testCase.id, form]);

  const onSubmit = form.handleSubmit((values) => {
    createExecution({
      testCaseId: testCase.id,
      status: values.status,
      date: values.date,
      environment: values.environment?.trim() || undefined,
      buildId: values.buildId?.trim() || undefined,
      actual: values.actual?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      bugId: values.bugId || undefined,
      source: "manual",
    });
    onOpenChange(false);
  });

  const watchedStatus = form.watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Record execution
            <Badge variant="neutral">{testCase.id}</Badge>
          </DialogTitle>
          <DialogDescription>
            Appends a new record to the execution history. Earlier results stay untouched, and the
            latest result is derived from the newest record.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <div>
              <p className="text-sm font-semibold">{testCase.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="info">{testCase.type}</Badge>
                <Badge variant="warning">{testCase.priority}</Badge>
                <Badge variant="neutral">Risk: {testCase.riskLevel}</Badge>
              </div>
            </div>
            {testCase.preconditions ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Preconditions</p>
                <p className="text-sm">{testCase.preconditions}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Steps</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                {testCase.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Expected result</p>
              <p className="text-sm">{testCase.expected}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                        {EXECUTION_STATUSES.map((status) => (
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
                <Label htmlFor="ex-date">Date</Label>
                <Input id="ex-date" type="date" {...form.register("date")} />
                <FieldError message={form.formState.errors.date?.message} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ex-env">Environment (optional)</Label>
                <Input id="ex-env" placeholder="e.g. Staging / Chrome 130" {...form.register("environment")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex-build">Build ID (optional)</Label>
                <Input id="ex-build" placeholder="e.g. build-2026.10.15-3" {...form.register("buildId")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ex-actual">
                Actual result {watchedStatus === "Fail" ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                id="ex-actual"
                rows={3}
                placeholder="What actually happened when the case ran?"
                {...form.register("actual")}
              />
              <FieldError message={form.formState.errors.actual?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ex-notes">Notes (optional)</Label>
              <Textarea id="ex-notes" rows={2} {...form.register("notes")} />
            </div>

            <div className="space-y-1.5">
              <Label>Linked bug (optional)</Label>
              <Controller
                control={form.control}
                name="bugId"
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
                      {projectBugs.map((bug) => (
                        <SelectItem key={bug.id} value={bug.id}>
                          {bug.id} · {bug.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save execution</Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}