"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  FileSearch,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAIStatus,
  useAnalyzeBrief,
  useApproveAIDraft,
  useAIDraft,
  useAIDrafts,
  useBrief,
  useDiscardAIDraft,
  useGenerateSow,
  useRegenerateModule,
  useSaveAIDraft,
} from "@/hooks/use-mylist";
import { useI18n } from "@/lib/i18n";
import { planTaskCount, type AIPlan, type PlanTask } from "@/lib/ai/plan-schema";
import type { AIDraftDTO } from "@/lib/types";
import {
  AiSuggestionBadge,
  ClassificationBadge,
  DependsOn,
  EstimateBadge,
  SourceQuotes,
} from "@/components/mylist/ai/ai-badges";
import { cn } from "@/lib/utils";

const LIST_SECTIONS = [
  { key: "objectives", labelKey: "ai.plan.objectives" },
  { key: "scope", labelKey: "ai.plan.scope" },
  { key: "deliverables", labelKey: "ai.plan.deliverables" },
  { key: "risks", labelKey: "ai.plan.risks" },
  { key: "assumptions", labelKey: "ai.plan.assumptions" },
  { key: "missingInfo", labelKey: "ai.plan.missingInfo" },
  { key: "optionalAddons", labelKey: "ai.plan.optionalAddons" },
  { key: "excluded", labelKey: "ai.plan.excluded" },
] as const;

type ListSectionKey = (typeof LIST_SECTIONS)[number]["key"];

/** Review surface for ONE draft. Re-keyed by draft id — state initializes
 *  from the draft without any setState-in-effect. */
