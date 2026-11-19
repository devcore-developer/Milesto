import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, conversationCreateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id/ai-assistant/conversations — recent threads
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    const conversations = await db.aIConversation.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { _count: { select: { messages: true } } },
    });
    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        language: c.language,
        messageCount: c._count.messages,
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[assistant conversations GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST — start a new empty thread
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    const parsed = conversationCreateSchema.safeParse(
      await req.json().catch(() => ({})),
    );
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const conversation = await db.aIConversation.create({
      data: { projectId: id, title: parsed.data.title, language: parsed.data.language },
    });
    return NextResponse.json(
      { conversation: { id: conversation.id, title: conversation.title } },
      { status: 201 },
    );
  } catch (e) {
    console.error("[assistant conversations POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}