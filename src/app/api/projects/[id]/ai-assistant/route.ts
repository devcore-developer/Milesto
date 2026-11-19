import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, assistantAskSchema } from "@/lib/validation";
import { aiChatText, aiErrorStatus } from "@/lib/ai/client";
import { aiStatus } from "@/lib/ai/provider";
import { buildAssistantContext } from "@/lib/ai/context";
import { assistantSystemPrompt, assistantHistoryPrompt } from "@/lib/ai/prompts/assistant";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

// POST /api/projects/:id/ai-assistant — grounded Q&A with persisted memory.
// Context = last 10 messages + project facts + approved-plan digest.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    if (!aiStatus().configured) {
      return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 400 });
    }

    const parsed = assistantAskSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const { question, conversationId, language } = parsed.data;

    // Reuse or create the conversation (project-linked, cross-device).
    let conversation = conversationId
      ? await db.aIConversation.findFirst({
          where: { id: conversationId, projectId: id, project: { userId: user.id } },
        })
      : null;
    if (!conversation) {
      conversation = await db.aIConversation.create({
        data: {
          projectId: id,
          title: question.slice(0, 60),
          language,
        },
      });
    }

    const ctx = await buildAssistantContext(user.id, id, conversation.id);

    await db.aIMessage.create({
      data: { conversationId: conversation.id, role: "USER", content: question },
    });

    const answer = await aiChatText(
      user.id,
      assistantHistoryPrompt(ctx.history, question),
      { system: assistantSystemPrompt(ctx.factsBlock, language), maxTokens: 900 },
    );

    const assistantMessage = await db.aIMessage.create({
      data: { conversationId: conversation.id, role: "ASSISTANT", content: answer },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      answer: assistantMessage.content,
      createdAt: assistantMessage.createdAt.toISOString(),
    });
  } catch (e) {
    const { status, code } = aiErrorStatus(e);
    console.error(`[ai-assistant] ${code}`);
    return NextResponse.json({ error: code }, { status });
  }
}