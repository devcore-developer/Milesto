"use client";

/**
 * Milesto — Phase 7 (Finance & Payments)
 * Small shared UI primitives for the finance module (cards, form fields,
 * empty states). Built only on the project's existing design tokens and the
 * Tooltip primitive — no new dependencies.
 */

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const FIELD_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const TEXTAREA_CLASS =
  "min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground">{label}</label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Label with a small "?" marker that reveals the metric definition on hover. */
export function InfoLabel({ label, definition }: { label: string; definition: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted-foreground"
            aria-label={`Definition: ${label}`}
          >
            ?
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72 text-xs leading-5">
          {definition}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export type StatTone = "default" | "success" | "warn" | "danger";

const TONE_BORDER: Record<StatTone, string> = {
  default: "border-l-border",
  success: "border-l-emerald-500",
  warn: "border-l-amber-500",
  danger: "border-l-rose-500",
};

/** KPI / summary block: definition tooltip, one formatted line per currency. */
export function StatBlock({
  label,
  definition,
  lines,
  sub,
  tone = "default",
}: {
  label: string;
  definition: string;
  lines: string[];
  sub?: string;
  tone?: StatTone;
}) {
  const visible = lines.length > 0 ? lines : ["—"];
  return (
    <div className={`rounded-lg border border-border border-l-4 bg-card p-4 ${TONE_BORDER[tone]}`}>
      <InfoLabel label={label} definition={definition} />
      <div className="mt-1.5 space-y-0.5">
        {visible.map((line, index) => (
          <p
            key={`${label}-${index}`}
            className={
              visible.length > 1
                ? "text-sm font-semibold tabular-nums text-foreground"
                : "text-lg font-semibold tabular-nums text-foreground"
            }
          >
            {line}
          </p>
        ))}
      </div>
      {sub ? <p className="mt-1.5 text-xs leading-4 text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** Card shell used by every chart on the dashboard. */
export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}