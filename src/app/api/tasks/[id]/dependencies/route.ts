import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { taskDependenciesSchema, validationError, zodIssues } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// PUT /api/tasks/:id/dependencies — replace the finish-to-start links of a
// task. Validates ownership, self-links, unknown ids AND cycles (topological
// check over the task's whole project graph) BEFORE anything is saved.
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const task = await db.task.findFirst({
      where: { id, userId: user.id },
      include: { project: { select: { id: true } } },
    });
    if (!task) {
      return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
    }

    const parsed = taskDependenciesSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const dependsOnIds = [...new Set(parsed.data.dependsOnIds)];

    if (dependsOnIds.includes(id)) {
      return NextResponse.json({ error: "DEPENDENCY_SELF" }, { status: 400 });
    }

    // All dependencies must be real tasks visible to this user, and (when
    // this task belongs to a project) belong to the SAME project.
    const candidates = await db.task.findMany({
      where: { id: { in: dependsOnIds }, userId: user.id },
      select: { id: true, projectId: true },
    });
    if (candidates.length !== dependsOnIds.length) {
      return NextResponse.json({ error: "DEPENDENCY_NOT_FOUND" }, { status: 400 });
    }
    if (task.projectId) {
      const foreign = candidates.some((c) => c.projectId !== task.projectId);
      if (foreign) {
        return NextResponse.json(
          { error: "DEPENDENCY_PROJECT_MISMATCH" },
          { status: 400 },
        );
      }
    }

    // Cycle check on the graph this task participates in: its project's
    // tasks (or, for unlinked tasks, all user tasks sharing links).
    const graphTasks = await db.task.findMany({
      where: task.projectId
        ? { projectId: task.projectId, userId: user.id }
        : { userId: user.id },
      select: {
        id: true,
        blockingDependencies: { select: { dependsOnId: true } },
      },
    });
    // Proposed edges replace this task's current edges.
    const edges = new Map<string, string[]>();
    for (const t of graphTasks) {
      edges.set(
        t.id,
        t.id === id ? dependsOnIds : t.blockingDependencies.map((d) => d.dependsOnId),
      );
    }

    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    let cycle = false;
    const visit = (node: string) => {
      if (cycle) return;
      color.set(node, GRAY);
      for (const next of edges.get(node) ?? []) {
        if (!edges.has(next)) continue;
        const c = color.get(next) ?? WHITE;
        if (c === GRAY) {
          cycle = true;
          return;
        }
        if (c === WHITE) visit(next);
      }
      color.set(node, BLACK);
    };
    for (const node of edges.keys()) {
      if ((color.get(node) ?? WHITE) === WHITE) visit(node);
      if (cycle) break;
    }
    if (cycle) {
      return NextResponse.json({ error: "DEPENDENCY_CYCLE" }, { status: 409 });
    }

    await db.$transaction([
      db.taskDependency.deleteMany({ where: { taskId: id } }),
      db.taskDependency.createMany({
        data: dependsOnIds.map((dependsOnId) => ({ taskId: id, dependsOnId })),
      }),
    ]);

    return NextResponse.json({ dependsOn: dependsOnIds });
  } catch (e) {
    console.error("[task dependencies PUT]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// GET /api/tasks/:id/dependencies — current dependency ids
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const task = await db.task.findFirst({
      where: { id, userId: user.id },
      include: { blockingDependencies: { select: { dependsOnId: true } } },
    });
    if (!task) {
      return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({
      dependsOn: task.blockingDependencies.map((d) => d.dependsOnId),
    });
  } catch (e) {
    console.error("[task dependencies GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}