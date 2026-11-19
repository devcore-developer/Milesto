import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { aiTranscribe, aiErrorStatus } from "@/lib/ai/client";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// POST /api/ai/transcribe — multipart audio → raw transcript.
// The audio itself is NEVER persisted (privacy + storage); only the
// transcript string returns to the client, which keeps it editable.
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "VALIDATION", issues: [{ path: "file", message: "Audio file is required" }] }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "AUDIO_TOO_LARGE" }, { status: 413 });
    }
    const mime = file.type || "audio/webm";
    if (!mime.startsWith("audio/") && mime !== "video/webm") {
      return NextResponse.json({ error: "AUDIO_TYPE" }, { status: 415 });
    }

    const filename = (form.get("filename") as string | null) ?? "recording.webm";
    const transcript = await aiTranscribe(user.id, file, filename);
    return NextResponse.json({ transcript });
  } catch (e) {
    const { status, code } = aiErrorStatus(e);
    console.error(`[ai transcribe] ${code}`);
    return NextResponse.json({ error: code }, { status });
  }
}