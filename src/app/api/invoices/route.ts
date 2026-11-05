import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { invoiceCreateSchema, validationError, zodIssues } from "@/lib/validation";
import type { InvoiceDTO } from "@/lib/types";
import { serializeInvoice } from "@/lib/serializers";
import {
  invoiceDiscountAmount,
  invoiceTotal,
  resolveInvoiceCurrency,
  round2,
} from "@/lib/finance";
import { getBusinessSettings } from "@/lib/business-settings";

/** Next sequential invoice number for this user: INV-YYYY-#### */
async function generateInvoiceNumber(userId: string): Promise<string> {
  const prefix = `INV-${new Date().getFullYear()}-`;
  const count = await db.invoice.count({
    where: { userId, number: { startsWith: prefix } },
  });
  for (let i = count + 1; i < count + 1000; i++) {
    const candidate = `${prefix}${String(i).padStart(4, "0")}`;
    const exists = await db.invoice.findUnique({ where: { number: candidate } });
    if (!exists) return candidate;
  }
  return `${prefix}${Date.now()}`;
}

const INVOICE_INCLUDE = {
  payments: { orderBy: { paidAt: "desc" as const } },
  items: { orderBy: { order: "asc" as const } },
  client: { select: { id: true, name: true, company: true, email: true, phone: true, address: true } },
  project: { select: { id: true, name: true } },
};

// GET /api/invoices — list invoices (newest first) with optional filters
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim();
    const clientId = sp.get("clientId");
    const projectId = sp.get("projectId");

    const where: Prisma.InvoiceWhereInput = { userId: user.id };
    if (clientId) where.clientId = clientId;
    if (projectId) where.projectId = projectId;
    if (q) {
      where.OR = [
        { number: { contains: q } },
        { notes: { contains: q } },
        { client: { name: { contains: q } } },
        { client: { company: { contains: q } } },
      ];
    }

    const invoices = await db.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    const dtos: InvoiceDTO[] = invoices.map(serializeInvoice);
    return NextResponse.json({ invoices: dtos });
  } catch (e) {
    console.error("[invoices GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/invoices — create an invoice.
// When `items` is provided the subtotal is computed from the line items and
// the manual `subtotal` field is ignored; otherwise the manual subtotal is
// used (legacy invoices without line items). The server always computes
// discount amount, additional charges and the final total itself.
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = invoiceCreateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    // The client must exist and belong to the owner.
    const client = await db.client.findFirst({
      where: { id: d.clientId, userId: user.id },
    });
    if (!client) {
      return NextResponse.json({ error: "CLIENT_NOT_FOUND" }, { status: 404 });
    }
    // Optional project link — must also belong to the owner.
    if (d.projectId) {
      const project = await db.project.findFirst({
        where: { id: d.projectId, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
      }
    }

    // Line items are the source of truth for the subtotal when present.
    const hasItems = Array.isArray(d.items) && d.items.length > 0;
    const items = hasItems ? d.items! : [];
    const subtotal = hasItems
      ? round2(items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0))
      : round2(d.subtotal ?? 0);

    const discountType = d.discountType ?? "PERCENTAGE";
    const discountAmount = invoiceDiscountAmount(subtotal, discountType, d.discountValue ?? 0);
    const additionalCharges = round2(d.additionalCharges ?? 0);
    const total = invoiceTotal(subtotal, discountAmount, additionalCharges);

    const settingsRow = await getBusinessSettings(user.id);
    const currency = resolveInvoiceCurrency(d.currency, {
      currency: settingsRow.currency,
    });

    const number =
      d.number && d.number.trim() ? d.number.trim() : await generateInvoiceNumber(user.id);

    let invoice;
    try {
      invoice = await db.invoice.create({
        data: {
          number,
          status: d.status ?? "DRAFT",
          issueDate: d.issueDate ? new Date(d.issueDate) : new Date(),
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          subtotal,
          discountType,
          discountValue: round2(d.discountValue ?? 0),
          discountAmount,
          additionalCharges,
          additionalNotes: d.additionalNotes ?? null,
          total,
          amountPaid: 0,
          currency,
          notes: d.notes ?? null,
          terms: d.terms ?? null,
          userId: user.id,
          clientId: d.clientId,
          projectId: d.projectId ?? null,
          ...(hasItems
            ? {
                items: {
                  create: items.map((it, index) => ({
                    description: it.description,
                    quantity: it.quantity,
                    unitPrice: round2(it.unitPrice),
                    amount: round2(it.quantity * it.unitPrice),
                    order: index,
                  })),
                },
              }
            : {}),
        },
        include: INVOICE_INCLUDE,
      });
    } catch (err) {
      // Unique constraint on `number`
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        return NextResponse.json({ error: "INVOICE_NUMBER_TAKEN" }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json(
      { invoice: serializeInvoice(invoice) },
      { status: 201 },
    );
  } catch (e) {
    console.error("[invoices POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}