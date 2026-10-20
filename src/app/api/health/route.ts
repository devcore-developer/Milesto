import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Milesto — Phase 10 — health endpoint for deployment platforms and uptime
 * monitors. Stateless by design: it never touches application data, so it
 * is safe to expose publicly.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    app: "milesto",
    time: new Date().toISOString(),
  });
}