function PlanReview({ draft, projectId }: { draft: AIDraftDTO; projectId: string }) {
  const { t } = useI18n();
  const saveEdits = useSaveAIDraft();
  const approve = useApproveAIDraft();
  const discard = useDiscardAIDraft();
  const regenerate = useRegenerateModule();
  const generateSow = useGenerateSow();

  const [plan, setPlan] = useState<AIPlan>(draft.payload);
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(draft.payload.modules.flatMap((m) => m.tasks.map((tk) => tk.id))),
  );

  const tasksById = useMemo(() => {
    const map = new Map<string, PlanTask>();
    plan.modules.forEach((m) => m.tasks.forEach((tk) => map.set(tk.id, tk)));
    return map;
  }, [plan]);

  const selectedCount = plan.modules.reduce(
    (n, m) => n + m.tasks.filter((tk) => accepted.has(tk.id)).length,
    0,
  );
  const totalCount = planTaskCount(plan);

  function patchPlan(fn: (p: AIPlan) => AIPlan) {
    setPlan((p) => fn(p));
  }

  function updateTask(moduleIndex: number, taskId: string, patch: Partial<PlanTask>) {
    patchPlan((p) => ({
      ...p,
      modules: p.modules.map((m, i) =>
        i !== moduleIndex
          ? m
          : { ...m, tasks: m.tasks.map((tk) => (tk.id === taskId ? { ...tk, ...patch } : tk)) },
      ),
    }));
  }

  function moveTask(moduleIndex: number, taskId: string, dir: -1 | 1) {
    patchPlan((p) => ({
      ...p,
      modules: p.modules.map((m, i) => {
        if (i !== moduleIndex) return m;
        const idx = m.tasks.findIndex((tk) => tk.id === taskId);
        const to = idx + dir;
        if (idx === -1 || to < 0 || to >= m.tasks.length) return m;
        const tasks = [...m.tasks];
        [tasks[idx], tasks[to]] = [tasks[to], tasks[idx]];
        return { ...m, tasks };
      }),
    }));
  }

  function deleteTask(moduleIndex: number, taskId: string) {
    patchPlan((p) => ({
      ...p,
      modules: p.modules.map((m, i) =>
        i !== moduleIndex
          ? m
          : { ...m, tasks: m.tasks.filter((tk) => tk.id !== taskId) },
      ),
    }));
    setAccepted((s) => {
      const next = new Set(s);
      next.delete(taskId);
      return next;
    });
  }

  function addTask(moduleIndex: number) {
    const id = `m${moduleIndex + 1}tx${Date.now().toString(36)}`;
    setAccepted((s) => new Set(s).add(id));
    patchPlan((p) => ({
      ...p,
      modules: p.modules.map((m, i) =>
        i !== moduleIndex
          ? m
          : {
              ...m,
              tasks: [
                ...m.tasks,
                {
                  id,
                  title: t("ai.plan.newTaskTitle"),
                  description: null,
                  priority: "MEDIUM" as const,
                  estimatedDays: 1,
                  classification: "SUGGESTION" as const,
                  sourceQuotes: [],
                  aiSuggestion: true,
                  dependsOn: [],
                  subtasks: [],
                },
              ],
            },
      ),
    }));
  }

  return (
    <div className="space-y-4">
      {draft.status === "APPROVED" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <span className="flex items-center gap-2">
            <CircleCheck className="size-4" />
            {t("ai.plan.approvedBadge")} · {t("ai.plan.approvedOn", { n: totalCount })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateSow.mutate({ projectId, language: draft.language === "ar" ? "ar" : "en" })}
            disabled={generateSow.isPending}
          >
            {generateSow.isPending && <Loader2 className="size-4 animate-spin" />}
            <ScrollText className="size-4" />
            {t("sow.generate")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-600">
            {t("ai.plan.accepted", { n: selectedCount, m: totalCount })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveEdits.mutate({ draftId: draft.id, payload: plan, projectId })}
              disabled={saveEdits.isPending}
            >
              {saveEdits.isPending && <Loader2 className="size-4 animate-spin" />}
              <Save className="size-4" />
              {t("ai.plan.save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600"
              onClick={() => discard.mutate({ draftId: draft.id, projectId })}
              disabled={discard.isPending}
            >
              <CircleX className="size-4" />
              {t("ai.plan.discard")}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                approve.mutate(
                  { draftId: draft.id, projectId, acceptedTaskIds: [...accepted] },
                  { onSuccess: () => undefined },
                )
              }
              disabled={selectedCount === 0 || approve.isPending}
            >
              {approve.isPending && <Loader2 className="size-4 animate-spin" />}
              <CircleCheck className="size-4" />
              {t("ai.plan.approve", { n: selectedCount })}
            </Button>
          </div>
        </div>
      )}

      {/* List sections */}
      <div className="grid gap-3 sm:grid-cols-2">
        {LIST_SECTIONS.map(({ key, labelKey }) => {
          const items = plan[key];
          if (!items?.length) return null;
          return (
            <div key={key} className="rounded-lg border border-slate-200 p-3">
              <p className="mb-1.5 text-sm font-semibold text-slate-700">{t(labelKey)}</p>
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ClassificationBadge classification={item.classification} />
                    <span className="min-w-0 flex-1 text-sm text-slate-600" dir="auto">
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Milestones */}
      {plan.milestones.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-1.5 text-sm font-semibold text-slate-700">
            {t("ai.plan.milestones")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {plan.milestones.map((ms, i) => (
              <li
                key={i}
                className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-sm text-slate-600"
              >
                ◆ {ms.title}
                <span className="text-xs text-slate-400">
                  {t("ai.plan.afterDays", { n: ms.afterDays })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modules → tasks */}
      <div className="space-y-4">
        {plan.modules.map((module, mi) => (
          <div key={module.id} className="rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800" dir="auto">
                  {module.name}
                </span>
                <ClassificationBadge classification={module.classification} />
                <Badge variant="secondary">{module.tasks.length}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => addTask(mi)}
                >
                  <Plus className="size-3.5" />
                  {t("ai.plan.addTask")}
                </Button>
                {draft.status !== "APPROVED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs text-primary"
                    onClick={() =>
                      regenerate.mutate(
                        { draftId: draft.id, moduleIndex: mi },
                        {
                          onSuccess: (res) => {
                            setPlan(res.draft.payload);
                            setAccepted(
                              new Set(
                                res.draft.payload.modules.flatMap((m) =>
                                  m.tasks.map((tk) => tk.id),
                                ),
                              ),
                            );
                          },
                        },
                      )
                    }
                    disabled={regenerate.isPending}
                  >
                    {regenerate.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    <RefreshCw className="size-3.5" />
                    {regenerate.isPending
                      ? t("ai.plan.regenerating")
                      : t("ai.plan.regenerateModule")}
                  </Button>
                )}
              </div>
            </div>
            <ul className="divide-y divide-slate-50">
              {module.tasks.map((task) => {
                const isAccepted = accepted.has(task.id);
                return (
                  <li key={task.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={isAccepted}
                        onCheckedChange={(c) => {
                          setAccepted((s) => {
                            const next = new Set(s);
                            if (c === true) next.add(task.id);
                            else next.delete(task.id);
                            return next;
                          });
                        }}
                        className="mt-1 shrink-0"
                        aria-label={task.title}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            value={task.title}
                            onChange={(e) =>
                              updateTask(mi, task.id, { title: e.target.value })
                            }
                            dir="auto"
                            className={cn(
                              "min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-200 focus:border-primary focus:outline-none",
                              !isAccepted && "text-slate-400 line-through",
                            )}
                          />
                          <ClassificationBadge classification={task.classification} />
                          {task.aiSuggestion && <AiSuggestionBadge />}
                          <EstimateBadge days={task.estimatedDays} />
                        </div>
                        {task.description && (
                          <p className="text-xs text-slate-500" dir="auto">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <input
                            type="number"
                            min={0}
                            max={365}
                            step={0.5}
                            value={task.estimatedDays}
                            onChange={(e) =>
                              updateTask(mi, task.id, {
                                estimatedDays: Math.max(
                                  0,
                                  Math.min(365, Number(e.target.value) || 0),
                                ),
                              })
                            }
                            className="w-14 rounded border border-slate-200 px-1 py-0.5 text-xs"
                            aria-label={t("ai.plan.estimate", { n: task.estimatedDays })}
                          />
                          <select
                            value={task.priority}
                            onChange={(e) =>
                              updateTask(mi, task.id, {
                                priority: e.target.value as PlanTask["priority"],
                              })
                            }
                            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
                          >
                            <option value="LOW">LOW</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="HIGH">HIGH</option>
                            <option value="URGENT">URGENT</option>
                          </select>
                        </div>
                        {task.subtasks.length > 0 && (
                          <ul className="ms-4 space-y-0.5 border-s border-slate-200 ps-2">
                            {task.subtasks.map((st, si) => (
                              <li
                                key={si}
                                className="flex items-center gap-1 text-xs text-slate-500"
                              >
                                <span className="text-slate-300">□</span>
                                <span className="min-w-0 flex-1" dir="auto">
                                  {st.title}
                                </span>
                                <ClassificationBadge classification={st.classification} />
                              </li>
                            ))}
                          </ul>
                        )}
                        <DependsOn task={task} tasksById={tasksById} />
                        <SourceQuotes quotes={task.sourceQuotes} />
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => moveTask(mi, task.id, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => moveTask(mi, task.id, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-red-500"
                          onClick={() => deleteTask(mi, task.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {module.tasks.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">
                  {t("ai.plan.tasks")}: 0
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Project AI plan (Phase A3): analyze → review/edit → approve. */
export function AIPlanSection({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const ai = useAIStatus();
  const brief = useBrief(projectId);
  const drafts = useAIDrafts(projectId);
  const analyze = useAnalyzeBrief();

  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);

  const draftQuery = useAIDraft(openDraftId);
  const draft = draftQuery.data?.draft ?? null;

  const latestApproved = drafts.data?.drafts.find((d) => d.status === "APPROVED");
  const latestDraft = drafts.data?.drafts.find((d) => d.status === "DRAFT");
  const briefReady = Boolean(brief.data?.brief.latest);
  const aiReady = Boolean(ai.data?.configured);

  function runAnalyze() {
    setPartial(false);
    analyze.mutate(
      { projectId, language },
      {
        onSuccess: (res) => {
          setOpenDraftId(res.draft.id);
          setPartial(Boolean(res.warning));
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4.5 text-primary" />
          {t("ai.plan.sectionTitle")}
        </CardTitle>
        <CardDescription>{t("ai.plan.sectionDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft ? (
          <>
            {partial && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {t("ai.plan.partial")}
              </div>
            )}
            <PlanReview key={draft.id} draft={draft} projectId={projectId} />
            <Button variant="ghost" size="sm" onClick={() => setOpenDraftId(null)}>
              {t("close")}
            </Button>
          </>
        ) : (
          <>
            {!aiReady && (
              <div className="flex items-start gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {t("ai.plan.needAI")}
              </div>
            )}
            {!briefReady && (
              <p className="text-sm text-amber-600">{t("ai.plan.emptyBrief")}</p>
            )}
            {latestDraft && (
              <Button variant="outline" onClick={() => setOpenDraftId(latestDraft.id)}>
                <FileSearch className="size-4" />
                {t("ai.plan.review")}
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as "en" | "ar")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={runAnalyze}
                disabled={!aiReady || !briefReady || analyze.isPending}
              >
                {analyze.isPending && <Loader2 className="size-4 animate-spin" />}
                <Bot className="size-4" />
                {analyze.isPending ? t("ai.plan.analyzing") : t("ai.plan.analyze")}
              </Button>
              {latestApproved && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  <CircleCheck className="me-1 size-3" />
                  {t("ai.plan.approvedOn", { n: latestApproved.taskCount })}
                </Badge>
              )}
            </div>
            {!latestDraft && !latestApproved && briefReady && !analyze.isPending && (
              <p className="text-sm text-slate-400">{t("ai.plan.noDraft")}</p>
            )}

            {/* Previous plans */}
            {(drafts.data?.drafts.length ?? 0) > 0 && (
              <div className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDrafts((s) => !s)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <span>
                    {t("ai.plan.drafts")} ({drafts.data?.drafts.length})
                  </span>
                  {showDrafts ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                {showDrafts && (
                  <ul className="divide-y divide-slate-50">
                    {drafts.data?.drafts.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => setOpenDraftId(d.id)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                d.status === "APPROVED" && "bg-emerald-100 text-emerald-700",
                                d.status === "DISCARDED" && "bg-slate-100 text-slate-400",
                              )}
                            >
                              {d.status}
                            </Badge>
                            <span className="text-slate-600">
                              {t("ai.plan.modules")}: {d.moduleCount} ·{" "}
                              {t("ai.plan.tasks")}: {d.taskCount}
                            </span>
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(d.createdAt).toLocaleDateString()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}