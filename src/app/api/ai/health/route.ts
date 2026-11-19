import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { aiStatus, getAIProvider } from "@/lib/ai/provider";
import { AICallError } from "@/lib/ai/types";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// GET /api/ai/health — secret-free provider status for the Settings panel.
// With no query params this NEVER contacts the provider (zero cost).
// ?probe=1 makes one minimal "reply OK" call to verify connectivity.
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const status = aiStatus();

  if (!req.nextUrl.searchParams.has("probe")) {
    return NextResponse.json(status);
  }

  if (!status.configured) {
    return NextResponse.json({
      ...status,
      probe: { ok: false, error: "AI_NOT_CONFIGURED" },
    });
  }
  if (!checkRateLimit(`ai-probe:${user.id}`, 10, 5 * 60_000)) {
    return NextResponse.json({
      ...status,
      probe: { ok: false, error: "AI_RATE_LIMITED" },
    });
  }

  const startedAt = Date.now();
  try {
    const provider = getAIProvider();
    await provider.chatText("Reply with the single word OK", {
      maxTokens: 16,
      temperature: 0,
    });
    return NextResponse.json({
      ...status,
      probe: { ok: true, latencyMs: Date.now() - startedAt },
    });
  } catch (e) {
    console.error("[ai health probe]", e);
    const code = e instanceof AICallError ? e.code : "AI_PROVIDER_ERROR";
    return NextResponse.json({
      ...status,
      probe: { ok: false, error: code },
    });
  }
}