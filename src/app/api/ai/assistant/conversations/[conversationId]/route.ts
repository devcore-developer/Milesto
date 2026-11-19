import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, conversationUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ conversationId: string }> };

// GET — full thread (messages oldest-first, last 50)
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { conversationId } = await params;
    const conversation = await db.aIConversation.findFirst({
      where: { id: conversationId, project: { userId: user.id } },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    });
    if (!conversation) {
      return NextResponse.json({ error: "CONVERSATION_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        language: conversation.language,
        projectId: conversation.projectId,
      },
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[assistant conversation GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// PATCH — rename thread
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { conversationId } = await params;
    const conversation = await db.aIConversation.findFirst({
      where: { id: conversationId, project: { userId: user.id } },
    });
    if (!conversation) {
      return NextResponse.json({ error: "CONVERSATION_NOT_FOUND" }, { status: 404 });
    }
    const parsed = conversationUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const updated = await db.aIConversation.update({
      where: { id: conversation.id },
      data: { title: parsed.data.title },
    });
    return NextResponse.json({ conversation: { id: updated.id, title: updated.title } });
  } catch (e) {
    console.error("[assistant conversation PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE — remove thread (messages cascade)
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { conversationId } = await params;
    const conversation = await db.aIConversation.findFirst({
      where: { id: conversationId, project: { userId: user.id } },
    });
    if (!conversation) {
      return NextResponse.json({ error: "CONVERSATION_NOT_FOUND" }, { status: 404 });
    }
    await db.aIConversation.delete({ where: { id: conversation.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[assistant conversation DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}