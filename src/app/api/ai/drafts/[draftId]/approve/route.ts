import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, draftApproveSchema } from "@/lib/validation";
import { serializeAIDraft, draftPayloadOf } from "@/lib/serializers";

type Params = { params: Promise<{ draftId: string }> };

// POST /api/ai/drafts/:draftId/approve — one-way DRAFT → APPROVED.
// ONLY the tasks the reviewer accepted become real rows (project-linked,
// TODO, with subtasks). Milestones/dates arrive with the scheduling phase.
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

    const parsed = draftApproveSchema.safeParse(
      await req.json().catch(() => ({})),
    );
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const accepted = new Set(parsed.data.acceptedTaskIds);

    const plan = draftPayloadOf(draft);
    const tasks = plan.modules.flatMap((m) => m.tasks);
    if (tasks.length === 0) {
      return NextResponse.json({ error: "DRAFT_EMPTY" }, { status: 409 });
    }

    const selected = accepted.size
      ? tasks.filter((t) => accepted.has(t.id))
      : tasks;
    if (selected.length === 0) {
      return NextResponse.json({ error: "DRAFT_EMPTY" }, { status: 409 });
    }

    // Sequential create keeps subtask nesting simple (counts are small).
    let created = 0;
    for (const t of selected) {
      const row = await db.task.create({
        data: {
          title: t.title,
          notes: t.description ?? null,
          status: "TODO",
          priority: t.priority,
          projectId: draft.projectId,
          userId: user.id,
          subtasks: {
            create: t.subtasks.map((s, i) => ({
              title: s.title,
              order: i,
            })),
          },
        },
      });
      created += 1;
      void row;
    }

    const approved = await db.aIPlanDraft.update({
      where: { id: draft.id },
      data: { status: "APPROVED" },
    });

    return NextResponse.json({
      created,
      draft: serializeAIDraft(approved),
    });
  } catch (e) {
    console.error("[ai-draft approve]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}