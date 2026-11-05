// Premium invoice HTML template (Phase 5) — rendered to a print-ready PDF
// by headless Chromium (see lib/pdf/render-pdf.ts).
//
// Design goals: blue-based visual identity, elegant typography, clean
// spacing, professional tables, clear financial hierarchy, correct Arabic
// RTL rendering and consistent branding across pages. The Inter + Noto Sans
// Arabic variable fonts are embedded as base64 when available so the PDF
// looks identical on every machine.
import fs from "node:fs";
import path from "node:path";
import {
  formatMoney,
  invoiceDisplayState,
  invoiceRemaining,
} from "@/lib/finance";
import type {
  BusinessSettingsDTO,
  InvoiceDTO,
  InvoiceStatus,
  PaymentMethod,
} from "@/lib/types";

export interface InvoiceHtmlInput {
  /** Invoice with `items` and `payments` populated */
  invoice: InvoiceDTO;
  settings: BusinessSettingsDTO;
  lang: "en" | "ar";
}

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

/** Locale-aware date — latin digits in both languages (ar-EG-u-nu-latn). */
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

const STATUS_LABELS: Record<InvoiceStatus, { en: string; ar: string }> = {
  DRAFT: { en: "Draft", ar: "مسودة" },
  SENT: { en: "Sent", ar: "مُرسلة" },
  PARTIALLY_PAID: { en: "Partially paid", ar: "مدفوعة جزئيًا" },
  PAID: { en: "Paid", ar: "مدفوعة" },
  OVERDUE: { en: "Overdue", ar: "متأخرة" },
  CANCELLED: { en: "Cancelled", ar: "ملغاة" },
};

const METHOD_LABELS: Record<PaymentMethod, { en: string; ar: string }> = {
  CASH: { en: "Cash", ar: "نقدًا" },
  BANK_TRANSFER: { en: "Bank transfer", ar: "تحويل بنكي" },
  CARD: { en: "Card", ar: "بطاقة" },
  OTHER: { en: "Other", ar: "أخرى" },
};

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

// ───────────────────────── template ─────────────────────────

