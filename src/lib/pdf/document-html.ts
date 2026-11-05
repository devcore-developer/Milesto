// Premium document HTML template (Phase 6) — Scope of Work, Work Completion
// Report, Project Progress Report and Custom Reports, rendered to a
// print-ready PDF by headless Chromium (see lib/pdf/render-pdf.ts).
//
// The design system matches the Phase 5 invoice template (blue identity,
// Inter + Noto Sans Arabic embedded as base64, clean tables, full RTL
// support) adapted to multi-page documents: comfortable page margins, a
// rounded masthead card, repeating table headers and a running footer with
// page numbers supplied through Chromium's header/footer templates.
import fs from "node:fs";
import path from "node:path";
import type { BusinessSettingsDTO, DocumentRecordDTO } from "@/lib/types";

// ───────────────────────── helpers ─────────────────────────

function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Multi-line text → HTML (escaped, newlines preserved). */
function escMultiline(value: string | null | undefined): string {
  return esc(value).replace(/\r?\n/g, "<br/>");
}

const DOC_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  SCOPE_OF_WORK: { en: "Scope of Work", ar: "نطاق العمل" },
  COMPLETION_REPORT: { en: "Work Completion Report", ar: "تقرير إتمام العمل" },
  PROGRESS_REPORT: { en: "Project Progress Report", ar: "تقرير تقدم المشروع" },
  CUSTOM_REPORT: { en: "Project Report", ar: "تقرير مشروع" },
};

function fmtDate(iso: string | null | undefined, lang: "en" | "ar"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

// ───────────────────────── fonts ─────────────────────────

function readFontBase64(packagePath: string): string | null {
  try {
    const full = path.join(process.cwd(), "node_modules", packagePath);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full).toString("base64");
  } catch {
    return null;
  }
}

