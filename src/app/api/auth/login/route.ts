import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSessionToken,
  setSessionCookie,
  toAuthUser,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { loginSchema, validationError, zodIssues } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (!checkRateLimit(`login:${ip}`, 10, 5 * 60_000)) {
      return NextResponse.json(
        { error: "TOO_MANY_ATTEMPTS" },
        { status: 429 },
      );
    }

    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(zodIssues(parsed.error));

    const { email, password } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const token = await createSessionToken(user.id, user.email);
    const res = NextResponse.json({ user: toAuthUser(user) });
    setSessionCookie(res, token);
    return res;
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
