import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
  toAuthUser,
} from "@/lib/auth";
import { setupSchema, validationError, zodIssues } from "@/lib/validation";

/** One-time owner registration. Locked forever once a user exists. */
export async function POST(req: NextRequest) {
  try {
    const existing = await db.user.count();
    if (existing > 0) {
      return NextResponse.json({ error: "SETUP_ALREADY_COMPLETED" }, { status: 403 });
    }

    const parsed = setupSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const { name, email, password } = parsed.data;
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { name, email, passwordHash },
    });

    const token = await createSessionToken(user.id, user.email);
    const res = NextResponse.json({ user: toAuthUser(user) });
    setSessionCookie(res, token);
    return res;
  } catch (e) {
    console.error("[auth/setup]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
