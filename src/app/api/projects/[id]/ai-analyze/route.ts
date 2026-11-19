import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, aiAnalyzeSchema } from "@/lib/validation";
import { serializeAIDraft } from "@/lib/serializers";
import { aiConfig } from "@/lib/ai/config";
import { aiStatus } from "@/lib/ai/provider";
import { aiErrorStatus } from "@/lib/ai/client";
import { loadBriefText } from "@/lib/ai/brief-context";
import { analyzeBriefStaged } from "@/lib/ai/prompts/analyze-brief";
import { renumberPlan } from "@/lib/ai/plan-schema";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

// POST /api/projects/:id/ai-analyze — staged analysis of the brief.
// Each stage is a short AI call; the draft row is persisted after every
// stage so a timeout keeps completed work (progressive persistence).
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const project = await db.project.findFirst({
      where: { id, userId: user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const parsed = aiAnalyzeSchema.safeParse(
      await req.json().catch(() => ({})),
    );
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const language = parsed.data.language;

    const status = aiStatus();
    if (!status.configured) {
      return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 400 });
    }

    const brief = await loadBriefText(id);
    if (!brief) {
      return NextResponse.json({ error: "BRIEF_EMPTY" }, { status: 409 });
    }

    const cfg = aiConfig();
    const draft = await db.aIPlanDraft.create({
      data: {
        projectId: id,
        briefVersionId: brief.versionId,
        status: "DRAFT",
        language,
        provider: cfg.provider,
        model: cfg.model,
        payload: "{}",
      },
    });

    try {
      const { plan, completedStages } = await analyzeBriefStaged(
        user.id,
        brief.text,
        language,
      );
      if (completedStages === 0) {
        // Nothing usable — remove the empty draft and surface the error.
        await db.aIPlanDraft.delete({ where: { id: draft.id } });
        return NextResponse.json({ error: "AI_ANALYSIS_FAILED" }, { status: 502 });
      }
      const saved = await db.aIPlanDraft.update({
        where: { id: draft.id },
        data: { payload: JSON.stringify(renumberPlan(plan)) },
      });
      return NextResponse.json({
        draft: serializeAIDraft(saved),
        // Partial analysis (stages 2-3 failed) is still reviewable.
        ...(completedStages < 3 ? { warning: "AI_PARTIAL" } : {}),
      });
    } catch (e) {
      await db.aIPlanDraft.delete({ where: { id: draft.id } }).catch(() => {});
      throw e;
    }
  } catch (e) {
    const { status, code } = aiErrorStatus(e);
    console.error(`[ai-analyze] ${code}`);
    return NextResponse.json({ error: code }, { status });
  }
}