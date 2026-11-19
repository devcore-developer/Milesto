import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { timelineComputeSchema, validationError, zodIssues } from "@/lib/validation";
import {
  parseSchedulingSettings,
  scheduleProject,
  type ScheduleTaskInput,
} from "@/lib/scheduling";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/:id/timeline — deterministic recomputation of task
// dates from the project anchor + dependencies + working-time settings.
//
// Safety rule (locked decision): manually approved dates are NEVER silently
// overwritten — `apply` writes tasks that have no dates yet, plus (with
// `overwriteAll`) every non-completed task when the user explicitly asks.
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

    const parsed = timelineComputeSchema.safeParse(
      await req.json().catch(() => ({})),
    );
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const { mode, apply, startDate, deadline, overwriteAll } = parsed.data;

    const anchorStart = startDate ?? project.startDate?.toISOString() ?? null;
    const anchorDeadline =
      deadline !== undefined ? deadline : project.deadline?.toISOString() ?? null;
    if (mode === "forward" && !anchorStart) {
      return NextResponse.json({ error: "TIMELINE_NO_START" }, { status: 409 });
    }
    if (mode === "backward" && !anchorDeadline && !anchorStart) {
      return NextResponse.json({ error: "TIMELINE_NO_ANCHOR" }, { status: 409 });
    }

    const tasks = await db.task.findMany({
      where: { projectId: id, userId: user.id },
      include: { blockingDependencies: { select: { dependsOnId: true } } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    const settings = await db.businessSettings.findUnique({
      where: { userId: user.id },
    });
    const { workingDays, holidays } = parseSchedulingSettings(
      settings ?? { workingDays: "[0,1,2,3,4]", holidays: "[]" },
    );
    const defaultDurationDays = settings?.defaultTaskDurationDays ?? 1;

    const inputs: ScheduleTaskInput[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      isMilestone: t.isMilestone,
      status: t.status,
      startDate: t.startDate?.toISOString() ?? null,
      dueDate: t.dueDate?.toISOString() ?? null,
      dependsOn: t.blockingDependencies.map((d) => d.dependsOnId),
    }));

    const result = scheduleProject(
      inputs,
      {
        startDate: anchorStart ?? anchorDeadline ?? new Date().toISOString(),
        deadline: anchorDeadline,
        workingDays,
        holidays,
        mode,
      },
      defaultDurationDays,
    );

    let applied = 0;
    if (apply && result.scheduled.length > 0) {
      const byId = new Map(result.scheduled.map((s) => [s.taskId, s]));
      for (const t of tasks) {
        const s = byId.get(t.id);
        if (!s || !s.start || !s.end) continue;
        if (t.status === "COMPLETED") continue; // history stays frozen
        const hasDates = Boolean(t.startDate && t.dueDate);
        if (hasDates && !overwriteAll) continue; // manual dates win by default
        await db.task.update({
          where: { id: t.id },
          data: {
            startDate: new Date(`${s.start}T00:00:00`),
            dueDate: new Date(`${s.end}T00:00:00`),
          },
        });
        applied += 1;
      }
    }

    return NextResponse.json({
      schedule: result.scheduled,
      makespanDays: result.makespanDays,
      planStart: result.planStart,
      planEnd: result.planEnd,
      cyclic: result.cyclic,
      workingDays,
      holidays,
      applied,
    });
  } catch (e) {
    console.error("[timeline POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}