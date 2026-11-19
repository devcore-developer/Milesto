import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, draftRegenerateSchema } from "@/lib/validation";
import { serializeAIDraft, draftPayloadOf } from "@/lib/serializers";
import { renumberPlan } from "@/lib/ai/plan-schema";
import { loadBriefText } from "@/lib/ai/brief-context";
import { regenerateModule } from "@/lib/ai/prompts/regenerate-module";
import { aiErrorStatus } from "@/lib/ai/client";

type Params = { params: Promise<{ draftId: string }> };

export const maxDuration = 60;

// POST /api/ai/drafts/:draftId/regenerate-module — re-plan ONE module.
// A short single AI call; the rest of the reviewed plan is untouched.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { draftId } = await params;
    const draft = await db.aIPlanDraft.findFirst({
      where: { id: draftId, project: { userId: user.id } },
    });
    if (!draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }
    if (draft.status !== "DRAFT") {
      return NextResponse.json({ error: "DRAFT_IMMUTABLE" }, { status: 409 });
    }

    const parsed = draftRegenerateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const { moduleIndex } = parsed.data;

    const plan = draftPayloadOf(draft);
    if (moduleIndex < 0 || moduleIndex >= plan.modules.length) {
      return NextResponse.json({ error: "MODULE_NOT_FOUND" }, { status: 404 });
    }

    const brief = await loadBriefText(draft.projectId, draft.briefVersionId);
    if (!brief) {
      return NextResponse.json({ error: "BRIEF_EMPTY" }, { status: 409 });
    }

    const mod = await regenerateModule(
      user.id,
      brief.text,
      plan,
      moduleIndex,
      draft.language === "ar" ? "ar" : "en",
    );

    const modules = [...plan.modules];
    modules[moduleIndex] = mod;
    const updated = await db.aIPlanDraft.update({
      where: { id: draft.id },
      data: { payload: JSON.stringify(renumberPlan({ ...plan, modules })) },
    });

    return NextResponse.json({ draft: serializeAIDraft(updated) });
  } catch (e) {
    const { status, code } = aiErrorStatus(e);
    console.error(`[ai-draft regenerate] ${code}`);
    return NextResponse.json({ error: code }, { status });
  }
}