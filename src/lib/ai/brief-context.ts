// Brief → analysis input (Phase A3/A5/A6) — server-only.
// Composes the AI-facing text from the brief version: working text + raw
// transcript + every attachment extraction. Originals are NEVER modified;
// the returned text is a read-only view for the model.
import { db } from "@/lib/db";

const MAX_BRIEF_CHARS = 60_000;

export async function loadBriefText(
  projectId: string,
  briefVersionId?: string | null,
): Promise<{ text: string; versionId: string } | null> {
  const brief = await db.projectBrief.findUnique({
    where: { projectId },
    include: {
      versions: {
        orderBy: { versionNo: "desc" },
        include: { attachments: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  const version = briefVersionId
    ? brief?.versions.find((v) => v.id === briefVersionId)
    : brief?.versions[0];
  if (!version) return null;

  const parts: string[] = [];
  if (version.content.trim()) parts.push(version.content.trim());
  if (version.transcript?.trim()) {
    parts.push(`[Voice transcript]\n${version.transcript.trim()}`);
  }
  for (const a of version.attachments) {
    if (a.extractedText?.trim()) {
      parts.push(`[Attached file: ${a.name}]\n${a.extractedText.trim()}`);
    }
    if (a.visionSummary?.trim()) {
      parts.push(`[Attached image: ${a.name} — analysis]\n${a.visionSummary.trim()}`);
    }
  }
  if (parts.length === 0) return null;
  return { text: parts.join("\n\n").slice(0, MAX_BRIEF_CHARS), versionId: version.id };
}