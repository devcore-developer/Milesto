import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  categoryCreateSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";
import { Prisma } from "@prisma/client";

// GET /api/categories — list categories with task counts
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const categories = await db.category.findMany({
      where: { userId: user.id },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        taskCount: c._count.tasks,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (e) {
    console.error("[categories GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/categories — create a category
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = categoryCreateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const category = await db.category.create({
      data: {
        name: parsed.data.name,
        color: parsed.data.color ?? "#1E3A8A",
        userId: user.id,
      },
    });

    return NextResponse.json(
      {
        category: {
          id: category.id,
          name: category.name,
          color: category.color,
          taskCount: 0,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "CATEGORY_EXISTS" }, { status: 409 });
    }
    console.error("[categories POST]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
