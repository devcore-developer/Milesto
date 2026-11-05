import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { round2 } from "@/lib/finance";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/payments/:id — remove a payment (corrections) and resync
// the parent invoice's amountPaid from the remaining payment rows.
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const payment = await db.payment.findFirst({
      where: { id },
      include: { invoice: { select: { id: true, userId: true } } },
    });
    if (!payment || payment.invoice.userId !== user.id) {
      return NextResponse.json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
    }

    await db.payment.delete({ where: { id } });

    // amountPaid is always the sum of the surviving payment rows.
    const agg = await db.payment.aggregate({
      where: { invoiceId: payment.invoiceId },
      _sum: { amount: true },
    });
    await db.invoice.update({
      where: { id: payment.invoiceId },
      data: { amountPaid: round2(agg._sum.amount ?? 0) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[payment DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}