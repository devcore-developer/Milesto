import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { taskCreateSchema, validationError, zodIssues } from "@/lib/validation";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/types";

// GET /api/tasks — list tasks with optional filters
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const priority = sp.get("priority");
    const categoryId = sp.get("categoryId");
    const projectId = sp.get("projectId");
    const q = sp.get("q")?.trim();

    const where: Prisma.TaskWhereInput = { userId: user.id };
    if (status && TASK_STATUSES.includes(status as never)) {
      where.status = status;
    }
    if (priority && TASK_PRIORITIES.includes(priority as never)) {
      where.priority = priority;
    }
    if (categoryId === "none") where.categoryId = null;
    else if (categoryId) where.categoryId = categoryId;
    if (projectId) where.projectId = projectId;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const tasks = await db.task.findMany({
      where,
      include: {
        subtasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        category: { select: { id: true, name: true, color: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 1000,
    });

    return NextResponse.json({ tasks });
  } catch (e) {
    console.error("[tasks GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/tasks — create a task
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = taskCreateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    // Validate category ownership if provided
    if (d.categoryId) {
      const cat = await db.category.findFirst({
        where: { id: d.categoryId, userId: user.id },
      });
      if (!cat) {
        return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 400 });
      }
    }

    // Validate project ownership if provided
    if (d.projectId) {
      const project = await db.project.findFirst({
        where: { id: d.projectId, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 400 });
      }
    }

    const task = await db.task.create({
      data: {
        title: d.title,
        notes: d.notes ?? null,
        status: d.status ?? "TODO",
        priority: d.priority ?? "MEDIUM",
        startDate: d.startDate ? new Date(d.startDate) : null,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        categoryId: d.categoryId ?? null,
        projectId: d.projectId ?? null,
        completedAt: d.status === "COMPLETED" ? new Date() : null,
        userId: user.id,
        subtasks: d.subtasks?.length
          ? {
              create: d.subtasks.map((s, i) => ({ title: s.title, order: i })),
            }
          : undefined,
      },
      include: {
        subtasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        category: { select: { id: true, name: true, color: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    console.error("[tasks POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}