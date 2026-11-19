// Analysis prompts (Phase A3) — server-only.
//
// Bilingual by design: the brief may be Arabic, English or mixed; English
// technical terms must survive untouched; the OUTPUT language is chosen
// by the user independently of the input language.
//
// The staged pipeline keeps every single AI call short (serverless-safe):
//   stage 1 → objectives / scope / deliverables / excluded / optional add-ons
//   stage 2 → modules → tasks → subtasks (+ estimates, dependencies)
//   stage 3 → milestones / risks / assumptions / missing info
import { z } from "zod";
import { aiChatJSON } from "@/lib/ai/client";
import { AICallError } from "@/lib/ai/types";
import {
  aiPlanSchema,
  emptyPlan,
  normalizePlan,
  planModuleSchema,
  renumberPlan,
  type AIPlan,
  type PlanModule,
} from "@/lib/ai/plan-schema";

export type OutputLanguage = "en" | "ar";

const NEVER_INVENT = `HARD RULES:
- NEVER invent requirements, features, dates or numbers that are not supported by the brief.
- Every item you derive from an explicit statement must quote the EXACT substring of the brief in sourceQuotes (1-3 short quotes).
- classification: "EXPLICIT" = stated in the brief; "INFERRED" = directly implied by the brief; "SUGGESTION" = your recommendation beyond the brief.
- If the brief does not mention something, either omit it or mark it "SUGGESTION" with aiSuggestion=true (tasks only).
- If information is missing, list it in missingInfo instead of guessing.`;

const LANGUAGE_RULE = (lang: OutputLanguage) =>
  lang === "ar"
    ? `OUTPUT LANGUAGE: Arabic (keep English technical terms, product names and code as-is).`
    : `OUTPUT LANGUAGE: English.`;

const JSON_RULE = `ANSWER FORMAT: one strict JSON object and nothing else — no markdown fences, no prose.`;

function briefBlock(brief: string): string {
  const capped = brief.slice(0, 60_000);
  return `PROJECT BRIEF (verbatim, do not rewrite):\n<<<BRIEF\n${capped}\nBRIEF>>>`;
}

export function stage1Prompt(brief: string, lang: OutputLanguage): string {
  return `You are a senior project manager extracting requirements from a client brief.
 ${briefBlock(brief)}

 ${NEVER_INVENT}
 ${LANGUAGE_RULE(lang)}
 ${JSON_RULE}

Extract ONLY these fields (omit what the brief does not support):
{
  "objectives":  [{ "title": string, "detail": string|null, "classification": "EXPLICIT"|"INFERRED"|"SUGGESTION", "sourceQuotes": string[] }],
  "scope":       [same shape],
  "deliverables":[same shape],
  "excluded":    [same shape],
  "optionalAddons": [same shape]
}
- scope: what IS included in this project, as concrete items.
- excluded: things the brief explicitly rules out (or clearly out of scope).
- optionalAddons: nice-to-have extras you would propose (classification SUGGESTION).`;
}

export function stage2Prompt(
  brief: string,
  stage1: AIPlan,
  lang: OutputLanguage,
): string {
  const s1 = {
    objectives: stage1.objectives.map((o) => o.title),
    scope: stage1.scope.map((o) => o.title),
    deliverables: stage1.deliverables.map((o) => o.title),
  };
  return `You are a senior project manager breaking a project into executable work.
 ${briefBlock(brief)}

Already extracted (stage 1) — stay consistent with it:
 ${JSON.stringify(s1)}

 ${NEVER_INVENT}
 ${LANGUAGE_RULE(lang)}
 ${JSON_RULE}

Return:
{
  "modules": [
    {
      "name": string,
      "classification": "EXPLICIT"|"INFERRED"|"SUGGESTION",
      "sourceQuotes": string[],
      "tasks": [
        {
          "title": string,
          "description": string|null,
          "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT",
          "estimatedDays": number (realistic working days, 0.5 granularity allowed),
          "classification": "EXPLICIT"|"INFERRED"|"SUGGESTION",
          "sourceQuotes": string[],
          "aiSuggestion": boolean,
          "dependsOn": [task titles you depend on — EXACTLY as written in this same answer; [] if none],
          "subtasks": [{ "title": string, "classification": "EXPLICIT"|"INFERRED"|"SUGGESTION", "sourceQuotes": string[] }]
        }
      ]
    }
  ]
}
- 2-8 modules; each task is a unit a person can execute in estimatedDays.
- dependsOn uses the exact title of another task in your answer (never invent a dependency).`;
}

