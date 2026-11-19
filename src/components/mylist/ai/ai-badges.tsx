"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type {
  PlanClassification,
  PlanTask,
} from "@/lib/ai/plan-schema";
import { cn } from "@/lib/utils";

const CLASSIFICATION_STYLE: Record<
  PlanClassification,
  string
> = {
  EXPLICIT: "bg-emerald-100 text-emerald-700",
  INFERRED: "bg-amber-100 text-amber-700",
  SUGGESTION: "bg-violet-100 text-violet-700",
};

const CLASSIFICATION_KEY: Record<PlanClassification, TranslationKey> = {
  EXPLICIT: "ai.plan.classificationExplicit",
  INFERRED: "ai.plan.classificationInferred",
  SUGGESTION: "ai.plan.classificationSuggestion",
};

export function ClassificationBadge({
  classification,
}: {
  classification: PlanClassification;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        CLASSIFICATION_STYLE[classification],
      )}
    >
      {t(CLASSIFICATION_KEY[classification])}
    </span>
  );
}

export function AiSuggestionBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
      {t("ai.plan.aiSuggestion")}
    </span>
  );
}

/** "~3d" estimate chip — always labeled as an estimate. */
export function EstimateBadge({ days }: { days: number }) {
  const { t } = useI18n();
  return (
    <span
      className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
      title={t("ai.plan.estimate", { n: days })}
    >
      {t("ai.plan.estimate", { n: days })}
    </span>
  );
}

/** Expandable list of the EXACT brief substrings an item came from. */
export function SourceQuotes({ quotes }: { quotes: string[] }) {
  const { t } = useI18n();
  if (quotes.length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer list-none text-[11px] font-medium text-slate-400 hover:text-slate-600">
        {t("ai.plan.sourceQuotes")} ({quotes.length})
      </summary>
      <ul className="mt-1 space-y-1 border-s-2 border-slate-200 ps-2">
        {quotes.map((q, i) => (
          <li key={i} className="text-[11px] italic text-slate-500" dir="auto">
            “{q}”
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Task dependency names — resolved against the current plan. */
export function DependsOn({
  task,
  tasksById,
}: {
  task: PlanTask;
  tasksById: Map<string, PlanTask>;
}) {
  const { t } = useI18n();
  const names = task.dependsOn
    .map((id) => tasksById.get(id)?.title)
    .filter((x): x is string => Boolean(x));
  if (names.length === 0) return null;
  return (
    <p className="mt-0.5 text-[11px] text-slate-400">
      {t("ai.plan.dependsOn")}: {names.join(" · ")}
    </p>
  );
}