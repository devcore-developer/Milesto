"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DecisionStatus, KnowledgeNote, NoteLinks, NoteSeed } from "@/types/notes";

const DEFAULT_AUTHOR = "Mara Vey";

function nextNoteId(notes: KnowledgeNote[]): string {
  let max = 0;
  for (const note of notes) {
    const match = /^NT-(\d+)$/.exec(note.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `NT-${String(max + 1).padStart(3, "0")}`;
}

function sortByRecency(notes: KnowledgeNote[]): KnowledgeNote[] {
  return [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function matchesToken(note: KnowledgeNote, token: string): boolean {
  return (
    note.title.toLowerCase().includes(token) ||
    note.content.toLowerCase().includes(token) ||
    note.tags.some((tag) => tag.toLowerCase().includes(token))
  );
}

export type NotePatch = Partial<Omit<KnowledgeNote, "id" | "createdAt" | "updatedAt">>;

export type RelatedNoteRefs = NoteLinks;

export interface NotesContextValue {
  notes: KnowledgeNote[];
  createNote: (seed: NoteSeed) => KnowledgeNote;
  updateNote: (id: string, patch: NotePatch) => void;
  deleteNote: (id: string) => boolean;
  getNotesByProject: (projectId: string) => KnowledgeNote[];
  getRelatedNotes: (refs: RelatedNoteRefs) => KnowledgeNote[];
  searchNotes: (query: string, scope?: KnowledgeNote[]) => KnowledgeNote[];
  setDecisionStatus: (id: string, status: DecisionStatus, actor?: string) => void;
  supersedeDecision: (previousId: string, seed: NoteSeed) => KnowledgeNote | null;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);

  const createNote = useCallback(
    (seed: NoteSeed): KnowledgeNote => {
      const now = new Date().toISOString();
      const note: KnowledgeNote = {
        id: nextNoteId(notes),
        title: seed.title?.trim() || "Untitled note",
        type: seed.type ?? "General",
        content: seed.content ?? "",
        tags: seed.tags ?? [],
        links: seed.links ?? {},
        ...(seed.decision ? { decision: seed.decision } : {}),
        author: seed.author ?? DEFAULT_AUTHOR,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [note, ...prev]);
      return note;
    },
    [notes]
  );

  const updateNote = useCallback((id: string, patch: NotePatch) => {
    setNotes((prev) =>
      prev.map((note) => {
        if (note.id !== id) return note;
        const { decision, ...rest } = patch;
        return {
          ...note,
          ...rest,
          // Deep-merge decision metadata so autosaved status changes never
          // wipe decidedBy/decidedAt/supersedesId history fields.
          ...(decision ? { decision: { ...note.decision, ...decision } } : {}),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const deleteNote = useCallback(
    (id: string): boolean => {
      const exists = notes.some((note) => note.id === id);
      if (exists) setNotes((prev) => prev.filter((note) => note.id !== id));
      return exists;
    },
    [notes]
  );

  const getNotesByProject = useCallback(
    (projectId: string) => sortByRecency(notes.filter((note) => note.links.projectId === projectId)),
    [notes]
  );

  const getRelatedNotes = useCallback(
    (refs: RelatedNoteRefs) =>
      sortByRecency(
        notes.filter(
          (note) =>
            (refs.projectId !== undefined && note.links.projectId === refs.projectId) ||
            (refs.phaseId !== undefined && note.links.phaseId === refs.phaseId) ||
            (refs.taskId !== undefined && note.links.taskId === refs.taskId) ||
            (refs.testCaseId !== undefined && note.links.testCaseId === refs.testCaseId)
        )
      ),
    [notes]
  );

  const searchNotes = useCallback(
    (query: string, scope?: KnowledgeNote[]) => {
      const source = scope ?? notes;
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return sortByRecency(source);
      return sortByRecency(source.filter((note) => tokens.every((token) => matchesToken(note, token))));
    },
    [notes]
  );

  const setDecisionStatus = useCallback((id: string, status: DecisionStatus, actor?: string) => {
    setNotes((prev) =>
      prev.map((note) => {
        if (note.id !== id) return note;
        const now = new Date().toISOString();
        const decided = status === "Accepted" || status === "Rejected";
        return {
          ...note,
          decision: {
            status,
            supersedesId: note.decision?.supersedesId,
            ...(decided
              ? { decidedBy: actor ?? note.decision?.decidedBy ?? DEFAULT_AUTHOR, decidedAt: now }
              : {}),
          },
          updatedAt: now,
        };
      })
    );
  }, []);

  // Superseding keeps the full history: the previous decision is never
  // deleted, it is only marked as "Superseded" and the new record points
  // back to it through supersedesId.
  const supersedeDecision = useCallback(
    (previousId: string, seed: NoteSeed): KnowledgeNote | null => {
      const previous = notes.find((note) => note.id === previousId);
      if (!previous) return null;
      const now = new Date().toISOString();
      const replacement: KnowledgeNote = {
        id: nextNoteId(notes),
        title: seed.title?.trim() || previous.title,
        type: "Decision",
        content: seed.content ?? "",
        tags: seed.tags ?? previous.tags,
        links: seed.links ?? previous.links,
        decision: {
          status: "Accepted",
          supersedesId: previousId,
          decidedBy: seed.author ?? DEFAULT_AUTHOR,
          decidedAt: now,
        },
        author: seed.author ?? DEFAULT_AUTHOR,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [
        replacement,
        ...prev.map((note) =>
          note.id === previousId
            ? {
                ...note,
                decision: { ...note.decision, status: "Superseded" as DecisionStatus },
                updatedAt: now,
              }
            : note
        ),
      ]);
      return replacement;
    },
    [notes]
  );

  const value = useMemo<NotesContextValue>(
    () => ({
      notes,
      createNote,
      updateNote,
      deleteNote,
      getNotesByProject,
      getRelatedNotes,
      searchNotes,
      setDecisionStatus,
      supersedeDecision,
    }),
    [
      notes,
      createNote,
      updateNote,
      deleteNote,
      getNotesByProject,
      getRelatedNotes,
      searchNotes,
      setDecisionStatus,
      supersedeDecision,
    ]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within a NotesProvider");
  return ctx;
}