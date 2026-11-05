import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { paymentCreateSchema, validationError, zodIssues } from "@/lib/validation";
import type { InvoiceDTO } from "@/lib/types";
import { serializeInvoice } from "@/lib/serializers";
import { invoiceRemaining, round2 } from "@/lib/finance";

type Params = { params: Promise<{ id: string }> };

// POST /api/invoices/:id/payments — record a payment against an invoice.
// Rules that keep the financial data consistent:
//   • drafts cannot receive payments (send the invoice first),
//   • cancelled invoices cannot receive payments,
//   • a payment may never exceed the remaining balance.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const invoice = await db.invoice.findFirst({
      where: { id, userId: user.id },
    });
    if (!invoice) {
      return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });
    }
    if (invoice.status === "DRAFT") {
      return NextResponse.json({ error: "INVOICE_DRAFT" }, { status: 400 });
    }
    if (invoice.status === "CANCELLED") {
      return NextResponse.json({ error: "INVOICE_CANCELLED" }, { status: 400 });
    }

    const parsed = paymentCreateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));
    const d = parsed.data;

    const remaining = invoiceRemaining(invoice.total, invoice.amountPaid);
    if (round2(d.amount) > remaining + 0.001) {
      return NextResponse.json({ error: "OVERPAID" }, { status: 400 });
    }

    const [payment, updatedInvoice] = await db.$transaction([
      db.payment.create({
        data: {
          amount: round2(d.amount),
          paidAt: d.paidAt ? new Date(d.paidAt) : new Date(),
          method: d.method ?? null,
          notes: d.notes ?? null,
          invoiceId: invoice.id,
        },
      }),
      db.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: round2(invoice.amountPaid + d.amount) },
      }),
    ]);

    const fresh = await db.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: {
        payments: { orderBy: { paidAt: "desc" } },
        client: { select: { id: true, name: true, company: true } },
        project: { select: { id: true, name: true } },
      },
    });

    void payment;
    void updatedInvoice;
    return NextResponse.json(
      { invoice: serializeInvoice(fresh) as InvoiceDTO },
      { status: 201 },
    );
  } catch (e) {
    console.error("[payment POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}