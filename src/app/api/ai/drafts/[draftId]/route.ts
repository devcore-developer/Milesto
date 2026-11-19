import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { draftUpdateSchema, validationError, zodIssues } from "@/lib/validation";
import { serializeAIDraft } from "@/lib/serializers";
import { renumberPlan } from "@/lib/ai/plan-schema";

type Params = { params: Promise<{ draftId: string }> };

async function loadOwnedDraft(userId: string, draftId: string) {
  return db.aIPlanDraft.findFirst({
    where: { id: draftId, project: { userId } },
  });
}

// GET /api/ai/drafts/:draftId — full draft (plan payload included)
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { draftId } = await params;
    const draft = await loadOwnedDraft(user.id, draftId);
    if (!draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ draft: serializeAIDraft(draft) });
  } catch (e) {
    console.error("[ai-draft GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// PATCH /api/ai/drafts/:draftId — persist reviewer edits (whole plan) or
// discard the draft. APPROVED drafts are immutable history.
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { draftId } = await params;
    const draft = await loadOwnedDraft(user.id, draftId);
    if (!draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }
    if (draft.status !== "DRAFT") {
      return NextResponse.json({ error: "DRAFT_IMMUTABLE" }, { status: 409 });
    }

    const parsed = draftUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.payload !== undefined) {
      // Renumber on every save — ids stay positional and stable.
      data.payload = JSON.stringify(renumberPlan(d.payload));
    }
    if (d.status === "DISCARDED") {
      data.status = "DISCARDED";
    }

    const updated = await db.aIPlanDraft.update({
      where: { id: draft.id },
      data,
    });
    return NextResponse.json({ draft: serializeAIDraft(updated) });
  } catch (e) {
    console.error("[ai-draft PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/ai/drafts/:draftId — remove a draft entirely (DRAFT only).
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { draftId } = await params;
    const draft = await loadOwnedDraft(user.id, draftId);
    if (!draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }
    if (draft.status !== "DRAFT") {
      return NextResponse.json({ error: "DRAFT_IMMUTABLE" }, { status: 409 });
    }
    await db.aIPlanDraft.delete({ where: { id: draft.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-draft DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}