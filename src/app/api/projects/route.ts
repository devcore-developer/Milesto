import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { projectCreateSchema, validationError, zodIssues } from "@/lib/validation";
import { PROJECT_STATUSES, TASK_PRIORITIES, type ProjectDTO } from "@/lib/types";
import { serializeProject } from "@/lib/project-utils";

// GET /api/projects — list projects with optional filters
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const priority = sp.get("priority");
    const q = sp.get("q")?.trim();

    const where: Prisma.ProjectWhereInput = { userId: user.id };
    if (status && PROJECT_STATUSES.includes(status as never)) {
      where.status = status;
    }
    if (priority && TASK_PRIORITIES.includes(priority as never)) {
      where.priority = priority;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const projects = await db.project.findMany({
      where,
      include: {
        _count: { select: { tasks: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Count completed tasks per project in one grouped query.
    const ids = projects.map((p) => p.id);
    const doneGroups = ids.length
      ? await db.task.groupBy({
          by: ["projectId"],
          where: { userId: user.id, projectId: { in: ids }, status: "COMPLETED" },
          _count: { _all: true },
        })
      : [];
    const doneMap = new Map(
      doneGroups.map((g) => [g.projectId ?? "", g._count._all]),
    );

    const dtos: ProjectDTO[] = projects.map((p) =>
      serializeProject(p, doneMap.get(p.id) ?? 0),
    );

    return NextResponse.json({ projects: dtos });
  } catch (e) {
    console.error("[projects GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/projects — create a project
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = projectCreateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    // Optional client link — must belong to the owner.
    if (d.clientId) {
      const client = await db.client.findFirst({
        where: { id: d.clientId, userId: user.id },
      });
      if (!client) {
        return NextResponse.json({ error: "CLIENT_NOT_FOUND" }, { status: 404 });
      }
    }

    const project = await db.project.create({
      data: {
        name: d.name,
        description: d.description ?? null,
        status: d.status ?? "PLANNING",
        priority: d.priority ?? "MEDIUM",
        startDate: d.startDate ? new Date(d.startDate) : null,
        deadline: d.deadline ? new Date(d.deadline) : null,
        deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : null,
        color: d.color ?? null,
        notes: d.notes ?? null,
        clientId: d.clientId ?? null,
        agreedPrice: d.agreedPrice ?? 0,
        additionalCharges: d.additionalCharges ?? 0,
        additionalNotes: d.additionalNotes ?? null,
        discount: d.discount ?? 0,
        userId: user.id,
      },
      include: {
        _count: { select: { tasks: true } },
        client: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ project: serializeProject(project, 0) }, { status: 201 });
  } catch (e) {
    console.error("[projects POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}