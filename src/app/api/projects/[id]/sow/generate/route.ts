import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { validationError, zodIssues, sowGenerateSchema } from "@/lib/validation";
import { aiErrorStatus } from "@/lib/ai/client";
import { aiStatus } from "@/lib/ai/provider";
import { loadBriefText } from "@/lib/ai/brief-context";
import { draftPayloadOf } from "@/lib/serializers";
import {
  buildSowPrompt,
  generateSowDraft,
  sowDraftToContent,
  type SowLanguage,
} from "@/lib/ai/prompts/sow-generator";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

async function nextSowVersion(userId: string, projectId: string) {
  const previous = await db.documentRecord.findFirst({
    where: { userId, projectId, type: "SCOPE_OF_WORK" },
    orderBy: [{ versionNo: "desc" }, { createdAt: "desc" }],
    select: { id: true, versionNo: true },
  });
  return { versionNo: (previous?.versionNo ?? 0) + 1, previousVersionId: previous?.id ?? null };
}

/** Next sequential document number for this user: DOC-YYYY-#### */
async function generateDocumentNumber(userId: string): Promise<string> {
  const prefix = `DOC-${new Date().getFullYear()}-`;
  const count = await db.documentRecord.count({
    where: { userId, number: { startsWith: prefix } },
  });
  for (let i = count + 1; i < count + 1000; i++) {
    const candidate = `${prefix}${String(i).padStart(4, "0")}`;
    const exists = await db.documentRecord.findUnique({
      where: { number: candidate },
    });
    if (!exists) return candidate;
  }
  return `${prefix}${Date.now()}`;
}

// POST /api/projects/:id/sow/generate — AI Scope of Work as a NEW version
// inside the EXISTING documents module (previous versions stay untouched).
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const project = await db.project.findFirst({
      where: { id, userId: user.id },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    if (!aiStatus().configured) {
      return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 400 });
    }

    const parsed = sowGenerateSchema.safeParse(
      await req.json().catch(() => ({})),
    );
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const language = parsed.data.language as SowLanguage;

    const brief = await loadBriefText(id);
    if (!brief) {
      return NextResponse.json({ error: "BRIEF_EMPTY" }, { status: 409 });
    }

    // Approved plan digest (titles only) — optional but grounds the SoW.
    const approved = await db.aIPlanDraft.findFirst({
      where: { projectId: id, status: "APPROVED" },
      orderBy: { updatedAt: "desc" },
    });
    const plan = approved ? draftPayloadOf(approved) : null;

    const draft = await generateSowDraft(
      user.id,
      buildSowPrompt(brief.text, plan, language),
    );
    const { content, aiTrace } = sowDraftToContent(draft, language);

    const { versionNo, previousVersionId } = await nextSowVersion(user.id, id);
    const number = await generateDocumentNumber(user.id);
    const title = language === "ar"
      ? `نطاق العمل — ${project.name}`
      : `Scope of Work — ${project.name}`;

    const doc = await db.documentRecord.create({
      data: {
        type: "SCOPE_OF_WORK",
        number,
        title,
        language,
        userId: user.id,
        clientId: project.clientId,
        projectId: id,
        content: JSON.stringify(content),
        versionNo,
        previousVersionId,
        aiTrace: JSON.stringify(aiTrace),
      },
    });

    return NextResponse.json(
      {
        document: { id: doc.id, number: doc.number, title: doc.title, versionNo },
      },
      { status: 201 },
    );
  } catch (e) {
    const { status, code } = aiErrorStatus(e);
    console.error(`[sow generate] ${code}`);
    return NextResponse.json({ error: code }, { status });
  }
}