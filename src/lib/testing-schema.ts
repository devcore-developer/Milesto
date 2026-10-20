import { z } from "zod";

// ─── Test case (§3) ───
export const testCaseSchema = z
  .object({
    projectId: z.string().min(1, "Project is required."),
    phaseId: z.string().optional(),
    taskId: z.string().optional(),
    title: z
      .string()
      .trim()
      .min(5, "Title must be at least 5 characters.")
      .max(120, "Title must be 120 characters or fewer."),
    description: z.string().trim().max(1000).optional(),
    type: z.enum(["Manual", "Automated", "Integration", "API", "UI"], {
      required_error: "Test type is required.",
    }),
    priority: z.enum(["Low", "Medium", "High", "Critical"], {
      required_error: "Priority is required.",
    }),
    riskLevel: z.enum(["Low", "Medium", "High"], {
      required_error: "Risk level is required.",
    }),
    preconditions: z.string().trim().max(500).optional(),
    steps: z
      .array(z.string().trim().min(1, "Step text is required."))
      .min(1, "Add at least one step.")
      .max(20, "A test case cannot have more than 20 steps."),
    expected: z.string().trim().min(3, "Expected result is required."),
    tags: z.array(z.string().trim().min(1)).max(10, "Up to 10 tags.").optional(),
    externalRefs: z.array(z.string().trim().min(1)).max(10, "Up to 10 references.").optional(),
  })
  .refine((data) => !(data.taskId && !data.phaseId), {
    message: "A test case linked to a task must also be linked to the task's phase.",
    path: ["taskId"],
  });

export type TestCaseFormValues = z.infer<typeof testCaseSchema>;

// ─── Execution (§4) — append-only records ───
export const executionSchema = z
  .object({
    testCaseId: z.string().min(1, "Test case is required."),
    status: z.enum(["Pass", "Fail", "Blocked", "Skipped"], {
      required_error: "Execution status is required.",
    }),
    date: z.string().min(1, "Execution date is required."),
    environment: z.string().trim().max(120).optional(),
    buildId: z.string().trim().max(60).optional(),
    actual: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
    bugId: z.string().optional(),
    attachments: z.array(z.string().trim().min(1)).max(10, "Up to 10 attachment links.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "Fail" && (!data.actual || data.actual.length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actual"],
        message: "Describe the actual result when a test fails.",
      });
    }
  });

export type ExecutionFormValues = z.infer<typeof executionSchema>;

// ─── Bug (§6) ───
export const bugSchema = z
  .object({
    projectId: z.string().min(1, "Project is required."),
    phaseId: z.string().optional(),
    taskId: z.string().optional(),
    testCaseId: z.string().optional(),
    title: z
      .string()
      .trim()
      .min(5, "Title must be at least 5 characters.")
      .max(140, "Title must be 140 characters or fewer."),
    description: z.string().trim().max(2000).optional(),
    severity: z.enum(["Critical", "High", "Medium", "Low"], {
      required_error: "Severity is required.",
    }),
    status: z.enum(["Open", "In Progress", "Fixed", "Retest", "Closed", "Deferred"]),
    steps: z.string().trim().max(2000).optional(),
    expected: z.string().trim().max(1000).optional(),
    actual: z.string().trim().max(1000).optional(),
    resolutionNotes: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    const needsResolution = ["Fixed", "Closed", "Deferred"].includes(data.status);
    if (needsResolution && (!data.resolutionNotes || data.resolutionNotes.length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolutionNotes"],
        message: `Resolution notes are required when status is "${data.status}".`,
      });
    }
  });

export type BugFormValues = z.infer<typeof bugSchema>;

// ─── Gate override (§7) — must be explicit and recorded ───
export const gateOverrideSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "An override reason of at least 10 characters is required.")
    .max(500, "Keep the reason under 500 characters."),
});

// ─── Automated results import (§5) — JSON only, no shell execution from the UI ───
export const automatedImportSchema = z.object({
  framework: z.string().trim().min(1).default("unknown"),
  buildId: z.string().trim().min(1, "Build ID is required."),
  environment: z.string().trim().min(1, "Environment is required."),
  executedAt: z.string().min(1, "Execution date is required."),
  results: z
    .array(
      z.object({
        testCaseId: z.string().trim().min(1, "testCaseId is required."),
        status: z.enum(["Pass", "Fail", "Blocked", "Skipped"]),
        message: z.string().max(2000).optional(),
        durationMs: z.number().nonnegative().optional(),
      })
    )
    .min(1, "The import must contain at least one result."),
});

export type AutomatedImportPayload = z.infer<typeof automatedImportSchema>;