import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { invoiceUpdateSchema, validationError, zodIssues } from "@/lib/validation";
import type { DiscountType, InvoiceDTO } from "@/lib/types";
import { serializeInvoice } from "@/lib/serializers";
import { invoiceDiscountAmount, invoiceTotal, round2 } from "@/lib/finance";

type Params = { params: Promise<{ id: string }> };

const INVOICE_INCLUDE = {
  payments: { orderBy: { paidAt: "desc" as const } },
  client: { select: { id: true, name: true, company: true } },
  project: { select: { id: true, name: true } },
};

// GET /api/invoices/:id — single invoice with payments
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const invoice = await db.invoice.findFirst({
      where: { id, userId: user.id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) {
      return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ invoice: serializeInvoice(invoice) });
  } catch (e) {
    console.error("[invoice GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// PATCH /api/invoices/:id — edit invoice data (totals always recomputed)
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.invoice.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });
    }

    const parsed = invoiceUpdateSchema.safeParse(await req.json());
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
    if (d.projectId) {
      const project = await db.project.findFirst({
        where: { id: d.projectId, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
      }
    }

    const data: Record<string, unknown> = {};
    if (d.clientId !== undefined) data.clientId = d.clientId;
    if (d.projectId !== undefined) data.projectId = d.projectId ?? null;
    if (d.number !== undefined && d.number !== null && d.number.trim())
      data.number = d.number.trim();
    if (d.status !== undefined) data.status = d.status;
    if (d.issueDate !== undefined)
      data.issueDate = d.issueDate ? new Date(d.issueDate) : new Date();
    if (d.dueDate !== undefined) data.dueDate = d.dueDate ? new Date(d.dueDate) : null;
    if (d.notes !== undefined) data.notes = d.notes;
    if (d.terms !== undefined) data.terms = d.terms;

    // Recompute the money chain from the effective (merged) values so the
    // stored totals can never disagree with the line inputs.
    const subtotal = d.subtotal !== undefined ? round2(d.subtotal) : existing.subtotal;
    const discountType = (d.discountType ?? existing.discountType) as DiscountType;
    const discountValue =
      d.discountValue !== undefined ? round2(d.discountValue) : existing.discountValue;
    data.subtotal = subtotal;
    data.discountType = discountType;
    data.discountValue = discountValue;
    data.discountAmount = invoiceDiscountAmount(subtotal, discountType, discountValue);
    data.total = invoiceTotal(subtotal, data.discountAmount as number);

    let invoice;
    try {
      invoice = await db.invoice.update({
        where: { id },
        data,
        include: INVOICE_INCLUDE,
      });
    } catch (err) {
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

    return NextResponse.json({ invoice: serializeInvoice(invoice) });
  } catch (e) {
    console.error("[invoice PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/invoices/:id — delete invoice (its payments cascade)
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.invoice.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });
    }
    await db.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[invoice DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}