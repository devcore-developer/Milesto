import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { profileSchema, validationError, zodIssues } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const updated = await db.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name },
    });

    return NextResponse.json({
      user: { id: updated.id, email: updated.email, name: updated.name },
    });
  } catch (e) {
    console.error("[auth/me PATCH]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
