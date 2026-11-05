import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSessionUser,
  hashPassword,
  unauthorized,
  verifyPassword,
} from "@/lib/auth";
import {
  changePasswordSchema,
  validationError,
  zodIssues,
} from "@/lib/validation";

export async function PUT(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return unauthorized();

  try {
    const parsed = changePasswordSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const user = await db.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) return unauthorized();

    const valid = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/password]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
