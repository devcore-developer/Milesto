import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { briefAttachmentSchema, validationError, zodIssues } from "@/lib/validation";
import { serializeBriefAttachment } from "@/lib/serializers";
import { capForKind, processAttachment, sniffKind } from "@/lib/ai/extract";

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 60;

// POST /api/projects/:id/brief/attachments — upload into the LATEST version.
// Extraction runs server-side before the row is stored; the file itself is
// kept as a size-capped data URL (logoData pattern — no filesystem).
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

    const parsed = briefAttachmentSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const { name, mime, size, dataUrl } = parsed.data;

    // Total per-brief attachment budget (Neon free tier friendly): 24 MB.
    const brief = await db.projectBrief.findUnique({
      where: { projectId: id },
      include: {
        versions: {
          orderBy: { versionNo: "desc" },
          take: 1,
          include: { attachments: { select: { size: true } } },
        },
      },
    });
    const latest = brief?.versions[0];
    if (!latest) {
      return NextResponse.json(
        { error: "BRIEF_SAVE_FIRST" },
        { status: 409 },
      );
    }
    const used = latest.attachments.reduce((sum, a) => sum + a.size, 0);
    if (used + size > 24 * 1024 * 1024) {
      return NextResponse.json({ error: "ATTACHMENT_BUDGET" }, { status: 413 });
    }

    // MIME sniffing from magic bytes wins over the declared type.
    const kind = sniffKind(dataUrl);
    if (kind === "unknown") {
      return NextResponse.json({ error: "ATTACHMENT_TYPE" }, { status: 415 });
    }
    if (size > capForKind(kind)) {
      return NextResponse.json({ error: "ATTACHMENT_TOO_LARGE" }, { status: 413 });
    }

    const result = await processAttachment(user.id, { name, mime, dataUrl });

    const attachment = await db.briefAttachment.create({
      data: {
        versionId: latest.id,
        name,
        mime,
        size,
        dataUrl,
        extractedText: result.extractedText,
        visionSummary: result.visionSummary,
        processingStatus: result.processingStatus,
      },
    });

    return NextResponse.json(
      { attachment: serializeBriefAttachment(attachment) },
      { status: 201 },
    );
  } catch (e) {
    console.error("[brief attachment POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}