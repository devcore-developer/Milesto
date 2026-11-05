import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { taskUpdateSchema, validationError, zodIssues } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/tasks/:id — update a task
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.task.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
    }

    const parsed = taskUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    if (d.categoryId) {
      const cat = await db.category.findFirst({
        where: { id: d.categoryId, userId: user.id },
      });
      if (!cat) {
        return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 400 });
      }
    }

    // Validate project ownership if provided (empty string = unlink)
    if (d.projectId) {
      const project = await db.project.findFirst({
        where: { id: d.projectId, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.notes !== undefined) data.notes = d.notes;
    if (d.priority !== undefined) data.priority = d.priority;
    if (d.startDate !== undefined)
      data.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.dueDate !== undefined)
      data.dueDate = d.dueDate ? new Date(d.dueDate) : null;
    if (d.categoryId !== undefined) data.categoryId = d.categoryId;
    if (d.projectId !== undefined) data.projectId = d.projectId;

    if (d.status !== undefined) {
      data.status = d.status;
      if (d.status === "COMPLETED" && existing.status !== "COMPLETED") {
        data.completedAt = new Date();
      } else if (d.status !== "COMPLETED" && existing.status === "COMPLETED") {
        data.completedAt = null;
      }
    }

    const task = await db.task.update({
      where: { id },
      data,
      include: {
        subtasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        category: { select: { id: true, name: true, color: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ task });
  } catch (e) {
    console.error("[tasks PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/tasks/:id — delete a task
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.task.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
    }

    await db.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[tasks DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}