export function stage3Prompt(
  brief: string,
  stage1: AIPlan,
  stage2Modules: { name: string; tasks: string[] }[],
  lang: OutputLanguage,
): string {
  return `You are a senior project manager finishing a plan review.
 ${briefBlock(brief)}

Modules and tasks already planned:
 ${JSON.stringify(stage2Modules)}

 ${NEVER_INVENT}
 ${LANGUAGE_RULE(lang)}
 ${JSON_RULE}

Return:
{
  "milestones": [{ "title": string, "afterDays": number (working days from project start), "classification": "...", "sourceQuotes": string[] }],
  "risks":       [{ "title": string, "detail": string|null, "classification": "...", "sourceQuotes": string[] }],
  "assumptions": [same shape],
  "missingInfo": [same shape]
}
- missingInfo: questions you would ask the client before starting.
- afterDays is an estimate based on the tasks listed above.`;
}

/** One staged call + zod validation + ONE repair retry. */
export async function runPlanStage<T>(
  userId: string,
  prompt: string,
  schema: z.ZodType<T>,
  maxTokens = 3_000,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await aiChatJSON(userId, prompt, { maxTokens, temperature: 0.2 });
  } catch (e) {
    if (e instanceof AICallError) throw e;
    throw new AICallError("AI_BAD_RESPONSE", 502);
  }
  const first = schema.safeParse(raw);
  if (first.success) return first.data;

  // One automatic repair retry — the model sees its own invalid answer.
  const repairPrompt = `${prompt}

Your previous answer failed validation with: ${first.error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ")}.
Return the corrected JSON object now. ${JSON_RULE}`;
  let retryRaw: unknown;
  try {
    retryRaw = await aiChatJSON(userId, repairPrompt, {
      maxTokens,
      temperature: 0,
    });
  } catch (e) {
    if (e instanceof AICallError) throw e;
    throw new AICallError("AI_BAD_RESPONSE", 502);
  }
  const second = schema.safeParse(retryRaw);
  if (second.success) return second.data;
  throw new AICallError("AI_BAD_RESPONSE", 502, "plan failed validation twice");
}

/** Renumber + validate the tasks the AI produced (titles → stable ids). */
function normalizeStage2(
  raw: z.infer<typeof planModuleSchema>[],
): PlanModule[] {
  // The AI returns dependsOn as task TITLES; map them to ids after ids exist.
  const modules = planModuleSchema.array().default([]).parse(raw);
  const titleToId = new Map<string, string>();
  modules.forEach((m, i) =>
    m.tasks.forEach((t, j) => titleToId.set(t.title.trim(), `m${i + 1}t${j + 1}`)),
  );
  const withIds = modules.map((m, i) => ({
    ...m,
    id: `m${i + 1}`,
    tasks: m.tasks.map((t, j) => ({
      ...t,
      id: `m${i + 1}t${j + 1}`,
      dependsOn: (t.dependsOn ?? [])
        .map((ref) => titleToId.get(ref.trim()) ?? null)
        .filter((x): x is string => x !== null && x !== `m${i + 1}t${j + 1}`),
    })),
  }));
  return planModuleSchema.array().parse(withIds);
}

export interface StagedResult {
  plan: AIPlan;
  completedStages: number;
}

/** The full staged pipeline — persists nothing itself; the route saves
 *  after every stage so a timeout never loses completed work. */
export async function analyzeBriefStaged(
  userId: string,
  briefText: string,
  lang: OutputLanguage,
): Promise<StagedResult> {
  let plan = emptyPlan();

  // Stage 1
  const s1 = await runPlanStage(
    userId,
    stage1Prompt(briefText, lang),
    aiPlanSchema.partial().extend({
      objectives: aiPlanSchema.shape.objectives,
      scope: aiPlanSchema.shape.scope,
      deliverables: aiPlanSchema.shape.deliverables,
      excluded: aiPlanSchema.shape.excluded,
      optionalAddons: aiPlanSchema.shape.optionalAddons,
    }),
  );
  plan = { ...plan, ...s1 };
  let completed = 1;

  try {
    // Stage 2
    const s2 = await runPlanStage(
      userId,
      stage2Prompt(briefText, plan, lang),
      aiPlanSchema.pick({ modules: true }),
    );
    plan = { ...plan, modules: normalizeStage2(s2.modules) };
    completed = 2;
  } catch (e) {
    console.error(
      "[analyze] stage2 failed:",
      e instanceof Error ? `${e.message}${"detail" in e ? ` [${(e as { detail?: string }).detail}]` : ""}` : e,
    );
    return { plan: renumberPlan(plan), completedStages: completed };
  }

  try {
    // Stage 3
    const moduleSummary = plan.modules.map((m) => ({
      name: m.name,
      tasks: m.tasks.map((t) => t.title),
    }));
    const s3 = await runPlanStage(
      userId,
      stage3Prompt(briefText, plan, moduleSummary, lang),
      aiPlanSchema.pick({ milestones: true, risks: true, assumptions: true, missingInfo: true }),
    );
    plan = { ...plan, ...s3 };
    completed = 3;
  } catch {
    return { plan: renumberPlan(plan), completedStages: completed };
  }

  return { plan: renumberPlan(plan), completedStages: completed };
}