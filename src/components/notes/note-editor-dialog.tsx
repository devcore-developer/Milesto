"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNotes } from "@/lib/notes-context";
import {
  DECISION_STATUSES,
  NOTE_TYPES,
  type KnowledgeNote,
} from "@/types/notes";

const AUTOSAVE_DELAY_MS = 900;
const PERSIST_FEEDBACK_MS = 250;
const SAVED_LINGER_MS = 1750;
const DEFAULT_AUTHOR = "Mara Vey";

type NoteTypeValue = (typeof NOTE_TYPES)[number];
type DecisionStatusValue = (typeof DECISION_STATUSES)[number];
type NoteLinksValue = KnowledgeNote["links"];
type DecisionMetaValue = NonNullable<KnowledgeNote["decision"]>;

type SaveStatus = "idle" | "saving" | "saved";

const DECISION_TYPE: NoteTypeValue = "Decision";
const GENERAL_TYPE: NoteTypeValue = "General";

const selectClasses =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type NoteTemplate = {
  id: string;
  name: string;
  noteType: NoteTypeValue;
  description: string;
  content: string;
};

// Templates are intentionally declared locally so the editor dialog has no
// dependency on "@/data/note-templates" and stays fully self-contained.
const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "TPL-001",
    name: "Technical Design Note",
    noteType: "Technical",
    description: "Context, approach, trade-offs and follow-ups.",
    content: [
      "## Context",
      "<!-- What problem does this design address? -->",
      "",
      "## Proposed approach",
      "<!-- Describe the chosen design and how it works. -->",
      "",
      "## Options considered",
      "- **Option A** — ",
      "- **Option B** — ",
      "",
      "## Trade-offs and risks",
      "- ",
      "",
      "## Follow-ups",
      "- [ ] ",
    ].join("\n"),
  },
  {
    id: "TPL-002",
    name: "Meeting Notes",
    noteType: "Meeting",
    description: "Agenda, discussion, decisions and action items.",
    content: [
      "**Date:** ",
      "**Attendees:** ",
      "",
      "## Agenda",
      "- ",
      "",
      "## Discussion",
      "- ",
      "",
      "## Decisions",
      "- ",
      "",
      "## Action items",
      "- [ ] ",
    ].join("\n"),
  },
  {
    id: "TPL-003",
    name: "Decision Record",
    noteType: "Decision",
    description: "Structured decision with context and consequences.",
    content: [
      "## Status",
      "Proposed",
      "",
      "## Context",
      "<!-- Why is this decision needed now? -->",
      "",
      "## Decision",
      "<!-- What did we decide? -->",
      "",
      "## Alternatives",
      "- ",
      "",
      "## Consequences",
      "- ",
    ].join("\n"),
  },
  {
    id: "TPL-004",
    name: "Bug Investigation",
    noteType: "Bug Investigation",
    description: "Symptom, reproduction, root cause and fix.",
    content: [
      "## Symptom",
      "<!-- What is failing and where? -->",
      "",
      "## Reproduction steps",
      "1. ",
      "",
      "## Root cause",
      "<!-- Findings from debugging. -->",
      "",
      "## Fix and verification",
      "- [ ] Fix implemented",
      "- [ ] Regression test added",
    ].join("\n"),
  },
  {
    id: "TPL-005",
    name: "Research Summary",
    noteType: "Research",
    description: "Question, sources, findings and recommendation.",
    content: [
      "## Question",
      "<!-- What were we trying to learn? -->",
      "",
      "## Sources",
      "- ",
      "",
      "## Findings",
      "- ",
      "",
      "## Recommendation",
      "<!-- What should the team do with this? -->",
    ].join("\n"),
  },
  {
    id: "TPL-006",
    name: "Retrospective",
    noteType: "Retrospective",
    description: "What went well, what didn't and next actions.",
    content: [
      "## What went well",
      "- ",
      "",
      "## What didn't go well",
      "- ",
      "",
      "## Lessons learned",
      "- ",
      "",
      "## Actions for next iteration",
      "- [ ] ",
    ].join("\n"),
  },
];

type DraftState = {
  title: string;
  type: NoteTypeValue;
  content: string;
  tagsText: string;
  phaseId: string;
  taskId: string;
  testCaseId: string;
  decisionStatus: DecisionStatusValue;
};

