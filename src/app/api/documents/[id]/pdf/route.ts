import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import {
  getBusinessSettings,
  serializeBusinessSettings,
} from "@/lib/business-settings";
import { buildDocumentHtml, documentFooterTemplate } from "@/lib/pdf/document-html";
import { renderPdf } from "@/lib/pdf/render-pdf";
import { serializeDocumentRecord } from "@/lib/serializers";

// PDF generation needs the Node runtime (puppeteer launches Chromium).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/documents/:id/pdf — premium, print-ready document PDF.
// The output language is the document's own `language` field (edited in the
// app); Arabic documents render fully RTL.
// Query params:
//   download=1  force a file download instead of inline preview
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const document = await db.documentRecord.findFirst({
      where: { id, userId: user.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        project: { select: { id: true, name: true } },
      },
    });
    if (!document) {
      return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    const settingsRow = await getBusinessSettings(user.id);
    const dto = serializeDocumentRecord(document);

    const html = buildDocumentHtml({
      doc: dto,
      settings: serializeBusinessSettings(settingsRow),
    });
    const pdf = await renderPdf(html, {
      displayHeaderFooter: true,
      footerTemplate: documentFooterTemplate(
        serializeBusinessSettings(settingsRow),
        dto,
      ),
      margins: { top: "10mm", right: "10mm", bottom: "16mm", left: "10mm" },
    });

    const safeNumber = document.number.replace(/[^\w.-]+/g, "_");
    const disposition =
      req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${safeNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[document PDF]", e);
    return NextResponse.json({ error: "PDF_GENERATION_FAILED" }, { status: 500 });
  }
}