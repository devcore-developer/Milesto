"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

/**
 * Phase 4 made Clients and Finance real views — the only remaining
 * placeholder is Documents (Phase 6).
 */
export function PlaceholderView({ view }: { view: "documents" }) {
  const { t } = useI18n();
  if (view !== "documents") return null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg text-center">
        <CardContent className="flex flex-col items-center gap-4 p-10">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="size-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-900">{t(view)}</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {t("phaseBadge", { phase: 6 })}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-slate-500">{t("documentsDesc")}</p>
          <p className="text-xs text-slate-400">{t("roadmapNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}