export function buildInvoiceHtml({ invoice, settings, lang }: InvoiceHtmlInput): string {
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const L = (en: string, arabic: string) => (ar ? arabic : en);
  const money = (n: number) => formatMoney(n, lang, invoice.currency);

  const display = invoiceDisplayState({
    status: invoice.status,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    dueDate: invoice.dueDate,
  });
  const statusLabel = STATUS_LABELS[display][lang];
  const remaining = invoiceRemaining(invoice.total, invoice.amountPaid);

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

  const clientLines = [
    invoice.client?.company
      ? `<div class="party-sub">${esc(invoice.client.company)}</div>`
      : "",
    invoice.client?.address
      ? `<div class="party-sub">${esc(invoice.client.address)}</div>`
      : "",
    invoice.client?.email
      ? `<div class="party-sub" dir="ltr">${esc(invoice.client.email)}</div>`
      : "",
    invoice.client?.phone
      ? `<div class="party-sub" dir="ltr">${esc(invoice.client.phone)}</div>`
      : "",
  ].join("");

  const projectBlock = invoice.project
    ? `<div class="party-name">${esc(invoice.project.name)}</div>`
    : `<div class="party-sub">—</div>`;

  const taxLine = settings.taxInfo?.trim()
    ? `<div class="meta-row"><span class="meta-label">${esc(L("Tax ID", "الرقم الضريبي"))}</span><span class="meta-value">${esc(settings.taxInfo.trim())}</span></div>`
    : "";

  // ── Items table ──
  const items = invoice.items ?? [];
  const itemsTable = items.length
    ? `<table class="items">
        <thead>
          <tr>
            <th class="col-index">#</th>
            <th class="col-desc">${esc(L("Description", "الوصف"))}</th>
            <th class="col-num">${esc(L("Qty", "الكمية"))}</th>
            <th class="col-num">${esc(L("Unit price", "سعر الوحدة"))}</th>
            <th class="col-num">${esc(L("Amount", "المبلغ"))}</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item, i) => `<tr>
            <td class="col-index">${i + 1}</td>
            <td class="col-desc">${esc(item.description)}</td>
            <td class="col-num" dir="ltr">${item.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}</td>
            <td class="col-num" dir="ltr">${money(item.unitPrice)}</td>
            <td class="col-num strong" dir="ltr">${money(item.amount)}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
    : "";

  // ── Totals ──
  const discountRow =
    invoice.discountAmount > 0
      ? `<div class="total-row">
          <span>${esc(L("Discount", "الخصم"))}${invoice.discountType === "PERCENTAGE" ? ` (${invoice.discountValue}%)` : ""}</span>
          <span class="value neg" dir="ltr">− ${money(invoice.discountAmount)}</span>
        </div>`
      : "";
  const chargesRow =
    invoice.additionalCharges > 0
      ? `<div class="total-row">
          <span>${esc(L("Additional charges", "رسوم إضافية"))}${invoice.additionalNotes ? ` <span class="charges-note">(<bdi>${esc(invoice.additionalNotes)}</bdi>)</span>` : ""}</span>
          <span class="value pos" dir="ltr">+ ${money(invoice.additionalCharges)}</span>
        </div>`
      : "";

  const totalsBlock = `
    <div class="totals">
      ${discountRow}
      ${chargesRow}
      <div class="total-row grand">
        <span>${esc(L("Total", "الإجمالي"))}</span>
        <span class="value" dir="ltr">${money(invoice.total)}</span>
      </div>
      ${invoice.amountPaid > 0 ? `<div class="total-row"><span>${esc(L("Paid", "المدفوع"))}</span><span class="value pos" dir="ltr">− ${money(invoice.amountPaid)}</span></div>` : ""}
      <div class="balance ${remaining <= 0 ? "balance-paid" : ""}">
        <span>${esc(remaining <= 0 ? L("Paid in full", "سُددت بالكامل") : L("Balance due", "الرصيد المستحق"))}</span>
        <span class="value" dir="ltr">${remaining <= 0 ? "" : money(remaining)}</span>
      </div>
    </div>`;

  // ── Payment history ──
  const payments = invoice.payments ?? [];
  const paymentsBlock = payments.length
    ? `<div class="section">
        <div class="section-title">${esc(L("Payments", "الدفعات"))}</div>
        <table class="mini">
          <thead><tr>
            <th>${esc(L("Date", "التاريخ"))}</th>
            <th>${esc(L("Method", "طريقة الدفع"))}</th>
            <th>${esc(L("Notes", "ملاحظات"))}</th>
            <th class="col-num">${esc(L("Amount", "المبلغ"))}</th>
          </tr></thead>
          <tbody>
            ${payments
              .map(
                (p) => `<tr>
              <td class="whitespace">${esc(fmtDate(p.paidAt, lang))}</td>
              <td>${esc(p.method ? METHOD_LABELS[p.method][lang] : "—")}</td>
              <td class="muted">${esc(p.notes ?? "")}</td>
              <td class="col-num strong" dir="ltr">${money(p.amount)}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
    : "";

  // ── Notes & instructions ──
  const notesBlock =
    invoice.notes?.trim()
      ? `<div class="note-box"><div class="note-title">${esc(L("Notes", "ملاحظات"))}</div><div class="note-body">${esc(invoice.notes.trim())}</div></div>`
      : "";
  const termsBlock =
    invoice.terms?.trim()
      ? `<div class="note-box"><div class="note-title">${esc(L("Terms", "الشروط"))}</div><div class="note-body">${esc(invoice.terms.trim())}</div></div>`
      : "";
  const instructionsBlock = settings.paymentInstructions?.trim()
    ? `<div class="note-box accent"><div class="note-title">${esc(L("Payment instructions", "تعليمات الدفع"))}</div><div class="note-body">${esc(settings.paymentInstructions.trim())}</div></div>`
    : "";

  const footerText = settings.invoiceFooter?.trim()
    ? esc(settings.invoiceFooter.trim())
    : esc(L("Thank you for your business!", "شكرًا لتعاملكم معنا!"));

  const fonts = buildFontFaces();

  return `<!doctype html>
<html dir="${dir}" lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${esc(invoice.number)}</title>
<style>
  ${fonts}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'InterV', 'NotoSansArabicV', -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #0f172a; font-size: 11px; line-height: 1.55;
  }
  .page { max-width: 210mm; margin: 0 auto; }

  /* ── Masthead ── */
  .masthead {
    background: linear-gradient(130deg, #0b2b5b 0%, #1e40af 55%, #2563eb 100%);
    color: #ffffff; padding: 10mm 11mm 9mm;
  }
  .masthead-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
  .brand { display: flex; align-items: center; gap: 4mm; min-width: 0; }
  .logo {
    width: 15mm; height: 15mm; border-radius: 3.2mm; object-fit: cover;
    background: #ffffff; padding: 1.4mm; flex-shrink: 0;
  }
  .logo-fallback {
    display: flex; align-items: center; justify-content: center;
    color: #1d4ed8; font-size: 20px; font-weight: 800; padding: 0;
  }
  .business-name { font-size: 17px; font-weight: 800; letter-spacing: -0.01em; }
  .brand-side { text-align: ${ar ? "left" : "right"}; }
  .brand-side .muted-line { display: block; }
  .muted-line { font-size: 9px; color: rgba(255,255,255,0.82); }
  .doc-title { font-size: 27px; font-weight: 800; letter-spacing: 0.16em; margin-bottom: 2.2mm; }
  .doc-chips { display: flex; gap: 2.4mm; justify-content: ${ar ? "flex-start" : "flex-end"}; flex-wrap: wrap; }
  .chip {
    display: inline-block; padding: 1.3mm 3.4mm; border-radius: 999px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.02em;
    background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.35);
  }

  /* ── Parties & meta ── */
  .parties { display: flex; gap: 8mm; padding: 8mm 11mm 6.5mm; }
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

  /* ── Items table ── */
  .items { width: calc(100% - 22mm); margin: 0 11mm; border-collapse: collapse; }
  .items thead { display: table-header-group; }
  .items th {
    background: #1d4ed8; color: #ffffff; font-size: 8.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em;
    padding: 2.6mm 3mm; text-align: ${ar ? "right" : "left"};
  }
  .items th.col-num, .items td.col-num { text-align: ${ar ? "left" : "right"}; }
  .items td { padding: 2.6mm 3mm; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
  .items tbody tr:nth-child(even) td { background: #f8fafc; }
  .items tr { page-break-inside: avoid; }
  .col-index { width: 9mm; color: #94a3b8; }
  .col-desc { width: auto; unicode-bidi: plaintext; }
  .col-num { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 700; }
  .whitespace { white-space: nowrap; }
  .muted { color: #94a3b8; }

  /* ── Totals ── */
  .totals { margin: 6mm 11mm 0; margin-inline-start: auto; width: 82mm; font-size: 10.5px; }
  .total-row { display: flex; justify-content: space-between; gap: 4mm; padding: 1.6mm 0; color: #334155; }
  .total-row .value { font-variant-numeric: tabular-nums; font-weight: 600; color: #0f172a; }
  .total-row .neg { color: #b45309; }
  .total-row .pos { color: #047857; }
  .charges-note { color: #94a3b8; font-weight: 400; }
  .total-row.grand {
    border-top: 1.5px solid #cbd5e1; margin-top: 1.5mm; padding-top: 2.4mm;
    font-size: 12.5px; font-weight: 800; color: #0f172a;
  }
  .total-row.grand .value { color: #1d4ed8; }
  .balance {
    display: flex; justify-content: space-between; align-items: center; gap: 4mm;
    margin-top: 2.6mm; padding: 3mm 3.6mm; border-radius: 2.6mm;
    background: #0b2b5b; color: #ffffff; font-size: 11.5px; font-weight: 800;
  }
  .balance .value { font-variant-numeric: tabular-nums; }
  .balance-paid { background: #047857; }

  /* ── Sections ── */
  .section { margin: 8mm 11mm 0; }
  .section-title {
    font-size: 8.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
    color: #1d4ed8; margin-bottom: 2.2mm;
  }
  .mini { width: 100%; border-collapse: collapse; }
  .mini th {
    background: #eff6ff; color: #1e3a8a; font-size: 8.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em; padding: 2.2mm 3mm;
    text-align: ${ar ? "right" : "left"}; border-bottom: 1px solid #dbeafe;
  }
  .mini th.col-num, .mini td.col-num { text-align: ${ar ? "left" : "right"}; }
  .mini td { padding: 2.2mm 3mm; border-bottom: 1px solid #e2e8f0; font-size: 9.5px; unicode-bidi: plaintext; }
  .mini tr { page-break-inside: avoid; }

  /* ── Notes ── */
  .note-row { display: flex; gap: 6mm; margin: 8mm 11mm 0; }
  .note-box {
    flex: 1 1 0; min-width: 0; background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 2.6mm; padding: 3.2mm 4mm;
  }
  .note-box.accent { background: #eff6ff; border-color: #dbeafe; }
  .note-title {
    font-size: 8.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
    color: #1d4ed8; margin-bottom: 1.6mm;
  }
  .note-body { font-size: 9.5px; color: #334155; white-space: pre-line; unicode-bidi: plaintext; }

  /* ── Footer ── */
  .page-footer {
    margin: 10mm 11mm 0; padding: 4.5mm 0 0; border-top: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: center; gap: 6mm;
    font-size: 9px; color: #64748b;
  }
  .page-footer .generated { color: #94a3b8; white-space: nowrap; }

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
          <div class="doc-title">${esc(L("INVOICE", "فاتورة"))}</div>
          <div class="doc-chips">
            <span class="chip" dir="ltr">${esc(invoice.number)}</span>
            <span class="chip">${esc(statusLabel)}</span>
          </div>
        </div>
      </div>
    </header>

    <section class="parties">
      <div class="party">
        <div class="party-label">${esc(L("Bill to", "فاتورة إلى"))}</div>
        <div class="party-name">${esc(invoice.client?.name ?? L("No client", "بدون عميل"))}</div>
        ${clientLines}
      </div>
      <div class="party">
        <div class="party-label">${esc(L("Project", "المشروع"))}</div>
        ${projectBlock}
      </div>
      <div class="party">
        <div class="party-label">${esc(L("Details", "التفاصيل"))}</div>
        <div class="meta-row"><span class="meta-label">${esc(L("Issue date", "تاريخ الإصدار"))}</span><span class="meta-value">${esc(fmtDate(invoice.issueDate, lang))}</span></div>
        <div class="meta-row"><span class="meta-label">${esc(L("Due date", "تاريخ الاستحقاق"))}</span><span class="meta-value">${esc(invoice.dueDate ? fmtDate(invoice.dueDate, lang) : "—")}</span></div>
        ${taxLine}
      </div>
    </section>

    ${itemsTable}
    ${totalsBlock}
    ${paymentsBlock}

    <div class="note-row">
      ${notesBlock}
      ${termsBlock}
      ${instructionsBlock}
    </div>

    <footer class="page-footer">
      <span>${footerText}</span>
      <span class="generated">${esc(L("Generated by My List", "تم الإنشاء بواسطة قائمتي"))}</span>
    </footer>

  </div>
</body>
</html>`;
}