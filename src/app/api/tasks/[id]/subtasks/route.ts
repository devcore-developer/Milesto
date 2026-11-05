import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  subtaskCreateSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// POST /api/tasks/:id/subtasks — add a subtask
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const task = await db.task.findFirst({ where: { id, userId: user.id } });
    if (!task) {
      return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
    }

    const parsed = subtaskCreateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const count = await db.subtask.count({ where: { taskId: id } });
    const subtask = await db.subtask.create({
      data: { title: parsed.data.title, taskId: id, order: count },
    });

    return NextResponse.json({ subtask }, { status: 201 });
  } catch (e) {
    console.error("[subtasks POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
