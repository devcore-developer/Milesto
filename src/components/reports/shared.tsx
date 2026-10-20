"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyMinor } from "@/components/timeline/shared";
import type { CurrencyTotal, ReportTab } from "@/types/reports";

export const CHART_COLORS = {
  primary: "#6366f1",
  emerald: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  slate: "#94a3b8",
  rose: "#f43f5e",
  indigo: "#6366f1",
  teal: "#14b8a6",
} as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EGP: "ج.م", USD: "$", EUR: "€", GBP: "£", SAR: "ر.س", AED: "د.إ",
};

// تنسيق مختصر للمحاور (بدون كسور) — العرض الدقيق بيتعمل في الـ tooltips
export function formatMoneyCompact(currency: string, minor: number): string {
  const units = Math.trunc(Math.abs(minor) / 100);
  return `${minor < 0 ? "-" : ""}${units.toLocaleString("en-US")} ${CURRENCY_SYMBOLS[currency] ?? currency}`;
}

export function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export const TAB_LABELS: Record<ReportTab, string> = {
  overview: "نظرة عامة",
  projects: "أداء المشاريع",
  productivity: "الإنتاجية",
  quality: "الجودة",
  financial: "المالية",
  builder: "منشئ التقارير",
};

export function KpiCard({
  label, value, hint, tone, onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`text-2xl font-bold tabular-nums ${tone ?? ""}`}>{value}</span>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      {hint ? <p className="text-[10px] text-muted-foreground/80">{hint}</p> : null}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border bg-card p-3 text-right transition hover:border-foreground/30 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </button>
    );
  }
  return <div className="rounded-lg border bg-card p-3">{content}</div>;
}

export function SectionCard({
  title, subtitle, actions, children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CurrencyLines({ totals }: { totals: CurrencyTotal[] }) {
  if (totals.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {totals.map((t) => (
        <div key={t.currency} className="text-sm font-semibold tabular-nums">
          {formatMoneyMinor(t.currency, t.minor)}
        </div>
      ))}
    </div>
  );
}

export function severityDotClass(severity: string): string {
  if (severity === "high") return "bg-red-500";
  if (severity === "medium") return "bg-amber-500";
  return "bg-slate-400";
}