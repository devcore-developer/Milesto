import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  subtaskUpdateSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

async function getOwnedSubtask(req: NextRequest, id: string) {
  const user = await getSessionUser(req);
  if (!user) return { error: "unauthorized" as const };
  const subtask = await db.subtask.findUnique({
    where: { id },
    include: { task: { select: { userId: true, id: true } } },
  });
  if (!subtask || subtask.task.userId !== user.id) {
    return { error: "notfound" as const };
  }
  return { subtask };
}

// PATCH /api/subtasks/:id — toggle completion / rename
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getOwnedSubtask(req, (await params).id);
  if ("error" in auth) {
    return auth.error === "unauthorized"
      ? unauthorized()
      : NextResponse.json({ error: "SUBTASK_NOT_FOUND" }, { status: 404 });
  }

  try {
    const parsed = subtaskUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const subtask = await db.subtask.update({
      where: { id: auth.subtask.id },
      data: parsed.data,
    });
    return NextResponse.json({ subtask });
  } catch (e) {
    console.error("[subtasks PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/subtasks/:id
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getOwnedSubtask(req, (await params).id);
  if ("error" in auth) {
    return auth.error === "unauthorized"
      ? unauthorized()
      : NextResponse.json({ error: "SUBTASK_NOT_FOUND" }, { status: 404 });
  }

  try {
    await db.subtask.delete({ where: { id: auth.subtask.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[subtasks DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
