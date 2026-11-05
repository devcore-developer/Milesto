import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  documentCreateSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";
import type { DocumentRecordDTO } from "@/lib/types";
import { serializeDocumentRecord } from "@/lib/serializers";

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

// GET /api/documents — list documents (newest first) with optional filters
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim();
    const type = sp.get("type");
    const clientId = sp.get("clientId");
    const projectId = sp.get("projectId");

    const where: Prisma.DocumentRecordWhereInput = { userId: user.id };
    if (type) where.type = type;
    if (clientId) where.clientId = clientId;
    if (projectId) where.projectId = projectId;
    if (q) {
      where.OR = [
        { number: { contains: q } },
        { title: { contains: q } },
        { client: { name: { contains: q } } },
        { client: { company: { contains: q } } },
        { project: { name: { contains: q } } },
      ];
    }

    const documents = await db.documentRecord.findMany({
      where,
      include: DOCUMENT_INCLUDE,
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    const dtos: DocumentRecordDTO[] = documents.map(serializeDocumentRecord);
    return NextResponse.json({ documents: dtos });
  } catch (e) {
    console.error("[documents GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/documents — create a document with its generated content.
// The number is always auto-generated (DOC-YYYY-####); client and project
// links are optional but must belong to the owner when provided.
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = documentCreateSchema.safeParse(await req.json());
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

    const number = await generateDocumentNumber(user.id);

    const document = await db.documentRecord.create({
      data: {
        number,
        type: d.type,
        title: d.title,
        language: d.language ?? "en",
        issueDate: d.issueDate ? new Date(d.issueDate) : new Date(),
        content: JSON.stringify(d.content),
        userId: user.id,
        clientId: d.clientId ?? null,
        projectId: d.projectId ?? null,
      },
      include: DOCUMENT_INCLUDE,
    });

    return NextResponse.json(
      { document: serializeDocumentRecord(document) },
      { status: 201 },
    );
  } catch (e) {
    console.error("[documents POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}