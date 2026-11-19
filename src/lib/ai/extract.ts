// Attachment processing (Phase A2) — server-only.
//
// Extracts usable content from brief attachments BEFORE anything is stored:
// - TXT / MD      → read as UTF-8 (≤ 2 MB)
// - PDF           → unpdf text extraction (≤ 10 MB, no OCR — scanned PDFs
//                   surface a clear "no readable text" state, never silence)
// - DOCX          → mammoth raw text (≤ 10 MB)
// - PNG/JPG/JPEG  → stored as-is + vision summary from the configured
//                   provider (≤ 4 MB; UNSUPPORTED when provider lacks vision)
//
// MIME sniffing is done from the data URL's magic bytes (declared mime is
// only a hint), so renamed files cannot sneak past the caps.
import { aiVision } from "@/lib/ai/client";
import { AICallError } from "@/lib/ai/types";

export type AttachmentStatus =
  | "READY"
  | "EXTRACTED"
  | "ANALYZED"
  | "UNSUPPORTED"
  | "FAILED";

export interface ProcessResult {
  extractedText: string | null;
  visionSummary: string | null;
  processingStatus: AttachmentStatus;
}

// Byte caps (the raw binary size, not the base64 length).
const CAP_TEXT = 2 * 1024 * 1024;
const CAP_DOC = 10 * 1024 * 1024;
const CAP_IMAGE = 4 * 1024 * 1024;

const IMAGE_MIMES = ["image/png", "image/jpeg"];
const DOC_MIMES = ["application/pdf"];
const DOCX_MIMES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const TEXT_MIMES = ["text/plain", "text/markdown"];

/** Kind derived from sniffed magic bytes — "unknown" files are rejected. */
export type AttachmentKind = "text" | "pdf" | "docx" | "image" | "unknown";

export function capForKind(kind: AttachmentKind): number {
  if (kind === "text") return CAP_TEXT;
  if (kind === "pdf" || kind === "docx") return CAP_DOC;
  if (kind === "image") return CAP_IMAGE;
  return 0;
}

/** Sniff the real file type from the leading bytes of a data URL. */
export function sniffKind(dataUrl: string): AttachmentKind {
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma === -1 ? 100 : comma).trim();
  let b64 = dataUrl.slice(comma + 1, comma + 64);
  const isBase64 = head.endsWith(";base64") || b64.length > 0;
  if (!isBase64) return "unknown";
  // Decode just the first bytes (base64 → binary prefix).
  try {
    b64 = b64.replace(/[^A-Za-z0-9+/=]/g, "");
    const bytes = Buffer.from(b64.slice(0, 32), "base64");
    const ascii = bytes.toString("latin1");
    if (ascii.startsWith("%PDF")) return "pdf";
    if (ascii.startsWith("PK")) return "docx"; // OOXML zip container
    if (ascii.startsWith("\u0089PNG")) return "image";
    if (ascii.startsWith("\u00FF\u00D8")) return "image"; // JPEG SOI
    if (bytes.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127))) {
      return "text";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  const b64 = dataUrl
    .slice(comma + 1)
    .replace(/[^A-Za-z0-9+/=]/g, "");
  return Buffer.from(b64, "base64");
}

/** Wrap a Buffer back into a base64 data URL (image path re-uses it). */
function bufferToDataUrl(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const VISION_PROMPT =
  "You are helping analyse a file attached to a project brief. Describe in " +
  "at most 120 words everything this image contains that is relevant to a " +
  "project brief: readable text (transcribe it), tables, diagrams, and " +
  "requirements. Do not invent content that is not visible. Answer in the " +
  "same language the image uses.";

/** Process one attachment — never throws: failures become `FAILED`. */
export async function processAttachment(
  userId: string,
  input: { name: string; mime: string; dataUrl: string },
): Promise<ProcessResult> {
  const kind = sniffKind(input.dataUrl);
  try {
    if (kind === "unknown") {
      return {
        extractedText: null,
        visionSummary: null,
        processingStatus: "UNSUPPORTED",
      };
    }
    const buf = dataUrlToBuffer(input.dataUrl);
    const cap = capForKind(kind);
    if (buf.length > cap) {
      return {
        extractedText: null,
        visionSummary: null,
        processingStatus: "UNSUPPORTED",
      };
    }

    if (kind === "text") {
      const text = buf.toString("utf8").slice(0, 400_000);
      return {
        extractedText: text,
        visionSummary: null,
        processingStatus: "EXTRACTED",
      };
    }

    if (kind === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const clean = text.replace(/\s+\n/g, "\n").trim();
      // Scanned PDFs produce empty/near-empty text — keep a visible state.
      return {
        extractedText: clean.length > 0 ? clean.slice(0, 400_000) : null,
        visionSummary: null,
        processingStatus: "EXTRACTED",
      };
    }

    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return {
        extractedText: value.trim().slice(0, 400_000) || null,
        visionSummary: null,
        processingStatus: "EXTRACTED",
      };
    }

    // Image — stored as-is; vision summary only when the provider can.
    const summary = await aiVision(
      userId,
      bufferToDataUrl(buf, IMAGE_MIMES.includes(input.mime) ? input.mime : "image/png"),
      VISION_PROMPT,
    );
    return {
      extractedText: null,
      visionSummary: summary.trim().slice(0, 8_000),
      processingStatus: "ANALYZED",
    };
  } catch (e) {
    // Provider-level "no vision" → a normal, explainable state.
    if (
      e instanceof AICallError &&
      (e.code === "AI_NOT_CONFIGURED" || e.code === "AI_BAD_CONFIG")
    ) {
      return {
        extractedText: null,
        visionSummary: null,
        processingStatus: "UNSUPPORTED",
      };
    }
    console.error("[brief] attachment processing failed", e);
    return {
      extractedText: null,
      visionSummary: null,
      processingStatus: "FAILED",
    };
  }
}

/** Allowed upload types for the client-side accept filter. */
export const ACCEPTED_MIMES = [
  ...TEXT_MIMES,
  ...DOC_MIMES,
  ...DOCX_MIMES,
  ...IMAGE_MIMES,
];