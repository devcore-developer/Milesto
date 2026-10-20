"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProjects } from "@/lib/project-context";
import { executionSchema, type ExecutionFormValues } from "@/lib/testing-schema";
import type { TestCase } from "@/types";

const STATUS_OPTIONS: ExecutionFormValues["status"][] = [
  "Pass",
  "Fail",
  "Blocked",
  "Skipped",
];

const ENVIRONMENT_OPTIONS = ["Local", "Staging", "Production", "CI"];

interface RecordExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase?: TestCase | null;
  testCaseId?: string | null;
}

const emptyValues = (testCaseId: string): ExecutionFormValues => ({
  testCaseId,
  status: "Pass",
  date: new Date().toISOString().slice(0, 10),
  environment: "",
  buildId: "",
  actual: "",
  notes: "",
  attachments: [],
});

export function RecordExecutionDialog({
  open,
  onOpenChange,
  testCase = null,
  testCaseId = null,
}: RecordExecutionDialogProps) {
  const { createExecution, getTestCaseById } = useProjects();
  const [attachmentsText, setAttachmentsText] = useState("");

  const target: TestCase | null =
    testCase ?? (testCaseId ? getTestCaseById(testCaseId) ?? null : null);

  const form = useForm<ExecutionFormValues>({
    resolver: zodResolver(executionSchema),
    defaultValues: emptyValues(target?.id ?? ""),
  });

  useEffect(() => {
    if (open) {
      form.reset(emptyValues(target?.id ?? ""));
      setAttachmentsText("");
    }
  }, [open, target?.id, form]);

  const status = form.watch("status");

  const handleSubmit = form.handleSubmit((values) => {
    if (!target) return;
    const attachments = attachmentsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    createExecution({
      testCaseId: target.id,
      status: values.status,
      date: values.date,
      source: "manual",
      environment: values.environment || undefined,
      buildId: values.buildId || undefined,
      actual: values.actual || undefined,
      notes: values.notes || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record execution</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.id} — ${target.title}`
              : "Open this dialog from a test case row in the Test cases tab."}
          </DialogDescription>
        </DialogHeader>

        {target ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Result</span>
              <div className="grid grid-cols-4 gap-2">
                {STATUS_OPTIONS.map((option) => {
                  const active = status === option;
                  return (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "subtle"}
                      onClick={() =>
                        form.setValue("status", option, { shouldValidate: true })
                      }
                    >
                      {option}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Date</span>
                <Input type="date" {...form.register("date")} />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Environment</span>
                <Select
                  value={form.watch("environment") || undefined}
                  onValueChange={(value) => form.setValue("environment", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Build ID</span>
              <Input placeholder="e.g. build-2026-05-12.1" {...form.register("buildId")} />
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Actual result</span>
              <Textarea
                rows={3}
                placeholder="What actually happened?"
                {...form.register("actual")}
              />
              {form.formState.errors.actual ? (
                <p className="text-xs text-red-500">
                  {form.formState.errors.actual.message}
                </p>
              ) : null}
            </div>

            {status === "Fail" ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                Fail is recorded as-is. Log the bug from the Bugs tab — completing a task
                never resolves a bug automatically.
              </p>
            ) : null}

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Notes</span>
              <Textarea rows={2} placeholder="Optional notes" {...form.register("notes")} />
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Attachments</span>
              <Input
                placeholder="Comma-separated links or file names"
                value={attachmentsText}
                onChange={(event) => setAttachmentsText(event.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Save execution
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick a test case first, then record its execution from its row actions.
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RecordExecutionDialog;