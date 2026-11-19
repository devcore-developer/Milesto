import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, taskSplitSchema } from "@/lib/validation";
import { aiChatJSON, aiErrorStatus } from "@/lib/ai/client";
import { aiStatus } from "@/lib/ai/provider";
import { taskSplitPrompt } from "@/lib/ai/prompts/assistant";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

const proposalsSchema = z.object({
  proposals: z
    .array(z.object({ title: z.string().min(1).max(200) }))
    .min(1)
    .max(8),
});

// POST /api/tasks/:id/ai-split — REVIEW-FIRST subtask proposal.
// Nothing is saved; the UI lets the user add the ones they want.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const task = await db.task.findFirst({ where: { id, userId: user.id } });
    if (!task) {
      return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
    }
    if (!aiStatus().configured) {
      return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 400 });
    }

    const parsed = taskSplitSchema.safeParse(
      await req.json().catch(() => ({})),
    );
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const language = parsed.data.language;

    const raw = await aiChatJSON(
      user.id,
      taskSplitPrompt(
        {
          title: task.title,
          notes: task.notes,
          dueDate: task.dueDate?.toISOString() ?? null,
        },
        language,
      ),
      { maxTokens: 700, temperature: 0.3 },
    );
    const result = proposalsSchema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json({ error: "AI_BAD_RESPONSE" }, { status: 502 });
    }
    return NextResponse.json({ proposals: result.data.proposals });
  } catch (e) {
    const { status, code } = aiErrorStatus(e);
    console.error(`[ai-split] ${code}`);
    return NextResponse.json({ error: code }, { status });
  }
}