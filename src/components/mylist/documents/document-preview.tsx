"use client";

import { fmtDocDate } from "@/lib/documents";
import { useI18n } from "@/lib/i18n";
import { docTypeLabelKey } from "@/components/mylist/documents/doc-type-badge";
import type { BusinessSettingsDTO, DocumentRecordDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * In-app document preview (Phase 6) — renders the saved sections in the
 * same premium blue design as the generated PDF (masthead, parties band,
 * styled sections) so the user can check the document before exporting.
 */
export function DocumentPreview({
  doc,
  settings,
  className,
}: {
  doc: DocumentRecordDTO;
  settings: BusinessSettingsDTO | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  const ar = doc.language === "ar";
  const dir = ar ? "rtl" : "ltr";

  const businessName = settings?.businessName?.trim() || "My List";
  const typeLabel = t(docTypeLabelKey(doc.type));

  return (
    <div
      dir={dir}
      lang={doc.language}
      className={cn(
        "mx-auto w-full max-w-[210mm] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        ar && "text-right",
        className,
      )}
    >
      {/* Masthead */}
      <div className="bg-gradient-to-br from-[#0b2b5b] via-[#1e40af] to-[#2563eb] px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-3">
            {settings?.logoData ? (
              <img
                src={settings.logoData}
                alt={businessName}
                className="size-12 shrink-0 rounded-xl bg-white object-cover p-1"
              />
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-xl font-extrabold text-blue-700">
                {businessName.trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold">{businessName}</p>
              {settings?.businessEmail && (
                <p className="truncate text-[10px] text-white/80" dir="ltr">
                  {settings.businessEmail}
                </p>
              )}
              {settings?.businessPhone && (
                <p className="truncate text-[10px] text-white/80" dir="ltr">
                  {settings.businessPhone}
                </p>
              )}
            </div>
          </div>
          <div className={cn("min-w-0", ar ? "text-left" : "text-right")}>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/85">
              {typeLabel}
            </p>
            <p className="mt-1 text-lg font-extrabold leading-snug">{doc.title}</p>
            <div className={cn("mt-2 flex flex-wrap gap-1.5", ar ? "justify-start" : "justify-end")}>
              <span className="rounded-full border border-white/35 bg-white/15 px-2.5 py-0.5 text-[10px] font-bold" dir="ltr">
                {doc.number}
              </span>
              <span className="rounded-full border border-white/35 bg-white/15 px-2.5 py-0.5 text-[10px] font-bold">
                {fmtDocDate(doc.issueDate, doc.language)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="grid gap-6 px-6 pb-2 pt-5 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-blue-700">
            {t("documents.colClient")}
          </p>
          {doc.client ? (
            <>
              <p className="text-sm font-bold text-slate-900">{doc.client.name}</p>
              {doc.client.company && (
                <p className="text-xs text-slate-500">{doc.client.company}</p>
              )}
              {doc.client.email && (
                <p className="text-xs text-slate-500" dir="ltr">
                  {doc.client.email}
                </p>
              )}
              {doc.client.phone && (
                <p className="text-xs text-slate-500" dir="ltr">
                  {doc.client.phone}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400">{t("invoices.noClient")}</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-blue-700">
            {t("documents.colProject")}
          </p>
          {doc.project ? (
            <p className="text-sm font-bold text-slate-900">{doc.project.name}</p>
          ) : (
            <p className="text-xs text-slate-400">—</p>
          )}
        </div>
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">{t("documents.colNumber")}</span>
            <span className="font-semibold text-slate-800" dir="ltr">
              {doc.number}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">{t("documents.issueDateLabel")}</span>
            <span className="font-semibold text-slate-800">
              {fmtDocDate(doc.issueDate, doc.language)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">{t("documents.languageLabel")}</span>
            <span className="font-semibold text-slate-800">
              {ar ? "العربية" : "English"}
            </span>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-5 px-6 py-5">
        {(doc.content?.sections ?? []).map((section) => (
          <section key={section.id}>
            <h3 className="mb-1.5 border-b border-blue-100 pb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-700">
              {section.heading}
            </h3>
            {section.kind === "text" &&
              (section.body.trim() ? (
                <p
                  className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700"
                  style={{ unicodeBidi: "plaintext" }}
                >
                  {section.body}
                </p>
              ) : (
                <p className="text-[13px] text-slate-300">—</p>
              ))}
            {section.kind === "list" &&
              (section.items.length ? (
                <ul className="space-y-1.5">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="relative ps-4 text-[13px] leading-relaxed text-slate-700"
                      style={{ unicodeBidi: "plaintext" }}
                    >
                      <span className="absolute start-0.5 top-[0.55em] size-1.5 rounded-[2px] bg-blue-700" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-slate-300">—</p>
              ))}
            {section.kind === "table" &&
              (section.columns.length && section.rows.length ? (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        {section.columns.map((col, i) => (
                          <th
                            key={i}
                            className="bg-blue-700 px-2.5 py-1.5 text-start text-[10px] font-bold uppercase tracking-wide text-white"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, r) => (
                        <tr key={r} className="even:bg-slate-50">
                          {section.columns.map((_, c) => (
                            <td
                              key={c}
                              className="border-t border-slate-200 px-2.5 py-1.5 text-slate-700"
                              style={{ unicodeBidi: "plaintext" }}
                            >
                              {row[c] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13px] text-slate-300">—</p>
              ))}
          </section>
        ))}
        {(doc.content?.sections ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">
            {ar ? "لا توجد أقسام بعد" : "No sections yet"}
          </p>
        )}
      </div>

      {/* Footer strip */}
      <div className="border-t border-slate-200 px-6 py-3 text-[11px] text-slate-400">
        <div className="flex items-center justify-between gap-4">
          <span className="truncate">
            {settings?.invoiceFooter?.trim() ||
              (ar ? "شكرًا لتعاملكم معنا!" : "Thank you for your business!")}
          </span>
          <span className="shrink-0">
            {ar ? "تم الإنشاء بواسطة قائمتي" : "Generated by My List"}
          </span>
        </div>
      </div>
    </div>
  );
}