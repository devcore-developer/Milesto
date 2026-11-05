import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userCount = await db.user.count();
    const sessionUser = await getSessionUser(req);
    return NextResponse.json({
      needsSetup: userCount === 0,
      authed: !!sessionUser,
      user: sessionUser,
    });
  } catch (e) {
    console.error("[auth/state]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