function toDraft(source: KnowledgeNote | null): DraftState {
  return {
    title: source?.title ?? "",
    type: source?.type ?? GENERAL_TYPE,
    content: source?.content ?? "",
    tagsText: source?.tags?.join(", ") ?? "",
    phaseId: source?.links?.phaseId ?? "",
    taskId: source?.links?.taskId ?? "",
    testCaseId: source?.links?.testCaseId ?? "",
    decisionStatus: source?.decision?.status ?? "Proposed",
  };
}

function isDraftEmpty(draft: DraftState): boolean {
  return (
    draft.title.trim() === "" &&
    draft.content.trim() === "" &&
    draft.tagsText.trim() === "" &&
    draft.phaseId.trim() === "" &&
    draft.taskId.trim() === "" &&
    draft.testCaseId.trim() === ""
  );
}

export type NoteEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional: the global notes browser can open the editor with no project selected. */
  projectId?: string;
  note?: KnowledgeNote | null;
};

export function NoteEditorDialog({
  open,
  onOpenChange,
  projectId,
  note = null,
}: NoteEditorDialogProps) {
  const { createNote, updateNote } = useNotes();

  const [draft, setDraft] = useState<DraftState>(() => toDraft(note));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const activeNoteRef = useRef<KnowledgeNote | null>(note);
  const draftRef = useRef<DraftState>(draft);
  const dirtyRef = useRef(false);
  const saveSeqRef = useRef(0);
  const debounceRef = useRef<number | null>(null);

  const noteId = note?.id ?? null;

  // Re-initialise the draft only when the dialog opens or a different note is
  // loaded. The note object identity changes after every autosave, so the
  // effect must NOT key on it, otherwise it would wipe the user's typing.
  useEffect(() => {
    if (!open) return;
    activeNoteRef.current = note;
    const fresh = toDraft(note);
    draftRef.current = fresh;
    setDraft(fresh);
    dirtyRef.current = false;
    setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noteId]);

  const commitNow = useCallback(() => {
    const current = draftRef.current;
    if (!dirtyRef.current) return;

    if (isDraftEmpty(current)) {
      // Fully empty drafts are intentionally never persisted.
      dirtyRef.current = false;
      return;
    }

    const trimmedTitle = current.title.trim();
    const title = trimmedTitle.length > 0 ? trimmedTitle : "Untitled note";
    const tags = current.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const links: NoteLinksValue = {
      projectId: activeNoteRef.current?.links?.projectId ?? projectId,
      phaseId: current.phaseId.trim() ? current.phaseId.trim() : undefined,
      taskId: current.taskId.trim() ? current.taskId.trim() : undefined,
      testCaseId: current.testCaseId.trim()
        ? current.testCaseId.trim()
        : undefined,
    };

    let decision: DecisionMetaValue | undefined;
    if (current.type === DECISION_TYPE) {
      const base: DecisionMetaValue =
        activeNoteRef.current?.decision ?? { status: current.decisionStatus };
      const nextDecision: DecisionMetaValue = {
        ...base,
        status: current.decisionStatus,
      };
      if (
        (current.decisionStatus === "Accepted" ||
          current.decisionStatus === "Rejected") &&
        !nextDecision.decidedAt
      ) {
        nextDecision.decidedAt = new Date().toISOString();
        nextDecision.decidedBy = nextDecision.decidedBy ?? DEFAULT_AUTHOR;
      }
      decision = nextDecision;
    } else {
      decision = activeNoteRef.current?.decision;
    }

    if (activeNoteRef.current) {
      const existing = activeNoteRef.current;
      const patch: Partial<KnowledgeNote> = {
        title,
        type: current.type,
        content: current.content,
        tags,
        links,
      };
      if (decision) {
        patch.decision = decision;
      }
      updateNote(existing.id, patch);
      activeNoteRef.current = {
        ...existing,
        title,
        type: current.type,
        content: current.content,
        tags,
        links,
        decision: decision ?? existing.decision,
      };
    } else {
      const created = createNote({
        title,
        type: current.type,
        content: current.content,
        tags,
        links,
        decision,
        author: DEFAULT_AUTHOR,
      });
      activeNoteRef.current = created;
    }

    dirtyRef.current = false;
  }, [createNote, updateNote, projectId]);

  const runSaveCycle = useCallback(() => {
    if (!dirtyRef.current) {
      setStatus("idle");
      return;
    }
    if (isDraftEmpty(draftRef.current)) {
      dirtyRef.current = false;
      setStatus("idle");
      return;
    }
    const seq = ++saveSeqRef.current;
    setStatus("saving");
    window.setTimeout(() => {
      if (seq !== saveSeqRef.current) return;
      commitNow();
      setStatus("saved");
      window.setTimeout(() => {
        if (seq !== saveSeqRef.current) return;
        setStatus((prev) => (prev === "saved" ? "idle" : prev));
      }, SAVED_LINGER_MS);
    }, PERSIST_FEEDBACK_MS);
  }, [commitNow]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      runSaveCycle();
    }, AUTOSAVE_DELAY_MS);
  }, [runSaveCycle]);

  const flushSave = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    saveSeqRef.current += 1;
    if (!dirtyRef.current) return;
    commitNow();
    setStatus("idle");
  }, [commitNow]);

  const flushRef = useRef(flushSave);
  useEffect(() => {
    flushRef.current = flushSave;
  }, [flushSave]);

  // Never lose pending edits when the component unmounts with the dialog open.
  useEffect(() => {
    return () => {
      flushRef.current();
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      flushSave();
    }
    onOpenChange(next);
  };

  // Ctrl/Cmd+S saves immediately instead of waiting for the debounce.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        if (debounceRef.current !== null) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        runSaveCycle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, runSaveCycle]);

  const applyDraft = (patch: Partial<DraftState>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    dirtyRef.current = true;
    scheduleSave();
  };

  const applyTemplate = (template: NoteTemplate) => {
    applyDraft({
      content: template.content,
      type:
        draftRef.current.type === GENERAL_TYPE
          ? template.noteType
          : draftRef.current.type,
    });
  };

  const isDecision = draft.type === DECISION_TYPE;
  const showTemplates = draft.content.trim().length === 0;
  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved"
        : "Autosave is on";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {activeNoteRef.current ? "Edit note" : "New note"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Markdown is supported. Changes autosave into this session&apos;s
            in-memory store — press Ctrl/Cmd+S to save immediately.
          </p>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <label htmlFor="note-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="note-title"
              value={draft.title}
              onChange={(event) => applyDraft({ title: event.target.value })}
              placeholder="Give the note a short, searchable title"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="note-type" className="text-sm font-medium">
                Type
              </label>
              <select
                id="note-type"
                value={draft.type}
                onChange={(event) =>
                  applyDraft({ type: event.target.value as NoteTypeValue })
                }
                className={selectClasses}
              >
                {NOTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {isDecision && (
              <div className="grid gap-1.5">
                <label
                  htmlFor="note-decision-status"
                  className="text-sm font-medium"
                >
                  Decision status
                </label>
                <select
                  id="note-decision-status"
                  value={draft.decisionStatus}
                  onChange={(event) =>
                    applyDraft({
                      decisionStatus: event.target
                        .value as DecisionStatusValue,
                    })
                  }
                  className={selectClasses}
                >
                  {DECISION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {showTemplates && (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">
                Start from a template
              </span>
              <div className="flex flex-wrap gap-2">
                {NOTE_TEMPLATES.map((tpl) => (
                  <Button
                    key={tpl.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    title={tpl.description}
                    onClick={() => applyTemplate(tpl)}
                  >
                    {tpl.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <label htmlFor="note-content" className="text-sm font-medium">
              Content
            </label>
            <Textarea
              id="note-content"
              value={draft.content}
              onChange={(event) =>
                applyDraft({ content: event.target.value })
              }
              placeholder="Write in Markdown — headings, lists, code fences and links are rendered safely."
              className="min-h-[240px] font-mono text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <label htmlFor="note-phase" className="text-sm font-medium">
                Phase ID
              </label>
              <Input
                id="note-phase"
                value={draft.phaseId}
                onChange={(event) =>
                  applyDraft({ phaseId: event.target.value })
                }
                placeholder="e.g. PH-001"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="note-task" className="text-sm font-medium">
                Task ID
              </label>
              <Input
                id="note-task"
                value={draft.taskId}
                onChange={(event) =>
                  applyDraft({ taskId: event.target.value })
                }
                placeholder="e.g. TSK-001"
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="note-test-case"
                className="text-sm font-medium"
              >
                Test case ID
              </label>
              <Input
                id="note-test-case"
                value={draft.testCaseId}
                onChange={(event) =>
                  applyDraft({ testCaseId: event.target.value })
                }
                placeholder="e.g. TC-001"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="note-tags" className="text-sm font-medium">
              Tags
            </label>
            <Input
              id="note-tags"
              value={draft.tagsText}
              onChange={(event) =>
                applyDraft({ tagsText: event.target.value })
              }
              placeholder="Comma separated, e.g. api, review"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground" role="status">
            {statusLabel}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={runSaveCycle}
            >
              Save now
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NoteEditorDialog;