import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { projectUpdateSchema, validationError, zodIssues } from "@/lib/validation";
import type { ProjectDetailDTO, ProjectStatus, TaskDTO } from "@/lib/types";
import { calendarDaysUntil, isProjectOverdue, projectProgress, serializeProject } from "@/lib/project-utils";
import { serializeInvoice } from "@/lib/serializers";
import { projectFinancialSummary } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

function toTaskDTO(task: {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  order: number;
  categoryId: string | null;
  projectId: string | null;
  category: { id: string; name: string; color: string } | null;
  subtasks: {
    id: string;
    taskId: string;
    title: string;
    completed: boolean;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}): TaskDTO {
  return {
    ...task,
    status: task.status as TaskDTO["status"],
    priority: task.priority as TaskDTO["priority"],
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    subtasks: task.subtasks.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

// GET /api/projects/:id — project details incl. its tasks
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const project = await db.project.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: { select: { tasks: true } },
        client: { select: { id: true, name: true } },
        invoices: {
          include: {
            payments: { orderBy: { paidAt: "desc" } },
            client: { select: { id: true, name: true, company: true } },
            project: { select: { id: true, name: true } },
          },
          orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        },
        tasks: {
          orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
          include: {
            subtasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
            category: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const tasks = project.tasks.map(toTaskDTO);
    const { taskTotal, taskDone, progressPct } = projectProgress(tasks);
    const status = project.status as ProjectStatus;

    const financials = projectFinancialSummary(project, project.invoices);

    const dto: ProjectDetailDTO = {
      id: project.id,
      name: project.name,
      description: project.description,
      status,
      priority: project.priority as ProjectDetailDTO["priority"],
      startDate: project.startDate?.toISOString() ?? null,
      deadline: project.deadline?.toISOString() ?? null,
      deliveryDate: project.deliveryDate?.toISOString() ?? null,
      color: project.color,
      notes: project.notes,
      taskTotal,
      taskDone,
      progressPct,
      overdue: isProjectOverdue(
        project.deadline ? project.deadline.toISOString() : null,
        status,
      ),
      daysRemaining: calendarDaysUntil(project.deadline),
      client: project.clientId
        ? {
            id: project.client?.id ?? project.clientId,
            name: project.client?.name ?? "",
          }
        : null,
      agreedPrice: project.agreedPrice,
      additionalCharges: project.additionalCharges,
      additionalNotes: project.additionalNotes,
      discount: project.discount,
      totalValue: financials.totalValue,
      paid: financials.paid,
      remaining: financials.remaining,
      invoices: project.invoices.map(serializeInvoice),
      tasks,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };

    return NextResponse.json({ project: dto });
  } catch (e) {
    console.error("[project GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// PATCH /api/projects/:id — update a project
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const parsed = projectUpdateSchema.safeParse(await req.json());
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

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.description !== undefined) data.description = d.description;
    if (d.status !== undefined) data.status = d.status;
    if (d.priority !== undefined) data.priority = d.priority;
    if (d.startDate !== undefined)
      data.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.deadline !== undefined)
      data.deadline = d.deadline ? new Date(d.deadline) : null;
    if (d.deliveryDate !== undefined)
      data.deliveryDate = d.deliveryDate ? new Date(d.deliveryDate) : null;
    if (d.color !== undefined) data.color = d.color;
    if (d.notes !== undefined) data.notes = d.notes;
    // ── Financials & client link (Phase 4) ──
    if (d.clientId !== undefined) data.clientId = d.clientId ?? null;
    if (d.agreedPrice !== undefined) data.agreedPrice = d.agreedPrice;
    if (d.additionalCharges !== undefined) data.additionalCharges = d.additionalCharges;
    if (d.additionalNotes !== undefined) data.additionalNotes = d.additionalNotes;
    if (d.discount !== undefined) data.discount = d.discount;

    const project = await db.project.update({
      where: { id },
      data,
      include: {
        _count: { select: { tasks: true } },
        client: { select: { id: true, name: true } },
      },
    });

    const taskDone = await db.task.count({
      where: { projectId: id, userId: user.id, status: "COMPLETED" },
    });

    return NextResponse.json({ project: serializeProject(project, taskDone) });
  } catch (e) {
    console.error("[project PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/projects/:id — delete a project (its tasks are kept, unlinked)
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    // onDelete: SetNull — tasks remain but lose their project reference.
    await db.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[project DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}