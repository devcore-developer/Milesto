import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { briefSaveSchema, validationError, zodIssues } from "@/lib/validation";
import { serializeBriefVersion } from "@/lib/serializers";
import type { BriefDTO, BriefVersionSummaryDTO } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

async function loadBriefForUser(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) return null;
  return db.projectBrief.findUnique({
    where: { projectId },
    include: {
      versions: {
        orderBy: { versionNo: "desc" },
        include: { attachments: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
}

// GET /api/projects/:id/brief — latest version + version list.
// With ?version=N — the full body of that specific version (attachments incl.).
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

    const versionParam = req.nextUrl.searchParams.get("version");
    if (versionParam) {
      const versionNo = Number(versionParam);
      if (!Number.isInteger(versionNo) || versionNo < 1) {
        return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
      }
      const brief = await db.projectBrief.findUnique({ where: { projectId: id } });
      const version = brief
        ? await db.briefVersion.findFirst({
            where: { briefId: brief.id, versionNo },
            include: { attachments: { orderBy: { createdAt: "asc" } } },
          })
        : null;
      if (!version) {
        return NextResponse.json({ error: "VERSION_NOT_FOUND" }, { status: 404 });
      }
      return NextResponse.json({ version: serializeBriefVersion(version) });
    }

    const brief = await loadBriefForUser(user.id, id);
    if (!brief) {
      // Project exists but has no brief yet → a valid empty state.
      const project = await db.project.findFirst({
        where: { id, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
      }
      const dto: BriefDTO = {
        projectId: id,
        latest: null,
        versions: [],
      };
      return NextResponse.json({ brief: dto });
    }

    const [latestRow, ...older] = brief.versions;
    const dto: BriefDTO = {
      projectId: id,
      latest: latestRow ? serializeBriefVersion(latestRow) : null,
      versions: brief.versions.map(
        (v): BriefVersionSummaryDTO => ({
          id: v.id,
          versionNo: v.versionNo,
          createdAt: v.createdAt.toISOString(),
          attachmentCount: v.attachments.length,
          contentPreview: v.content.slice(0, 140),
        }),
      ),
    };
    // `older` rows are only summarized above — the full bodies stay in DB
    // until the user explicitly opens one (via the version list).
    void older;
    return NextResponse.json({ brief: dto });
  } catch (e) {
    console.error("[brief GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/projects/:id/brief — save a NEW immutable version
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

    const parsed = briefSaveSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    const brief = await db.projectBrief.upsert({
      where: { projectId: id },
      create: { projectId: id },
      update: {},
    });

    const last = await db.briefVersion.findFirst({
      where: { briefId: brief.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const versionNo = (last?.versionNo ?? 0) + 1;

    const version = await db.briefVersion.create({
      data: {
        briefId: brief.id,
        versionNo,
        content: d.content,
        transcript: d.transcript ?? null,
        language: d.language,
        sourceTypes: JSON.stringify(d.sourceTypes),
      },
      include: { attachments: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json(
      { version: serializeBriefVersion(version) },
      { status: 201 },
    );
  } catch (e) {
    console.error("[brief POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}