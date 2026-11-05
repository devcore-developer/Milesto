import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { clientUpdateSchema, validationError, zodIssues } from "@/lib/validation";
import type { ClientDetailDTO } from "@/lib/types";
import { serializeClient, serializeInvoice } from "@/lib/serializers";
import { serializeProject } from "@/lib/project-utils";

type Params = { params: Promise<{ id: string }> };

// GET /api/clients/:id — full client profile: projects + invoices + financials
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const client = await db.client.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: { select: { projects: true, invoices: true } },
        projects: {
          include: {
            _count: { select: { tasks: true } },
            client: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          include: {
            payments: { orderBy: { paidAt: "desc" } },
            client: { select: { id: true, name: true, company: true } },
            project: { select: { id: true, name: true } },
          },
          orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        },
      },
    });
    if (!client) {
      return NextResponse.json({ error: "CLIENT_NOT_FOUND" }, { status: 404 });
    }

    // Completed-task counts for the client's projects (single grouped query).
    const ids = client.projects.map((p) => p.id);
    const doneGroups = ids.length
      ? await db.task.groupBy({
          by: ["projectId"],
          where: { userId: user.id, projectId: { in: ids }, status: "COMPLETED" },
          _count: { _all: true },
        })
      : [];
    const doneMap = new Map(doneGroups.map((g) => [g.projectId ?? "", g._count._all]));

    const dto: ClientDetailDTO = {
      ...serializeClient(client),
      projects: client.projects.map((p) =>
        serializeProject(p, doneMap.get(p.id) ?? 0),
      ),
      invoices: client.invoices.map(serializeInvoice),
    };

    return NextResponse.json({ client: dto });
  } catch (e) {
    console.error("[client GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// PATCH /api/clients/:id — update client information
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.client.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "CLIENT_NOT_FOUND" }, { status: 404 });
    }

    const parsed = clientUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.company !== undefined) data.company = d.company;
    if (d.email !== undefined) data.email = d.email;
    if (d.phone !== undefined) data.phone = d.phone;
    if (d.address !== undefined) data.address = d.address;
    if (d.notes !== undefined) data.notes = d.notes;
    if (d.status !== undefined) data.status = d.status;

    const client = await db.client.update({
      where: { id },
      data,
      include: {
        _count: { select: { projects: true, invoices: true } },
        projects: {
          select: { status: true, agreedPrice: true, additionalCharges: true, discount: true },
        },
        invoices: {
          select: { status: true, total: true, amountPaid: true },
        },
      },
    });

    return NextResponse.json({ client: serializeClient(client) });
  } catch (e) {
    console.error("[client PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/clients/:id — delete a client.
// Projects are kept but unlinked (onDelete: SetNull). Clients that still
// have invoices are protected so financial records can never be orphaned.
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.client.findFirst({
      where: { id, userId: user.id },
      include: { _count: { select: { invoices: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "CLIENT_NOT_FOUND" }, { status: 404 });
    }
    if (existing._count.invoices > 0) {
      return NextResponse.json({ error: "CLIENT_HAS_INVOICES" }, { status: 409 });
    }

    await db.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[client DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}