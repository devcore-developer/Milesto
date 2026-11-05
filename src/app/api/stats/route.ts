import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  TASK_PRIORITIES,
  type DashboardStats,
  type TaskDTO,
  type TaskPriority,
} from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// GET /api/stats?tzOffset=-120 — dashboard statistics
// tzOffset: minutes from Date#getTimezoneOffset (positive = west of UTC)
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const tzOffset = Number(req.nextUrl.searchParams.get("tzOffset") ?? "0") || 0;
    const now = Date.now();
    const localMidnightUtc = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate(),
    ) + tzOffset * 60_000;
    const endOfToday = localMidnightUtc + DAY_MS;

    const tasks = await db.task.findMany({
      where: { userId: user.id },
      include: {
        subtasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        category: { select: { id: true, name: true, color: true } },
      },
    });

    const serialized = tasks as unknown as TaskDTO[];

    const totals = {
      all: serialized.length,
      todo: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
    };
    const priorityCounts = new Map<TaskPriority, number>(
      TASK_PRIORITIES.map((p) => [p, 0]),
    );
    const dueToday: TaskDTO[] = [];
    const upcoming: TaskDTO[] = [];

    for (const t of serialized) {
      totals[t.status === "TODO" ? "todo" : t.status === "IN_PROGRESS" ? "inProgress" : "completed"] += 1;

      if (t.status !== "COMPLETED") {
        priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
        if (t.dueDate) {
          const due = Date.parse(t.dueDate);
          if (due < localMidnightUtc) totals.overdue += 1;
          else if (due < endOfToday) dueToday.push(t);
          else if (due < endOfToday + 7 * DAY_MS) upcoming.push(t);
        }
      }
    }

    dueToday.sort((a, b) => Date.parse(a.dueDate!) - Date.parse(b.dueDate!));
    upcoming.sort((a, b) => Date.parse(a.dueDate!) - Date.parse(b.dueDate!));

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const start = endOfToday - (6 - i) * DAY_MS;
      const completed = serialized.filter(
        (t) =>
          t.completedAt &&
          Date.parse(t.completedAt) >= start &&
          Date.parse(t.completedAt) < start + DAY_MS,
      ).length;
      return { date: isoDate(start), label: isoDate(start).slice(5), completed };
    });

    const stats: DashboardStats = {
      totals,
      completionPct:
        totals.all === 0
          ? 0
          : Math.round((totals.completed / totals.all) * 100),
      dueToday,
      upcoming: upcoming.slice(0, 8),
      byPriority: TASK_PRIORITIES.map((p) => ({
        priority: p,
        count: priorityCounts.get(p) ?? 0,
      })),
      last7Days,
    };

    return NextResponse.json({ stats });
  } catch (e) {
    console.error("[stats GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
