import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  documentUpdateSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";
import { serializeDocumentRecord } from "@/lib/serializers";

const DOCUMENT_INCLUDE = {
  client: {
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      address: true,
    },
  },
  project: { select: { id: true, name: true } },
};

type Params = { params: Promise<{ id: string }> };

// GET /api/documents/:id
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const document = await db.documentRecord.findFirst({
      where: { id, userId: user.id },
      include: DOCUMENT_INCLUDE,
    });
    if (!document) {
      return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ document: serializeDocumentRecord(document) });
  } catch (e) {
    console.error("[documents GET :id]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// PATCH /api/documents/:id — edit metadata and/or the whole content.
// `content` replaces the saved sections (the editor submits the full list).
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.documentRecord.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    const parsed = documentUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    if (d.clientId) {
      const client = await db.client.findFirst({
        where: { id: d.clientId, userId: user.id },
      });
      if (!client) {
        return NextResponse.json({ error: "CLIENT_NOT_FOUND" }, { status: 404 });
      }
    }
    if (d.projectId) {
      const project = await db.project.findFirst({
        where: { id: d.projectId, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
      }
    }

    const document = await db.documentRecord.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.language !== undefined ? { language: d.language } : {}),
        ...(d.issueDate !== undefined ? { issueDate: new Date(d.issueDate) } : {}),
        ...(d.clientId !== undefined ? { clientId: d.clientId ?? null } : {}),
        ...(d.projectId !== undefined ? { projectId: d.projectId ?? null } : {}),
        ...(d.content !== undefined ? { content: JSON.stringify(d.content) } : {}),
      },
      include: DOCUMENT_INCLUDE,
    });

    return NextResponse.json({ document: serializeDocumentRecord(document) });
  } catch (e) {
    console.error("[documents PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/documents/:id
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.documentRecord.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }
    await db.documentRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[documents DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}