// AI plan payload schemas (Phase A3) — client-safe (zod, no server imports).
//
// The plan is produced staged-by-staged by the analysis pipeline and stored
// as a JSON string inside AIPlanDraft.payload (String + zod pattern, the
// same proven approach as DocumentRecord.content — portable to Postgres).
//
// Hallucination control baked into the shape:
// - every item carries classification (EXPLICIT | INFERRED | SUGGESTION)
// - every item carries sourceQuotes[] — EXACT substrings of the brief, so
//   the review UI can show provenance and the user can verify claims.
import { z } from "zod";
import { TASK_PRIORITIES } from "@/lib/types";

export const PLAN_CLASSIFICATIONS = [
  "EXPLICIT",
  "INFERRED",
  "SUGGESTION",
] as const;

export const planClassificationSchema = z.enum(PLAN_CLASSIFICATIONS);

const quotesSchema = z
  .array(z.string().max(500))
  .max(8)
  .default([]);

export const planItemSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(2_000).nullable().optional(),
  classification: planClassificationSchema.default("INFERRED"),
  sourceQuotes: quotesSchema,
});

export const planSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
  classification: planClassificationSchema.default("INFERRED"),
  sourceQuotes: quotesSchema,
});

export const planTaskSchema = z.object({
  // Server-assigned stable ref ("m1t3") — the AI NEVER sends ids. Any
  // incoming id value is ignored: normalize/renumber reassigns positional
  // ids after validation, so invalid/missing ones are tolerated here.
  id: z.string().max(40).catch(""),
  title: z.string().min(1).max(200),
  description: z.string().max(2_000).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  // ALWAYS an estimate — the timeline engine (A4) treats it as such.
  estimatedDays: z.number().min(0).max(365).default(1),
  classification: planClassificationSchema.default("INFERRED"),
  sourceQuotes: quotesSchema,
  // True when the AI proposed this task and the brief never mentioned it.
  aiSuggestion: z.boolean().default(false),
  dependsOn: z.array(z.string().max(40)).max(20).default([]),
  subtasks: z.array(planSubtaskSchema).max(20).default([]),
});

export const planModuleSchema = z.object({
  id: z.string().max(40).catch(""),
  name: z.string().min(1).max(200),
  classification: planClassificationSchema.default("INFERRED"),
  sourceQuotes: quotesSchema,
  tasks: z.array(planTaskSchema).max(25).default([]),
});

export const planMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  // Working-day offset from project start (estimated, refined in A4).
  afterDays: z.number().min(0).max(1_460).default(0),
  classification: planClassificationSchema.default("INFERRED"),
  sourceQuotes: quotesSchema,
});

export const aiPlanSchema = z.object({
  objectives: z.array(planItemSchema).max(15).default([]),
  scope: z.array(planItemSchema).max(25).default([]),
  deliverables: z.array(planItemSchema).max(25).default([]),
  milestones: z.array(planMilestoneSchema).max(15).default([]),
  modules: z.array(planModuleSchema).max(15).default([]),
  risks: z.array(planItemSchema).max(15).default([]),
  assumptions: z.array(planItemSchema).max(15).default([]),
  missingInfo: z.array(planItemSchema).max(15).default([]),
  optionalAddons: z.array(planItemSchema).max(15).default([]),
  excluded: z.array(planItemSchema).max(15).default([]),
});

export type PlanClassification = z.infer<typeof planClassificationSchema>;
export type PlanItem = z.infer<typeof planItemSchema>;
export type PlanSubtask = z.infer<typeof planSubtaskSchema>;
export type PlanTask = z.infer<typeof planTaskSchema>;
export type PlanModule = z.infer<typeof planModuleSchema>;
export type PlanMilestone = z.infer<typeof planMilestoneSchema>;
export type AIPlan = z.infer<typeof aiPlanSchema>;

/** Parse + normalize a stored/edited payload; corrupt payloads become a
 *  harmless empty plan instead of crashing the review UI. */
export function normalizePlan(raw: unknown): AIPlan {
  const parsed = aiPlanSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Second chance: salvage an object-shaped payload field by field.
  if (raw && typeof raw === "object") {
    const partial = aiPlanSchema.partial().safeParse(raw);
    if (partial.success) {
      return { ...emptyPlan(), ...partial.data };
    }
  }
  return emptyPlan();
}

export function emptyPlan(): AIPlan {
  return {
    objectives: [],
    scope: [],
    deliverables: [],
    milestones: [],
    modules: [],
    risks: [],
    assumptions: [],
    missingInfo: [],
    optionalAddons: [],
    excluded: [],
  };
}

export function planTaskCount(plan: AIPlan): number {
  return plan.modules.reduce((sum, m) => sum + m.tasks.length, 0);
}

/** Stable refs for tasks — "m1t2" — assigned from position, so the AI
 *  never has to invent identifiers and dependsOn stays verifiable. */
export function renumberPlan(plan: AIPlan): AIPlan {
  const modules = plan.modules.map((m, i) => ({
    ...m,
    id: `m${i + 1}`,
    tasks: m.tasks.map((t, j) => ({
      ...t,
      id: `m${i + 1}t${j + 1}`,
      dependsOn: t.dependsOn.filter(
        (ref) =>
          // keep only refs that exist somewhere in this plan
          plan.modules.some((mm) => mm.tasks.some((tt) => tt.id === ref)),
      ),
    })),
  }));
  return { ...plan, modules };
}