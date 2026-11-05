import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { clientCreateSchema, validationError, zodIssues } from "@/lib/validation";
import { CLIENT_STATUSES, type ClientDTO } from "@/lib/types";
import { serializeClient } from "@/lib/serializers";

// GET /api/clients — list clients with per-client financial summaries
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const q = sp.get("q")?.trim();

    const where: Prisma.ClientWhereInput = { userId: user.id };
    if (status && CLIENT_STATUSES.includes(status as never)) {
      where.status = status;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { company: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const clients = await db.client.findMany({
      where,
      include: {
        _count: { select: { projects: true, invoices: true } },
        projects: {
          select: { status: true, agreedPrice: true, additionalCharges: true, discount: true },
        },
        invoices: {
          select: { status: true, total: true, amountPaid: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const dtos: ClientDTO[] = clients.map(serializeClient);
    return NextResponse.json({ clients: dtos });
  } catch (e) {
    console.error("[clients GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/clients — create a client
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = clientCreateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    const client = await db.client.create({
      data: {
        name: d.name,
        company: d.company ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        address: d.address ?? null,
        notes: d.notes ?? null,
        status: d.status ?? "ACTIVE",
        userId: user.id,
      },
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

    return NextResponse.json({ client: serializeClient(client) }, { status: 201 });
  } catch (e) {
    console.error("[clients POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}