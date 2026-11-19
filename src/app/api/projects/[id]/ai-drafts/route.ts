import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { serializeAIDraftSummary } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id/ai-drafts — recent plan drafts (summary rows).
export async function GET(req: NextRequest, { params }: Params) {
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

    const drafts = await db.aIPlanDraft.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return NextResponse.json({ drafts: drafts.map(serializeAIDraftSummary) });
  } catch (e) {
    console.error("[ai-drafts GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}