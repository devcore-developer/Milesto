import { DECISION_STATUSES, NOTE_TYPES } from "@/types/notes";
import type { DecisionStatus, KnowledgeNote, KnowledgeNoteType, NoteLinks } from "@/types/notes";

// Pure, framework-free helpers for the Notes & Knowledge Center.
// Everything here is testable without React or providers.

export interface NoteQuery {
  query?: string;
  type?: KnowledgeNoteType | "All";
  projectId?: string;
  phaseId?: string;
  taskId?: string;
  testCaseId?: string;
  tag?: string;
  includeArchived?: boolean;
}

export function isArchived(note: KnowledgeNote): boolean {
  return note.archived === true;
}

export function isLinked(note: KnowledgeNote): boolean {
  return Boolean(
    note.links.projectId || note.links.phaseId || note.links.taskId || note.links.testCaseId
  );
}

export function sortNotesByRecency(notes: KnowledgeNote[]): KnowledgeNote[] {
  return [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function matchesToken(note: KnowledgeNote, token: string): boolean {
  return (
    note.title.toLowerCase().includes(token) ||
    note.content.toLowerCase().includes(token) ||
    note.tags.some((tag) => tag.toLowerCase().includes(token))
  );
}

export function filterNotes(notes: KnowledgeNote[], filter: NoteQuery = {}): KnowledgeNote[] {
  let result = notes.filter((note) => (filter.includeArchived ? true : !isArchived(note)));

  if (filter.type && filter.type !== "All") {
    const type = filter.type;
    result = result.filter((note) => note.type === type);
  }
  if (filter.projectId) {
    const projectId = filter.projectId;
    result = result.filter((note) => note.links.projectId === projectId);
  }
  if (filter.phaseId) {
    const phaseId = filter.phaseId;
    result = result.filter((note) => note.links.phaseId === phaseId);
  }
  if (filter.taskId) {
    const taskId = filter.taskId;
    result = result.filter((note) => note.links.taskId === taskId);
  }
  if (filter.testCaseId) {
    const testCaseId = filter.testCaseId;
    result = result.filter((note) => note.links.testCaseId === testCaseId);
  }
  if (filter.tag) {
    const tag = filter.tag.toLowerCase();
    result = result.filter((note) => note.tags.some((item) => item.toLowerCase() === tag));
  }
  if (filter.query && filter.query.trim() !== "") {
    const tokens = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
    result = result.filter((note) => tokens.every((token) => matchesToken(note, token)));
  }

  return sortNotesByRecency(result);
}

export function countByType(notes: KnowledgeNote[]): Record<KnowledgeNoteType, number> {
  const counts = NOTE_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as Record<KnowledgeNoteType, number>);
  for (const note of notes) counts[note.type] += 1;
  return counts;
}

export function decisionStatusCounts(notes: KnowledgeNote[]): Record<DecisionStatus, number> {
  const counts = DECISION_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<DecisionStatus, number>);
  for (const note of notes) {
    if (note.decision) counts[note.decision.status] += 1;
  }
  return counts;
}

export function getDecisionNotes(notes: KnowledgeNote[]): KnowledgeNote[] {
  return notes
    .filter((note) => note.type === "Decision")
    .sort((a, b) => {
      const aKey = a.decision?.decidedAt ?? a.updatedAt;
      const bKey = b.decision?.decidedAt ?? b.updatedAt;
      return aKey < bKey ? 1 : -1;
    });
}

export function findRelatedNotes(notes: KnowledgeNote[], refs: NoteLinks): KnowledgeNote[] {
  return sortNotesByRecency(
    notes.filter(
      (note) =>
        (refs.projectId !== undefined && note.links.projectId === refs.projectId) ||
        (refs.phaseId !== undefined && note.links.phaseId === refs.phaseId) ||
        (refs.taskId !== undefined && note.links.taskId === refs.taskId) ||
        (refs.testCaseId !== undefined && note.links.testCaseId === refs.testCaseId)
    )
  );
}

export function linkedNotesCount(notes: KnowledgeNote[]): number {
  return notes.filter(isLinked).length;
}

export function recentlyUpdatedCount(notes: KnowledgeNote[], days = 7): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return notes.filter((note) => new Date(note.updatedAt).getTime() >= cutoff).length;
}

export function notePreview(markdown: string, max = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " [code block] ")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}