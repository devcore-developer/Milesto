import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { serializeBriefAttachment } from "@/lib/serializers";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

async function loadOwnedAttachment(userId: string, attachmentId: string) {
  return db.briefAttachment.findFirst({
    where: {
      id: attachmentId,
      version: { brief: { project: { userId } } },
    },
  });
}

// GET /api/projects/:id/brief/attachments/:attachmentId — metadata, or the
// full original file (data URL) with ?download=1 for "open original".
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { attachmentId } = await params;
    const attachment = await loadOwnedAttachment(user.id, attachmentId);
    if (!attachment) {
      return NextResponse.json({ error: "ATTACHMENT_NOT_FOUND" }, { status: 404 });
    }

    if (req.nextUrl.searchParams.get("download") === "1") {
      return NextResponse.json({ attachment });
    }
    return NextResponse.json({
      attachment: serializeBriefAttachment(attachment),
    });
  } catch (e) {
    console.error("[brief attachment GET]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/projects/:id/brief/attachments/:attachmentId
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { attachmentId } = await params;
    const attachment = await loadOwnedAttachment(user.id, attachmentId);
    if (!attachment) {
      return NextResponse.json({ error: "ATTACHMENT_NOT_FOUND" }, { status: 404 });
    }
    await db.briefAttachment.delete({ where: { id: attachment.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[brief attachment DELETE]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}