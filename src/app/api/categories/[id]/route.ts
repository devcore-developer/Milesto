import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  categoryUpdateSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/categories/:id — rename / recolor
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.category.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 404 });
    }

    const parsed = categoryUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const category = await db.category.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        color: category.color,
        taskCount: undefined,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "CATEGORY_EXISTS" }, { status: 409 });
    }
    console.error("[categories PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/categories/:id — tasks keep existing (categoryId → null)
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await db.category.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 404 });
    }

    await db.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[categories DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