/** @font-face rules with the variable fonts inlined as base64 data URLs. */
function buildFontFaces(): string {
  const inter = readFontBase64(
    "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  );
  const arabic = readFontBase64(
    "@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2",
  );
  let css = "";
  if (inter) {
    css += `@font-face{font-family:'InterV';src:url(data:font/woff2;base64,${inter}) format('woff2-variations');font-weight:100 900;font-style:normal;font-display:block;}`;
  }
  if (arabic) {
    css += `@font-face{font-family:'NotoSansArabicV';src:url(data:font/woff2;base64,${arabic}) format('woff2-variations');font-weight:100 900;font-style:normal;font-display:block;}`;
  }
  return css;
}

// ───────────────────────── running footer ─────────────────────────

/**
 * Chromium footer template shown in the bottom margin of EVERY page:
 * business name + document number on one side, "Page X of Y" on the other.
 * (Fonts here use the system stack — the footer context cannot load the
 * embedded document fonts.)
 */
export function documentFooterTemplate(
  settings: BusinessSettingsDTO,
  doc: DocumentRecordDTO,
): string {
  const ar = doc.language === "ar";
  const brand = esc(settings.businessName?.trim() || "My List");
  const number = esc(doc.number);
  const page = ar
    ? `<span>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>`
    : `<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>`;
  const text = ar
    ? `${page}<span class="f-sep">·</span><span>${brand} — ${number}</span>`
    : `<span>${brand} — ${number}</span><span class="f-sep">·</span>${page}`;
  return `<div style="width:100%;padding:0 11mm;display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#64748b;direction:${ar ? "rtl" : "ltr"};font-family:Tahoma,Arial,sans-serif;">
    <span style="display:flex;align-items:center;gap:2mm;">${text}</span>
  </div>`;
}

// ───────────────────────── sections ─────────────────────────

function renderSection(section: DocumentRecordDTO["content"]["sections"][number], lang: "en" | "ar"): string {
  const dash = `<div class="sec-empty">—</div>`;

  if (section.kind === "text") {
    return `<section class="sec">
      <h2 class="sec-title">${esc(section.heading)}</h2>
      ${section.body.trim() ? `<div class="sec-body">${escMultiline(section.body)}</div>` : dash}
    </section>`;
  }

  if (section.kind === "list") {
    return `<section class="sec">
      <h2 class="sec-title">${esc(section.heading)}</h2>
      ${
        section.items.length
          ? `<ul class="doc-list">${section.items
              .map((item) => `<li>${esc(item)}</li>`)
              .join("")}</ul>`
          : dash
      }
    </section>`;
  }

  // table — zip cells with columns so a short row never breaks layout
  const head = section.columns
    .map((c) => `<th>${esc(c)}</th>`)
    .join("");
  const body = section.rows
    .map(
      (row) =>
        `<tr>${section.columns
          .map((_, i) => `<td>${esc(row[i] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<section class="sec">
    <h2 class="sec-title">${esc(section.heading)}</h2>
    ${
      section.columns.length && section.rows.length
        ? `<table class="doc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
        : dash
    }
  </section>`;
}

// ───────────────────────── template ─────────────────────────

export function buildDocumentHtml({
  doc,
  settings,
}: {
  doc: DocumentRecordDTO;
  settings: BusinessSettingsDTO;
}): string {
  const lang = doc.language;
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const L = (en: string, arabic: string) => (ar ? arabic : en);

  const businessName = settings.businessName?.trim() || "My List";
  const logo = settings.logoData
    ? `<img class="logo" src="${esc(settings.logoData)}" alt="${esc(businessName)}" />`
    : `<div class="logo logo-fallback">${esc(businessName.trim().slice(0, 1).toUpperCase())}</div>`;

  const contactLines = [
    settings.businessEmail,
    settings.businessPhone,
    settings.businessAddress,
  ]
    .filter((v): v is string => !!v && !!v.trim())
    .map((v) => `<span class="muted-line" dir="ltr">${esc(v)}</span>`)
    .join("");

  const typeLabel = DOC_TYPE_LABELS[doc.type]?.[lang] ?? DOC_TYPE_LABELS.CUSTOM_REPORT[lang];

  const clientLines = doc.client
    ? [
        doc.client.company
          ? `<div class="party-sub">${esc(doc.client.company)}</div>`
          : "",
        doc.client.address
          ? `<div class="party-sub">${esc(doc.client.address)}</div>`
          : "",
        doc.client.email
          ? `<div class="party-sub" dir="ltr">${esc(doc.client.email)}</div>`
          : "",
        doc.client.phone
          ? `<div class="party-sub" dir="ltr">${esc(doc.client.phone)}</div>`
          : "",
      ].join("")
    : "";

  const sectionsHtml = (doc.content?.sections ?? [])
    .map((section) => renderSection(section, lang))
    .join("");

  const fonts = buildFontFaces();

  return `<!doctype html>
<html dir="${dir}" lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${esc(doc.number)}</title>
<style>
  ${fonts}
  /* Page margins live HERE (the CSS @page rule wins over the Chromium
     margin option) - they must stay in sync with the route's footer
     template padding and leave room for the running page-number footer. */
  @page { size: A4; margin: 10mm 10mm 16mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'InterV', 'NotoSansArabicV', -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #0f172a; font-size: 11px; line-height: 1.6;
  }

  /* ── Masthead card ── */
  .masthead {
    background: linear-gradient(130deg, #0b2b5b 0%, #1e40af 55%, #2563eb 100%);
    color: #ffffff; border-radius: 4mm; padding: 8mm 9mm;
  }
  .masthead-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
  .brand { display: flex; align-items: center; gap: 4mm; min-width: 0; }
  .logo {
    width: 14mm; height: 14mm; border-radius: 3mm; object-fit: cover;
    background: #ffffff; padding: 1.3mm; flex-shrink: 0;
  }
  .logo-fallback {
    display: flex; align-items: center; justify-content: center;
    color: #1d4ed8; font-size: 19px; font-weight: 800; padding: 0;
  }
  .business-name { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
  .brand-side { text-align: ${ar ? "left" : "right"}; max-width: 46%; }
  .muted-line { font-size: 9px; color: rgba(255,255,255,0.82); display: block; }
  .doc-eyebrow {
    font-size: 8.5px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(255,255,255,0.85); margin-bottom: 1.6mm;
  }
  .doc-title { font-size: 19px; font-weight: 800; line-height: 1.3; margin-bottom: 2.2mm; }
  .doc-chips { display: flex; gap: 2.4mm; justify-content: ${ar ? "flex-start" : "flex-end"}; flex-wrap: wrap; }
  .chip {
    display: inline-block; padding: 1.2mm 3.2mm; border-radius: 999px;
    font-size: 8.5px; font-weight: 700; letter-spacing: 0.02em;
    background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.35);
  }

  /* ── Parties band ── */
  .parties { display: flex; gap: 8mm; padding: 7mm 1mm 2mm; }
  .party { flex: 1 1 0; min-width: 0; }
  .party-label {
    font-size: 8px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
    color: #1d4ed8; margin-bottom: 1.8mm;
  }
  .party-name { font-size: 12.5px; font-weight: 700; color: #0f172a; }
  .party-sub { font-size: 9.5px; color: #475569; word-break: break-word; unicode-bidi: plaintext; }
  .meta-row { display: flex; justify-content: space-between; gap: 4mm; font-size: 9.5px; }
  .meta-label { color: #64748b; }
  .meta-value { font-weight: 600; color: #0f172a; text-align: ${ar ? "left" : "right"}; }

  /* ── Sections ── */
  .sec { margin: 7mm 0 0; }
  .sec-title {
    font-size: 8.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
    color: #1d4ed8; margin: 0 0 2.4mm; padding-bottom: 1.4mm; border-bottom: 1px solid #dbeafe;
    break-after: avoid; page-break-after: avoid;
  }
  .sec-body { font-size: 10.5px; color: #1e293b; unicode-bidi: plaintext; }
  .sec-empty { color: #cbd5e1; font-size: 10px; }

  .doc-list { list-style: none; margin: 0; padding: 0; }
  .doc-list li {
    position: relative; padding-inline-start: 6mm; margin-bottom: 1.8mm;
    font-size: 10.5px; color: #1e293b; unicode-bidi: plaintext;
    break-inside: avoid; page-break-inside: avoid;
  }
  .doc-list li::before {
    content: ""; position: absolute; inset-inline-start: 1mm; top: 2.1mm;
    width: 2.2mm; height: 2.2mm; border-radius: 0.8mm; background: #1d4ed8;
  }

  .doc-table { width: 100%; border-collapse: collapse; margin-top: 1mm; }
  .doc-table thead { display: table-header-group; }
  .doc-table th {
    background: #1d4ed8; color: #ffffff; font-size: 8.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em; padding: 2.4mm 3mm;
    text-align: ${ar ? "right" : "left"};
  }
  .doc-table td {
    padding: 2.4mm 3mm; border-bottom: 1px solid #e2e8f0; font-size: 10px;
    unicode-bidi: plaintext; vertical-align: top;
  }
  .doc-table tbody tr:nth-child(even) td { background: #f8fafc; }
  .doc-table tr { break-inside: avoid; page-break-inside: avoid; }

  ${ar ? "body { font-family: 'NotoSansArabicV', 'InterV', 'Segoe UI', Tahoma, Arial, sans-serif; }" : ""}
</style>
</head>
<body>
  <div class="page">

    <header class="masthead">
      <div class="masthead-row">
        <div class="brand">
          ${logo}
          <div>
            <div class="business-name">${esc(businessName)}</div>
            ${contactLines}
          </div>
        </div>
        <div class="brand-side">
          <div class="doc-eyebrow">${esc(typeLabel)}</div>
          <div class="doc-title">${esc(doc.title)}</div>
          <div class="doc-chips">
            <span class="chip" dir="ltr">${esc(doc.number)}</span>
            <span class="chip">${esc(fmtDate(doc.issueDate, lang))}</span>
          </div>
        </div>
      </div>
    </header>

    <section class="parties">
      <div class="party">
        <div class="party-label">${esc(L("Client", "العميل"))}</div>
        ${
          doc.client
            ? `<div class="party-name">${esc(doc.client.name)}</div>${clientLines}`
            : `<div class="party-sub">${esc(L("No client", "بدون عميل"))}</div>`
        }
      </div>
      <div class="party">
        <div class="party-label">${esc(L("Project", "المشروع"))}</div>
        ${
          doc.project
            ? `<div class="party-name">${esc(doc.project.name)}</div>`
            : `<div class="party-sub">—</div>`
        }
      </div>
      <div class="party">
        <div class="party-label">${esc(L("Details", "التفاصيل"))}</div>
        <div class="meta-row"><span class="meta-label">${esc(L("Document no.", "رقم المستند"))}</span><span class="meta-value" dir="ltr">${esc(doc.number)}</span></div>
        <div class="meta-row"><span class="meta-label">${esc(L("Issue date", "تاريخ الإصدار"))}</span><span class="meta-value">${esc(fmtDate(doc.issueDate, lang))}</span></div>
        <div class="meta-row"><span class="meta-label">${esc(L("Language", "اللغة"))}</span><span class="meta-value">${esc(ar ? "العربية" : "English")}</span></div>
      </div>
    </section>

    ${sectionsHtml}

  </div>
</body>
</html>`;
}