"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useBusinessSettings,
  useClients,
  useCreateDocument,
  useProject,
  useProjects,
} from "@/hooks/use-mylist";
import {
  buildDocumentContent,
  defaultDocTitle,
  type DocTaskInfo,
} from "@/lib/documents";
import { useI18n } from "@/lib/i18n";
import type { DocumentLanguage, DocumentRecordDTO, DocumentType } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DOC_TYPE_TONES,
  docTypeIcon,
} from "@/components/mylist/documents/doc-type-badge";

const NONE = "__none__";
const ALL_TYPES: DocumentType[] = [
  "SCOPE_OF_WORK",
  "COMPLETION_REPORT",
  "PROGRESS_REPORT",
  "CUSTOM_REPORT",
];

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * Create-document dialog (Phase 6): pick a type, link a client/project,
 * choose the output language, and (for reports) select the tasks to
 * include. The section content is generated from the project data and can
 * be fully edited afterwards in the document editor.
 */
export function DocumentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful create — the parent usually opens the editor. */
  onCreated: (document: DocumentRecordDTO) => void;
}) {
  const { t, lang } = useI18n();
  const createDocument = useCreateDocument();

  const { data: clientsData } = useClients();
  const clients = clientsData?.clients ?? [];
  const { data: projectsData } = useProjects();
  const allProjects = projectsData?.projects ?? [];
  const { data: settingsData } = useBusinessSettings();

  const [type, setType] = useState<DocumentType>("SCOPE_OF_WORK");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string>(NONE);
  const [language, setLanguage] = useState<DocumentLanguage>("en");
  const [issueDate, setIssueDate] = useState("");
  const [includePricing, setIncludePricing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setType("SCOPE_OF_WORK");
      setTitle("");
      setTitleTouched(false);
      setClientId("");
      setProjectId(NONE);
      setLanguage(lang);
      setIssueDate(toDateInput(new Date().toISOString()));
      setIncludePricing(false);
      setSelectedIds(new Set());
      setSaving(false);
    }
  }, [open]);

  // Projects belonging to the selected client only.
  const clientProjects = useMemo(
    () => allProjects.filter((p) => p.client?.id === clientId),
    [allProjects, clientId],
  );

  // Keep the project selection valid when the client changes.
  useEffect(() => {
    if (projectId !== NONE && !clientProjects.some((p) => p.id === projectId)) {
      setProjectId(NONE);
    }
  }, [clientId, clientProjects, projectId]);

  // Full project detail (tasks + financials) for content generation.
  const projectQuery = useProject(projectId === NONE ? null : projectId);
  const projectDetail = projectQuery.data?.project ?? null;
  const tasks: DocTaskInfo[] = useMemo(
    () =>
      (projectDetail?.tasks ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
      })),
    [projectDetail],
  );

  // Auto title until the user types their own.
  useEffect(() => {
    if (!open || titleTouched) return;
    const projectName =
      projectId !== NONE
        ? allProjects.find((p) => p.id === projectId)?.name ?? null
        : null;
    setTitle(defaultDocTitle(type, projectName, language));
  }, [open, type, projectId, language, titleTouched]);

  // Default selection for completion reports: every completed task.
  useEffect(() => {
    if (type !== "COMPLETION_REPORT") return;
    setSelectedIds(
      new Set(tasks.filter((task) => task.status === "COMPLETED").map((t) => t.id)),
    );
  }, [type, tasks]);

  const showTaskPicker = type === "COMPLETION_REPORT" && projectId !== NONE;

  async function onCreate() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const content = buildDocumentContent({
        type,
        lang: language,
        project: projectDetail
          ? {
              name: projectDetail.name,
              description: projectDetail.description,
              status: projectDetail.status,
              startDate: projectDetail.startDate,
              deadline: projectDetail.deadline,
              deliveryDate: projectDetail.deliveryDate,
              notes: projectDetail.notes,
              agreedPrice: projectDetail.agreedPrice,
              additionalCharges: projectDetail.additionalCharges,
              discount: projectDetail.discount,
              totalValue: projectDetail.totalValue,
              clientName: projectDetail.client?.name ?? null,
            }
          : null,
        tasks,
        selectedTaskIds: type === "COMPLETION_REPORT" ? [...selectedIds] : undefined,
        includePricing,
        currency: settingsData?.settings.currency,
      });
      const { document } = await createDocument.mutateAsync({
        type,
        title: title.trim(),
        language,
        issueDate: issueDate ? `${issueDate}T12:00:00.000Z` : undefined,
        clientId: clientId || null,
        projectId: projectId === NONE ? null : projectId,
        content,
      });
      onOpenChange(false);
      onCreated(document);
    } catch {
      // toast already shown by the hook
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("documents.newDocument")}</DialogTitle>
          <DialogDescription>{t("documents.contentNote")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type picker */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ALL_TYPES.map((value) => {
              const Icon = docTypeIcon(value);
              const active = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start text-sm font-medium transition-colors",
                    active
                      ? "border-blue-300 bg-blue-50 text-blue-800 ring-1 ring-blue-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      DOC_TYPE_TONES[value],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  {t(
                    value === "SCOPE_OF_WORK"
                      ? "documents.typeSow"
                      : value === "COMPLETION_REPORT"
                        ? "documents.typeCompletion"
                        : value === "PROGRESS_REPORT"
                          ? "documents.typeProgress"
                          : "documents.typeCustom",
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-title">{t("documents.titleLabel")}</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              placeholder={t("documents.titlePlaceholder")}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("documents.clientLabel")}</Label>
              <Select
                value={clientId || undefined}
                onValueChange={(v) => setClientId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("documents.clientPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company ? `${c.name} — ${c.company}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("documents.projectLabel")}</Label>
              <Select value={projectId} onValueChange={(v) => setProjectId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {t("documents.projectPlaceholder")}
                  </SelectItem>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("documents.languageLabel")}</Label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as DocumentLanguage)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t("documents.languageEn")}</SelectItem>
                  <SelectItem value="ar">{t("documents.languageAr")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-issue">{t("documents.issueDateLabel")}</Label>
              <Input
                id="doc-issue"
                type="date"
                dir="ltr"
                className="h-9"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
          </div>

          {/* SOW pricing switch */}
          {type === "SCOPE_OF_WORK" && projectId !== NONE && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Label
                htmlFor="doc-pricing"
                className="cursor-pointer text-sm font-medium text-slate-600"
              >
                {t("documents.includePricing")}
              </Label>
              <Switch
                id="doc-pricing"
                checked={includePricing}
                onCheckedChange={setIncludePricing}
              />
            </div>
          )}

          {/* Task picker for completion reports */}
          {showTaskPicker && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {t("documents.tasksSection")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t("documents.tasksHint")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setSelectedIds(new Set(projectDetail?.tasks.map((task) => task.id) ?? []))
                    }
                  >
                    {t("documents.selectAll")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-400"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    {t("documents.clearAll")}
                  </Button>
                </div>
              </div>

              {projectDetail?.tasks.length ? (
                <div className="max-h-56 space-y-1 overflow-y-auto pe-1">
                  {projectDetail.tasks.map((task) => {
                    const checked = selectedIds.has(task.id);
                    return (
                      <label
                        key={task.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(task.id);
                              else next.delete(task.id);
                              return next;
                            })
                          }
                        />
                        {checked ? (
                          <CheckSquare className="size-3.5 shrink-0 text-blue-600" />
                        ) : (
                          <Square className="size-3.5 shrink-0 text-slate-300" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{task.title}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                            task.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-600"
                              : task.status === "IN_PROGRESS"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {t(
                            task.status === "COMPLETED"
                              ? "tasks.statusCompleted"
                              : task.status === "IN_PROGRESS"
                                ? "tasks.statusInProgress"
                                : "tasks.statusTodo",
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                  {t("documents.noTasksInProject")}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={onCreate} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("documents.newDocument")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}