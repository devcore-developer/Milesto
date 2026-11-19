// Scope of Work generation (Phase A5) — server-only.
//
// Input  = the brief (verbatim) + the approved plan digest (titles only).
// Output = DocumentContent sections for the EXISTING manual-SoW editor/PDF
//          pipeline (never a second document system) + a per-section
//          traceability map (aiTrace) so every list item can be traced back
//          to exact brief substrings.
import { z } from "zod";
import { aiChatJSON } from "@/lib/ai/client";
import { AICallError } from "@/lib/ai/types";
import type { AIPlan } from "@/lib/ai/plan-schema";
import { listSection, textSection, newSectionId } from "@/lib/documents";
import type { DocSection, DocumentContent } from "@/lib/types";

const tracedItem = z.object({
  text: z.string().min(1).max(500),
  sourceQuotes: z.array(z.string().max(500)).max(6).default([]),
});

export const sowSchema = z.object({
  introduction: z.string().max(4_000).default(""),
  objectives: z.array(tracedItem).max(12).default([]),
  included: z.array(tracedItem).max(25).default([]),
  deliverables: z.array(tracedItem).max(25).default([]),
  excluded: z.array(tracedItem).max(20).default([]),
  assumptions: z.array(tracedItem).max(15).default([]),
  clarifications: z.array(tracedItem).max(15).default([]),
  optionalAddons: z.array(tracedItem).max(15).default([]),
  timelineNote: z.string().max(2_000).default(""),
  paymentNote: z.string().max(2_000).default(""),
});

export type SowDraft = z.infer<typeof sowSchema>;

export type SowLanguage = "en" | "ar";

const RULES = `HARD RULES:
- NEVER invent work, deliverables, dates or prices that are not supported by the brief or the approved plan below.
- Every item must carry sourceQuotes: 1-3 EXACT substrings of the brief that justify it. Items beyond the brief are allowed only in optionalAddons (clearly optional, no quotes needed).
- The Scope of Work states WHAT is included/excluded — not how the work is done internally.
- clarifications = questions that must be answered before signing.`;

const LANGUAGE_RULE = (lang: SowLanguage) =>
  lang === "ar"
    ? `OUTPUT LANGUAGE: Arabic (keep English technical terms and product names as-is).`
    : `OUTPUT LANGUAGE: English.`;

export function buildSowPrompt(
  briefText: string,
  approvedPlan: AIPlan | null,
  lang: SowLanguage,
): string {
  const digest = approvedPlan
    ? {
        objectives: approvedPlan.objectives.map((o) => o.title),
        deliverables: approvedPlan.deliverables.map((o) => o.title),
        modules: approvedPlan.modules.map((m) => ({
          name: m.name,
          tasks: m.tasks.map((t) => t.title),
        })),
        excluded: approvedPlan.excluded.map((o) => o.title),
        assumptions: approvedPlan.assumptions.map((o) => o.title),
        missingInfo: approvedPlan.missingInfo.map((o) => o.title),
        optionalAddons: approvedPlan.optionalAddons.map((o) => o.title),
      }
    : null;

  return `You are drafting a professional Scope of Work (SoW) document for a client.

PROJECT BRIEF (verbatim, do not rewrite):
<<<BRIEF
 ${briefText.slice(0, 60_000)}
BRIEF>>>

 ${digest ? `APPROVED PLAN DIGEST (already reviewed and accepted by the user — stay consistent with it):\n${JSON.stringify(digest)}\n` : "No approved plan exists yet — draft from the brief alone.\n"}
 ${RULES}
 ${LANGUAGE_RULE(lang)}
ANSWER FORMAT: one strict JSON object and nothing else.

{
  "introduction": "2-4 sentence project summary (plain text)",
  "objectives":  [{ "text": string, "sourceQuotes": string[] }],
  "included":    [{ "text": string, "sourceQuotes": string[] }],
  "deliverables":[{ "text": string, "sourceQuotes": string[] }],
  "excluded":    [{ "text": string, "sourceQuotes": string[] }],
  "assumptions": [{ "text": string, "sourceQuotes": string[] }],
  "clarifications": [{ "text": string, "sourceQuotes": string[] }],
  "optionalAddons": [{ "text": string, "sourceQuotes": string[] }],
  "timelineNote": "estimated timeline summary or empty string (NO invented dates)",
  "paymentNote": "payment terms ONLY if the brief states them, else empty string"
}`;
}

/** One AI call + zod validation + ONE repair retry (same policy as A3). */
export async function generateSowDraft(
  userId: string,
  prompt: string,
): Promise<SowDraft> {
  let raw: unknown;
  try {
    raw = await aiChatJSON(userId, prompt, { maxTokens: 3_000, temperature: 0.2 });
  } catch (e) {
    if (e instanceof AICallError) throw e;
    throw new AICallError("AI_BAD_RESPONSE", 502);
  }
  const first = sowSchema.safeParse(raw);
  if (first.success) return first.data;
  const repairPrompt = `${prompt}

Your previous answer failed validation with: ${first.error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ")}.
Return the corrected JSON object now. ANSWER FORMAT: one strict JSON object and nothing else.`;
  const retryRaw = await aiChatJSON(userId, repairPrompt, {
    maxTokens: 3_000,
    temperature: 0,
  }).catch((e) => {
    if (e instanceof AICallError) throw e;
    throw new AICallError("AI_BAD_RESPONSE", 502);
  });
  const second = sowSchema.safeParse(retryRaw);
  if (second.success) return second.data;
  throw new AICallError("AI_BAD_RESPONSE", 502, "SoW failed validation twice");
}

/** AI draft → DocumentContent (the EXISTING editor/PDF shape) + aiTrace. */
export function sowDraftToContent(
  draft: SowDraft,
  lang: SowLanguage,
): { content: DocumentContent; aiTrace: Record<string, string[]> } {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const sections: DocSection[] = [];
  const aiTrace: Record<string, string[]> = {};

  if (draft.introduction.trim()) {
    sections.push(textSection(L("Introduction", "المقدمة"), draft.introduction.trim()));
  }
  const pushList = (
    headingEn: string,
    headingAr: string,
    items: { text: string; sourceQuotes: string[] }[],
  ) => {
    if (items.length === 0) return;
    const id = newSectionId();
    sections.push({
      id,
      kind: "list",
      heading: L(headingEn, headingAr),
      items: items.map((i) => i.text),
    });
    const quotes = items.flatMap((i) => i.sourceQuotes);
    if (quotes.length) aiTrace[id] = quotes.slice(0, 40);
  };

  pushList("Objectives", "الأهداف", draft.objectives);
  pushList("Included in scope", "ضمن النطاق", draft.included);
  pushList("Deliverables", "المخرجات", draft.deliverables);
  pushList("Excluded from scope", "خارج النطاق", draft.excluded);
  pushList("Assumptions", "الافتراضات", draft.assumptions);
  pushList("Pending clarifications", "توضيحات معلقة", draft.clarifications);
  pushList("Optional add-ons", "إضافات اختيارية", draft.optionalAddons);
  if (draft.timelineNote.trim()) {
    sections.push(textSection(L("Estimated timeline", "الجدول الزمني التقديري"), draft.timelineNote.trim()));
  }
  if (draft.paymentNote.trim()) {
    sections.push(textSection(L("Payment terms", "شروط الدفع"), draft.paymentNote.trim()));
  }

  return { content: { sections }, aiTrace };
}