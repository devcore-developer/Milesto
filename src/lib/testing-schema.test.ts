import { describe, expect, it } from "vitest";
import {
  automatedImportSchema,
  bugSchema,
  executionSchema,
  gateOverrideSchema,
  testCaseSchema,
} from "@/lib/testing-schema";

const validCase = {
  projectId: "PRJ-1042",
  title: "Verify the login flow end to end",
  type: "UI",
  priority: "High",
  riskLevel: "Medium",
  steps: ["Open the login page", "Submit valid credentials"],
  expected: "Dashboard opens",
};

describe("testCaseSchema", () => {
  it("accepts a valid test case", () => {
    expect(testCaseSchema.safeParse(validCase).success).toBe(true);
  });

  it("rejects an empty steps list", () => {
    expect(testCaseSchema.safeParse({ ...validCase, steps: [] }).success).toBe(false);
  });

  it("rejects a short title", () => {
    expect(testCaseSchema.safeParse({ ...validCase, title: "abc" }).success).toBe(false);
  });

  it("requires a phase when a task is linked", () => {
    expect(testCaseSchema.safeParse({ ...validCase, taskId: "TSK-01" }).success).toBe(false);
  });
});

describe("executionSchema", () => {
  const base = { testCaseId: "TC-01", status: "Fail", date: "2024-08-10" };

  it("requires an actual result when the status is Fail", () => {
    expect(executionSchema.safeParse(base).success).toBe(false);
    expect(executionSchema.safeParse({ ...base, actual: "Got 401 instead of 200" }).success).toBe(true);
  });

  it("allows missing actual result for a Pass", () => {
    expect(executionSchema.safeParse({ ...base, status: "Pass" }).success).toBe(true);
  });
});

describe("bugSchema", () => {
  const base = { projectId: "PRJ-1042", title: "Login returns 401", severity: "Critical", status: "Closed" };

  it("requires resolution notes when closed", () => {
    expect(bugSchema.safeParse(base).success).toBe(false);
    expect(
      bugSchema.safeParse({ ...base, resolutionNotes: "Fixed by restoring the auth config." }).success
    ).toBe(true);
  });

  it("allows open bugs without resolution notes", () => {
    expect(bugSchema.safeParse({ ...base, status: "Open" }).success).toBe(true);
  });
});

describe("gateOverrideSchema", () => {
  it("rejects short reasons", () => {
    expect(gateOverrideSchema.safeParse({ reason: "short" }).success).toBe(false);
  });

  it("accepts a proper reason", () => {
    expect(gateOverrideSchema.safeParse({ reason: "Business deadline requires the release tomorrow." }).success).toBe(true);
  });
});

describe("automatedImportSchema", () => {
  const base = {
    framework: "vitest",
    buildId: "BUILD-2221",
    environment: "CI (Node 20)",
    executedAt: "2024-08-15T07:00:00.000Z",
    results: [{ testCaseId: "TC-06", status: "Pass" }],
  };

  it("accepts a valid payload", () => {
    expect(automatedImportSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty results array", () => {
    expect(automatedImportSchema.safeParse({ ...base, results: [] }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(
      automatedImportSchema.safeParse({ ...base, results: [{ testCaseId: "TC-06", status: "Maybe" }] }).success
    ).toBe(false);
  });
});