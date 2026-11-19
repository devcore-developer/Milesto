"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Paperclip,
  Save,
  ScrollText,
  Trash2,
  X,
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
  useAIStatus,
  useBrief,
  useDeleteAttachment,
  useSaveBrief,
  useUploadAttachment,
} from "@/hooks/use-mylist";
import { briefApi } from "@/lib/api-client";
import { formatDate, useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type {
  BriefLanguage,
  BriefSourceType,
  BriefVersionDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { BriefRecorder } from "@/components/mylist/brief/brief-recorder";

const MAX_FILE_BYTES: Record<string, number> = {
  "text/plain": 2 * 1024 * 1024,
  "text/markdown": 2 * 1024 * 1024,
  "application/pdf": 10 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    10 * 1024 * 1024,
  "image/png": 4 * 1024 * 1024,
  "image/jpeg": 4 * 1024 * 1024,
};

const ACCEPT =
  ".txt,.md,.markdown,.pdf,.docx,image/png,image/jpeg";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentNote(
  status: string,
  mime: string,
  hasText: boolean,
  t: (k: TranslationKey) => string,
): { label: string; tone: "ok" | "warn" | "bad" } | null {
  if (status === "EXTRACTED") {
    if (!hasText && mime === "application/pdf") {
      return { label: t("brief.scannedPdf"), tone: "warn" };
    }
    return { label: t("brief.extracted"), tone: "ok" };
  }
  if (status === "ANALYZED") return { label: t("brief.extracted"), tone: "ok" };
  if (status === "UNSUPPORTED") {
    return mime.startsWith("image/")
      ? { label: t("brief.noVision"), tone: "warn" }
      : { label: t("brief.unsupportedFile"), tone: "warn" };
  }
  if (status === "FAILED") return { label: t("brief.failedFile"), tone: "bad" };
  return null;
}

/** Project Brief section (Phase A2) — text + voice + attachments,
 *  immutable version history, originals preserved verbatim. */
export function BriefSection({ projectId }: { projectId: string }) {
  const { t, lang } = useI18n();
  const brief = useBrief(projectId);
  const ai = useAIStatus();
  const saveBrief = useSaveBrief();
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  const [content, setContent] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [language, setLanguage] = useState<BriefLanguage>("en");
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the latest version into the editor (only when not editing).
  const latest = brief.data?.brief.latest ?? null;
  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (latest && loadedRef.current !== latest.id) {
      loadedRef.current = latest.id;
      loadVersion(latest);
    }
  }, [latest?.id]);

  function loadVersion(v: BriefVersionDTO) {
    setContent(v.content);
    setTranscript(v.transcript);
    setLanguage(v.language);
    setVersionNo(v.versionNo);
  }

  const sources: BriefSourceType[] = [];
  if (content.trim()) sources.push("text");
  if (transcript) sources.push("voice");
  if ((latest?.attachments.length ?? 0) > 0) sources.push("files");

  function save() {
    saveBrief.mutate({
      projectId,
      content,
      transcript,
      language,
      sourceTypes: sources,
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !latest) return;
    setReadingFile(true);
    try {
      for (const file of Array.from(files)) {
        const cap = MAX_FILE_BYTES[file.type];
        if (!cap || file.size > cap) {
          // Let the server reject unknown/oversized files with a clear code.
          if (!cap && file.size > 24 * 1024 * 1024) continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        await uploadAttachment.mutateAsync({
          projectId,
          file: { name: file.name, mime: file.type, size: file.size, dataUrl },
        });
      }
    } catch {
      // Toast already surfaced by the mutation's onError.
    } finally {
      setReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const voiceAvailable = ai.data?.configured
    ? ai.data.capabilities.stt
    : false;
  const dirty =
    latest != null &&
    (content !== latest.content ||
      (transcript ?? null) !== (latest.transcript ?? null) ||
      language !== latest.language);
  const canSave =
    (content.trim().length > 0 || transcript || (latest?.attachments.length ?? 0) > 0) &&
    !saveBrief.isPending &&
    (latest == null || dirty || versionNo !== latest.versionNo);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="size-4.5 text-primary" />
          {t("brief.sectionTitle")}
        </CardTitle>
        <CardDescription>{t("brief.sectionDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {brief.isLoading ? (
          <p className="text-sm text-slate-400">{t("loading")}</p>
        ) : (
          <>
            {latest == null && !dirty && (
              <p className="text-sm text-slate-500">{t("brief.empty")}</p>
            )}

            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("brief.placeholder")}
              rows={7}
              className="min-h-40 resize-y"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("brief.language")}</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as BriefLanguage)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t("brief.langEn")}</SelectItem>
                    <SelectItem value="ar">{t("brief.langAr")}</SelectItem>
                    <SelectItem value="mixed">{t("brief.langMixed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:justify-self-end sm:pt-6">
                <BriefRecorder
                  disabled={!voiceAvailable}
                  onTranscript={(text) => {
                    setTranscript(text);
                    setShowTranscript(true);
                  }}
                />
                {!voiceAvailable && (
                  <p className="text-xs text-slate-400">
                    {t("brief.voiceUnavailable")}
                  </p>
                )}
              </div>
            </div>

            {transcript && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <button
                  type="button"
                  onClick={() => setShowTranscript((s) => !s)}
                  className="flex w-full items-center justify-between gap-2 text-sm font-medium text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    {t("brief.transcript")}
                  </span>
                  {showTranscript ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                {showTranscript && (
                  <div className="mt-2 space-y-1.5">
                    <p className="whitespace-pre-wrap text-sm text-slate-600">
                      {transcript}
                    </p>
                    <p className="text-xs text-slate-400">
                      {t("brief.transcriptHint")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setTranscript(null)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                    >
                      <X className="size-3" />
                      {t("brief.remove")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Attachments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="size-4 text-primary" />
                  {t("brief.attachments")}
                  {(latest?.attachments.length ?? 0) > 0 && (
                    <Badge variant="secondary">
                      {latest?.attachments.length}
                    </Badge>
                  )}
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={readingFile || uploadAttachment.isPending}
                  onClick={() => {
                    if (!latest) {
                      // First attachment needs a version to attach to.
                      save();
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                >
                  {readingFile && <Loader2 className="size-4 animate-spin" />}
                  {t("brief.attach")}
                </Button>
              </div>
              {!latest && (
                <p className="text-xs text-slate-400">{t("brief.saveFirst")}</p>
              )}
              {(latest?.attachments.length ?? 0) > 0 && (
                <ul className="space-y-2">
                  {latest?.attachments.map((a) => {
                    const note = attachmentNote(
                      a.processingStatus,
                      a.mime,
                      Boolean(a.extractedText),
                      t,
                    );
                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800" dir="auto">
                            {a.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {fmtSize(a.size)}
                            {note && (
                              <span
                                className={cn(
                                  "ms-2",
                                  note.tone === "ok" && "text-emerald-600",
                                  note.tone === "warn" && "text-amber-600",
                                  note.tone === "bad" && "text-red-600",
                                )}
                              >
                                · {note.label}
                              </span>
                            )}
                          </p>
                          {a.extractedText && (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500" dir="auto">
                              {a.extractedText.slice(0, 220)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void briefApi
                                .getAttachmentOriginal(projectId, a.id)
                                .then(({ attachment }) => {
                                  if (!attachment.dataUrl) return;
                                  const link = document.createElement("a");
                                  link.href = attachment.dataUrl;
                                  link.download = attachment.name;
                                  link.click();
                                });
                            }}
                          >
                            {t("brief.openOriginal")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-600"
                            onClick={() =>
                              deleteAttachment.mutate({
                                projectId,
                                attachmentId: a.id,
                              })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button onClick={save} disabled={!canSave}>
                {saveBrief.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                <Save className="size-4" />
                {t("brief.saveVersion")}
              </Button>
              {versionNo != null && (
                <Badge variant="secondary">
                  {t("brief.versionNo", { n: versionNo })}
                  {dirty ? " •" : ""}
                </Badge>
              )}
            </div>

            {/* Version history */}
            {(brief.data?.brief.versions.length ?? 0) > 1 && (
              <div className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowVersions((s) => !s)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <span>
                    {t("brief.versions")} ({brief.data?.brief.versions.length})
                  </span>
                  {showVersions ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                {showVersions && (
                  <ul className="divide-y divide-slate-100">
                    {brief.data?.brief.versions.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (v.versionNo === latest?.versionNo && latest) {
                              loadVersion(latest);
                              return;
                            }
                            // Older bodies are fetched on demand — the list
                            // only carries previews.
                            void briefApi
                              .getVersion(projectId, v.versionNo)
                              .then(({ version }) => loadVersion(version));
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-slate-50"
                        >
                          <span className="font-medium text-slate-700">
                            {t("brief.versionNo", { n: v.versionNo })}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-slate-400">
                            {v.attachmentCount > 0 && (
                              <span>📎 {v.attachmentCount}</span>
                            )}
                            {formatDate(v.createdAt, lang, "d MMM yyyy")}
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