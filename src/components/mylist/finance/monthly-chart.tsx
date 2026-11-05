"use client";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatMoney, type MonthPoint } from "@/lib/finance";

/**
 * Lightweight grouped bar chart (invoiced vs collected) for the last N
 * months. Pure CSS — no chart library dependency. Bars scale against the
 * largest value in the series; exact amounts are available as tooltips
 * and in the monthly table below the chart.
 */
export function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const { t, lang } = useI18n();

  const max = Math.max(1, ...data.map((d) => Math.max(d.invoiced, d.collected)));

  return (
    <div>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="size-2.5 rounded-sm bg-blue-600" />
          {t("finance.legendInvoiced")}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="size-2.5 rounded-sm bg-emerald-500" />
          {t("finance.legendCollected")}
        </span>
      </div>

      <div className="flex h-44 items-end gap-2 sm:gap-4" dir="ltr">
        {data.map((point) => {
          const invoicedPct = Math.round((point.invoiced / max) * 100);
          const collectedPct = Math.round((point.collected / max) * 100);
          return (
            <div
              key={point.key}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              title={`${point.label} — ${t("finance.legendInvoiced")}: ${formatMoney(point.invoiced, lang)} · ${t("finance.legendCollected")}: ${formatMoney(point.collected, lang)}`}
            >
              <div className="flex h-full w-full items-end justify-center gap-1">
                <div
                  className={cn(
                    "w-3 max-w-[18px] rounded-t transition-all sm:w-4",
                    point.invoiced > 0 ? "bg-blue-600" : "bg-slate-100",
                  )}
                  style={{ height: `${Math.max(point.invoiced > 0 ? 4 : 2, invoicedPct)}%` }}
                />
                <div
                  className={cn(
                    "w-3 max-w-[18px] rounded-t transition-all sm:w-4",
                    point.collected > 0 ? "bg-emerald-500" : "bg-slate-100",
                  )}
                  style={{ height: `${Math.max(point.collected > 0 ? 4 : 2, collectedPct)}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-400 sm:text-xs">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}