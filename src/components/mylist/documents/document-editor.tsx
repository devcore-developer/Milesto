"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  EyeOff,
  Loader2,
  ListPlus,
  Plus,
  Printer,
  Save,
  Table2,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import {
  useBusinessSettings,
  useClients,
  useProjects,
  useUpdateDocument,
} from "@/hooks/use-mylist";
import { documentPdfUrl } from "@/lib/api-client";
import { emptySection } from "@/lib/documents";
import { printPdfUrl } from "@/lib/print-client";
import { useI18n } from "@/lib/i18n";
import type {
  DocSection,
  DocumentLanguage,
  DocumentRecordDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { DocumentPreview } from "@/components/mylist/documents/document-preview";

const NONE = "__none__";

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * Full document editor (Phase 6): metadata + every content section
 * (text / list / table) can be edited, reordered, added and removed.
 * Preview mirrors the PDF design; export/print go through the premium
 * Chromium-rendered PDF endpoint.
 */
export function DocumentEditor({
  document: doc,
  onOpenChange,
  onSaved,
}: {
  document: DocumentRecordDTO | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (document: DocumentRecordDTO) => void;
}) {
  const { t } = useI18n();
  const updateDocument = useUpdateDocument();

  const { data: clientsData } = useClients();
  const clients = clientsData?.clients ?? [];
  const { data: projectsData } = useProjects();
  const allProjects = projectsData?.projects ?? [];
  const { data: settingsData } = useBusinessSettings();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string>(NONE);
  const [language, setLanguage] = useState<DocumentLanguage>("en");
  const [issueDate, setIssueDate] = useState("");
  const [sections, setSections] = useState<DocSection[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingSectionId, setRemovingSectionId] = useState<string | null>(null);

  // Hydrate the editor whenever a different document is opened.
  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setClientId(doc.clientId ?? "");
    setProjectId(doc.projectId ?? NONE);
    setLanguage(doc.language);
    setIssueDate(toDateInput(doc.issueDate));
    setSections(doc.content?.sections ?? []);
    setPreviewOpen(false);
    setSaving(false);
  }, [doc]);

  // Projects shown: of the selected client, or everything without one.
  const projectOptions = useMemo(
    () =>
      clientId
        ? allProjects.filter((p) => p.client?.id === clientId)
        : allProjects,
    [allProjects, clientId],
  );

  // Keep the project selection valid when the client changes.
  useEffect(() => {
    if (
      projectId !== NONE &&
      !projectOptions.some((p) => p.id === projectId)
    ) {
      setProjectId(NONE);
    }
  }, [clientId]);

  function patchSection(id: string, patch: Partial<DocSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? ({ ...s, ...patch } as DocSection) : s)),
    );
  }

  function moveSection(id: string, direction: -1 | 1) {
    setSections((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function addSection(kind: DocSection["kind"]) {
    setSections((prev) => [...prev, emptySection(kind, language)]);
  }

  const previewDoc: DocumentRecordDTO | null = useMemo(() => {
    if (!doc) return null;
    return {
      ...doc,
      title: title.trim() || doc.title,
      language,
      issueDate: issueDate ? `${issueDate}T12:00:00.000Z` : doc.issueDate,
      clientId: clientId || null,
      projectId: projectId === NONE ? null : projectId,
      client: clients.find((c) => c.id === clientId)
        ? {
            id: clientId,
            name: clients.find((c) => c.id === clientId)!.name,
            company: clients.find((c) => c.id === clientId)!.company,
            email: clients.find((c) => c.id === clientId)!.email,
            phone: clients.find((c) => c.id === clientId)!.phone,
            address: clients.find((c) => c.id === clientId)!.address,
          }
        : null,
      project:
        projectId !== NONE
          ? { id: projectId, name: allProjects.find((p) => p.id === projectId)?.name ?? "" }
          : null,
      content: { sections },
    };
  }, [
    doc,
    title,
    language,
    issueDate,
    clientId,
    projectId,
    clients,
    allProjects,
    sections,
  ]);

  async function onSave() {
    if (!doc || !title.trim() || saving) return;
    setSaving(true);
    try {
      const { document: saved } = await updateDocument.mutateAsync({
        id: doc.id,
        data: {
          title: title.trim(),
          language,
          issueDate: issueDate ? `${issueDate}T12:00:00.000Z` : undefined,
          clientId: clientId || null,
          projectId: projectId === NONE ? null : projectId,
          content: { sections },
        },
      });
      onSaved?.(saved);
    } catch {
      // toast already shown by the hook
    } finally {
      setSaving(false);
    }
  }

  if (!doc) return null;

  return (
    <>
      <Dialog open={!!doc} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2" dir="ltr">
              {doc.number}
            </DialogTitle>
            <DialogDescription>{t("documents.editDocument")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="doc-edit-title">{t("documents.titleLabel")}</Label>
                <Input
                  id="doc-edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9"
                />
              </div>
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
                    {projectOptions.map((p) => (
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
                <Label htmlFor="doc-edit-issue">
                  {t("documents.issueDateLabel")}
                </Label>
                <Input
                  id="doc-edit-issue"
                  type="date"
                  dir="ltr"
                  className="h-9"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("documents.sectionsSection")}</Label>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => addSection("text")}
                  >
                    <Type className="size-3.5" />
                    {t("documents.addTextSection")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => addSection("list")}
                  >
                    <ListPlus className="size-3.5" />
                    {t("documents.addListSection")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => addSection("table")}
                  >
                    <Table2 className="size-3.5" />
                    {t("documents.addTableSection")}
                  </Button>
                </div>
              </div>

              {sections.map((section, index) => (
                <div
                  key={section.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="mb-2 flex items-center gap-1.5">
                    <Input
                      value={section.heading}
                      onChange={(e) =>
                        patchSection(section.id, { heading: e.target.value })
                      }
                      placeholder={t("documents.titleLabel")}
                      className="h-8 flex-1 border-0 bg-transparent font-semibold shadow-none focus-visible:bg-white"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-slate-400"
                      aria-label={t("documents.moveUp")}
                      disabled={index === 0}
                      onClick={() => moveSection(section.id, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-slate-400"
                      aria-label={t("documents.moveDown")}
                      disabled={index === sections.length - 1}
                      onClick={() => moveSection(section.id, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-slate-300 hover:text-red-600"
                      aria-label={t("documents.removeSection")}
                      onClick={() => setRemovingSectionId(section.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {/* Text section */}
                  {section.kind === "text" && (
                    <Textarea
                      value={section.body}
                      onChange={(e) =>
                        patchSection(section.id, { body: e.target.value })
                      }
                      rows={3}
                      className="bg-white"
                    />
                  )}

                  {/* List section */}
                  {section.kind === "list" && (
                    <div className="space-y-1.5">
                      {section.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center gap-1.5">
                          <Input
                            value={item}
                            onChange={(e) =>
                              patchSection(section.id, {
                                items: section.items.map((v, i) =>
                                  i === itemIndex ? e.target.value : v,
                                ),
                              })
                            }
                            className="h-8 bg-white"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-slate-300 hover:text-red-600"
                            aria-label={t("delete")}
                            onClick={() =>
                              patchSection(section.id, {
                                items: section.items.filter((_, i) => i !== itemIndex),
                              })
                            }
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-blue-700"
                        onClick={() =>
                          patchSection(section.id, { items: [...section.items, ""] })
                        }
                      >
                        <Plus className="size-3.5" />
                        {t("documents.addItem")}
                      </Button>
                    </div>
                  )}

                  {/* Table section */}
                  {section.kind === "table" && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {section.columns.map((col, colIndex) => (
                          <div key={colIndex} className="flex items-center gap-1">
                            <Input
                              value={col}
                              onChange={(e) =>
                                patchSection(section.id, {
                                  columns: section.columns.map((v, i) =>
                                    i === colIndex ? e.target.value : v,
                                  ),
                                })
                              }
                              className="h-8 w-32 bg-white text-xs font-semibold"
                            />
                            {section.columns.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-slate-300 hover:text-red-600"
                                aria-label={t("delete")}
                                onClick={() =>
                                  patchSection(section.id, {
                                    columns: section.columns.filter(
                                      (_, i) => i !== colIndex,
                                    ),
                                    rows: section.rows.map((row) =>
                                      row.filter((_, i) => i !== colIndex),
                                    ),
                                  })
                                }
                              >
                                <X className="size-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {section.columns.length < 6 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-blue-700"
                            onClick={() =>
                              patchSection(section.id, {
                                columns: [...section.columns, ""],
                                rows: section.rows.map((row) => [...row, ""]),
                              })
                            }
                          >
                            <Plus className="size-3.5" />
                            {t("documents.addColumn")}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {section.rows.map((row, rowIndex) => (
                          <div key={rowIndex} className="flex items-start gap-1.5">
                            <div className="grid flex-1 gap-1.5 sm:grid-cols-2">
                              {section.columns.map((_, colIndex) => (
                                <Input
                                  key={colIndex}
                                  value={row[colIndex] ?? ""}
                                  onChange={(e) =>
                                    patchSection(section.id, {
                                      rows: section.rows.map((r, ri) =>
                                        ri === rowIndex
                                          ? r.map((cell, ci) =>
                                              ci === colIndex ? e.target.value : cell,
                                            )
                                          : r,
                                      ),
                                    })
                                  }
                                  className="h-8 bg-white"
                                />
                              ))}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0 text-slate-300 hover:text-red-600"
                              aria-label={t("delete")}
                              onClick={() =>
                                patchSection(section.id, {
                                  rows: section.rows.filter((_, ri) => ri !== rowIndex),
                                })
                              }
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-blue-700"
                        onClick={() =>
                          patchSection(section.id, {
                            rows: [
                              ...section.rows,
                              section.columns.map(() => ""),
                            ],
                          })
                        }
                      >
                        <Plus className="size-3.5" />
                        {t("documents.addRow")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Preview */}
            {previewOpen && previewDoc && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  {t("documents.previewTitle")}
                </p>
                <DocumentPreview doc={previewDoc} settings={settingsData?.settings} />
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreviewOpen((v) => !v)}
            >
              {previewOpen ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {previewOpen ? t("close") : t("documents.preview")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={documentPdfUrl(doc.id, true)} download>
                <Download className="size-3.5" />
                {t("documents.downloadPdf")}
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => printPdfUrl(documentPdfUrl(doc.id))}
            >
              <Printer className="size-3.5" />
              {t("documents.print")}
            </Button>
            <div className="ms-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("close")}
              </Button>
              <Button size="sm" className="gap-1.5" onClick={onSave} disabled={saving || !title.trim()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove-section confirmation */}
      <AlertDialog
        open={!!removingSectionId}
        onOpenChange={(o) => !o && setRemovingSectionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("documents.removeSection")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("documents.removeSectionConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                setSections((prev) =>
                  prev.filter((s) => s.id !== removingSectionId),
                );
                setRemovingSectionId(null);
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}