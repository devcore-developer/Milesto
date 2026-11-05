"use client";

import {
  ClipboardCheck,
  FileSignature,
  FileText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { DocumentType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tailwind tone per document type — blue-based My List identity. */
export const DOC_TYPE_TONES: Record<DocumentType, string> = {
  SCOPE_OF_WORK: "border-blue-200 bg-blue-50 text-blue-700",
  COMPLETION_REPORT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PROGRESS_REPORT: "border-amber-200 bg-amber-50 text-amber-700",
  CUSTOM_REPORT: "border-slate-200 bg-slate-100 text-slate-600",
};

const TYPE_KEY: Record<DocumentType, TranslationKey> = {
  SCOPE_OF_WORK: "documents.typeSow",
  COMPLETION_REPORT: "documents.typeCompletion",
  PROGRESS_REPORT: "documents.typeProgress",
  CUSTOM_REPORT: "documents.typeCustom",
};

export function docTypeLabelKey(type: DocumentType): TranslationKey {
  return TYPE_KEY[type];
}

export function docTypeIcon(type: DocumentType): LucideIcon {
  switch (type) {
    case "SCOPE_OF_WORK":
      return FileSignature;
    case "COMPLETION_REPORT":
      return ClipboardCheck;
    case "PROGRESS_REPORT":
      return TrendingUp;
    default:
      return FileText;
  }
}

export function DocTypeBadge({ type }: { type: DocumentType }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        DOC_TYPE_TONES[type],
      )}
    >
      {t(docTypeLabelKey(type))}
    </span>
  );
}