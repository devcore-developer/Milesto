// Single-module regeneration (Phase A3) — re-runs the analysis for ONE
// module without touching the rest of the reviewed plan.
import { z } from "zod";
import type { AIPlan, PlanModule } from "@/lib/ai/plan-schema";
import { planModuleSchema } from "@/lib/ai/plan-schema";
import { runPlanStage, type OutputLanguage } from "@/lib/ai/prompts/analyze-brief";

export function regenerateModulePrompt(
  brief: string,
  plan: AIPlan,
  moduleIndex: number,
  lang: OutputLanguage,
): string {
  const current = plan.modules[moduleIndex];
  const others = plan.modules
    .filter((_, i) => i !== moduleIndex)
    .map((m) => ({ name: m.name, tasks: m.tasks.map((t) => t.title) }));

  return `You are a senior project manager re-planning ONE module of a project.
PROJECT BRIEF (verbatim, do not rewrite):
<<<BRIEF
 ${brief.slice(0, 60_000)}
BRIEF>>>

Other modules (stay distinct — do not duplicate their work):
 ${JSON.stringify(others)}

Module to re-plan: "${current?.name ?? ""}"

HARD RULES:
- NEVER invent requirements not supported by the brief.
- classification: "EXPLICIT" = stated in the brief; "INFERRED" = directly implied; "SUGGESTION" = your recommendation (with aiSuggestion=true on tasks).
- Every item quotes exact brief substrings in sourceQuotes (1-3 short quotes).
OUTPUT LANGUAGE: ${lang === "ar" ? "Arabic (keep English technical terms as-is)." : "English."}
ANSWER FORMAT: one strict JSON object and nothing else.

Return:
{
  "name": string,
  "classification": "EXPLICIT"|"INFERRED"|"SUGGESTION",
  "sourceQuotes": string[],
  "tasks": [
    {
      "title": string,
      "description": string|null,
      "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT",
      "estimatedDays": number,
      "classification": "EXPLICIT"|"INFERRED"|"SUGGESTION",
      "sourceQuotes": string[],
      "aiSuggestion": boolean,
      "dependsOn": [],
      "subtasks": [{ "title": string, "classification": "EXPLICIT"|"INFERRED"|"SUGGESTION", "sourceQuotes": string[] }]
    }
  ]
}`;
}

/** Re-run one module; ids are re-issued by the caller (renumberPlan). */
export async function regenerateModule(
  userId: string,
  briefText: string,
  plan: AIPlan,
  moduleIndex: number,
  lang: OutputLanguage,
): Promise<PlanModule> {
  const prompt = regenerateModulePrompt(briefText, plan, moduleIndex, lang);
  const mod = await runPlanStage(
    userId,
    prompt,
    planModuleSchema,
    2_500,
  );
  // DependsOn inside a regenerated module starts clean — the reviewer can
  // re-link manually; cross-module refs would otherwise dangle.
  return { ...mod, tasks: mod.tasks.map((t) => ({ ...t, dependsOn: [] })) };
}

// Keep zod referenced for the module schema parse used above.
void z;