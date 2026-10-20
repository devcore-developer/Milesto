"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatMinorAmount } from "@/lib/money";
import type { CurrencyAmount } from "@/types/finance";

interface FinanceKpiCardProps {
  label: string;
  /** One line per currency — currencies are never merged. */
  amounts?: CurrencyAmount[];
  /** Raw display value (e.g. "EGP 62.5% · USD 41.0%") when the KPI is not an amount. */
  value?: string;
  hint?: string;
  tone?: "default" | "danger" | "success";
  footer?: ReactNode;
}

export function FinanceKpiCard({
  label,
  amounts,
  value,
  hint,
  tone = "default",
  footer,
}: FinanceKpiCardProps) {
  const lines = amounts && amounts.length > 0
    ? amounts.map((amount) => formatMinorAmount(amount.minor, amount.currency))
    : value
      ? [value]
      : [];

  return (
    <Card
      className={cn(
        "border-border/60",
        tone === "danger" && "border-destructive/40 bg-destructive/5",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-2 space-y-0.5">
          {lines.length > 0 ? (
            lines.map((line) => (
              <p
                key={line}
                className={cn(
                  "text-lg font-semibold leading-tight tabular-nums",
                  tone === "danger" && "text-destructive",
                )}
              >
                {line}
              </p>
            ))
          ) : (
            <p className="text-lg font-semibold leading-tight text-muted-foreground">—</p>
          )}
        </div>
        {hint ? <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
        {footer}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from "@/components/ui/card";