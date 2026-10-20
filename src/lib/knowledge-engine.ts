import type {
  DecisionRecord,
  DecisionStatus,
  KnowledgeNote,
  NoteTemplate,
  NoteType,
} from "@/types";

export const NOTE_TYPES: NoteType[] = [
  "General",
  "Technical",
  "Meeting",
  "Decision",
  "Bug Investigation",
  "Research",
  "Retrospective",
];

export const DECISION_STATUSES: DecisionStatus[] = [
  "Proposed",
  "Accepted",
  "Rejected",
  "Superseded",
];

/** Bug statuses are for testing; knowledge notes just use plain tags. */
export const MAX_NOTE_TAGS = 12;
export const MAX_CONTENT_LENGTH = 100_000;
export const MIN_TITLE_LENGTH = 3;
export const MIN_OVERRIDE_REASON = 10; // not used here; documents Phase 5 rule placement

// ---------- Validation ----------

export interface NoteDraftInput {
  title: string;
  type: NoteType;
  tags: string[];
  content?: string;
}

export function validateNoteDraft(input: NoteDraftInput): string[] {
  const errors: string[] = [];
  const title = String(input.title ?? "").trim();
  if (title.length < MIN_TITLE_LENGTH) {
    errors.push(`Title must be at least ${MIN_TITLE_LENGTH} characters.`);
  }
  if (title.length > 120) {
    errors.push("Title must be 120 characters or fewer.");
  }
  if (!NOTE_TYPES.includes(input.type)) {
    errors.push("Note type is not recognized.");
  }
  if (input.tags.length > MAX_NOTE_TAGS) {
    errors.push(`A note can have at most ${MAX_NOTE_TAGS} tags.`);
  }
  const content = String(input.content ?? "");
  if (content.length > MAX_CONTENT_LENGTH) {
    errors.push("Note content is too long.");
  }
  return errors;
}

export interface DecisionDraftInput {
  title: string;
  context: string;
  options: { title: string }[];
  selectedOption?: string;
  status: DecisionStatus;
}

export function validateDecisionDraft(input: DecisionDraftInput): string[] {
  const errors: string[] = [];
  if (String(input.title ?? "").trim().length < MIN_TITLE_LENGTH) {
    errors.push(`Decision title must be at least ${MIN_TITLE_LENGTH} characters.`);
  }
  if (!String(input.context ?? "").trim()) {
    errors.push("Decision context (the problem) is required.");
  }
  if (!input.options || input.options.length === 0) {
    errors.push("At least one option must be recorded.");
  }
  if (
    (input.status === "Accepted" || input.status === "Rejected") &&
    !input.options.some((option) => option.title === input.selectedOption)
  ) {
    errors.push("Selected option must match one of the recorded options.");
  }
  return errors;
}

// ---------- Tags ----------

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = String(raw ?? "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_NOTE_TAGS) break;
  }
  return result;
}

// ---------- Filtering ----------

export interface NoteFilters {
  query?: string;
  projectId?: string;
  type?: NoteType;
  tag?: string;
  pinnedOnly?: boolean;
  favoritesOnly?: boolean;
  includeArchived?: boolean;
  draftsOnly?: boolean;
}

export function filterNotes(notes: KnowledgeNote[], filters: NoteFilters = {}): KnowledgeNote[] {
  const query = (filters.query ?? "").trim().toLowerCase();
  const tag = (filters.tag ?? "").trim().toLowerCase();

  return notes.filter((note) => {
    if (!filters.includeArchived && note.archived) return false;
    if (filters.draftsOnly && !note.isDraft) return false;
    if (filters.pinnedOnly && !note.pinned) return false;
    if (filters.favoritesOnly && !note.favorite) return false;
    if (filters.projectId && note.links.projectId !== filters.projectId) return false;
    if (filters.type && note.type !== filters.type) return false;
    if (tag && !note.tags.some((item) => item.toLowerCase() === tag)) return false;
    if (query) {
      const haystack = [
        note.title,
        note.content,
        note.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortNotesByUpdated(notes: KnowledgeNote[]): KnowledgeNote[] {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ---------- Dashboard statistics ----------

export interface KnowledgeStats {
  total: number;
  archived: number;
  pinned: number;
  favorites: number;
  drafts: number;
  byProject: { projectId: string; count: number }[];
  byType: { type: NoteType; count: number }[];
  recentlyUpdated: KnowledgeNote[];
  recentlyViewed: KnowledgeNote[];
}

/**
 * All KPIs are derived from the ACTUAL note list (spec §2).
 * "total" counts active (non-archived) notes; archived notes are reported separately.
 */
export function getKnowledgeStats(notes: KnowledgeNote[]): KnowledgeStats {
  const active = notes.filter((note) => !note.archived);

  const projectCounts = new Map<string, number>();
  for (const note of active) {
    const projectId = note.links.projectId;
    if (!projectId) continue;
    projectCounts.set(projectId, (projectCounts.get(projectId) ?? 0) + 1);
  }
  const byProject = [...projectCounts.entries()]
    .map(([projectId, count]) => ({ projectId, count }))
    .sort((a, b) => b.count - a.count);

  const typeCounts = new Map<NoteType, number>();
  for (const note of active) {
    typeCounts.set(note.type, (typeCounts.get(note.type) ?? 0) + 1);
  }
  const byType = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: active.length,
    archived: notes.length - active.length,
    pinned: active.filter((note) => note.pinned).length,
    favorites: active.filter((note) => note.favorite).length,
    drafts: active.filter((note) => note.isDraft).length,
    byProject,
    byType,
    recentlyUpdated: sortNotesByUpdated(active).slice(0, 5),
    recentlyViewed: active
      .filter((note) => Boolean(note.lastViewedAt))
      .sort((a, b) => (b.lastViewedAt ?? "").localeCompare(a.lastViewedAt ?? ""))
      .slice(0, 5),
  };
}

// ---------- Global search ----------

export interface KnowledgeSearchResult {
  notes: KnowledgeNote[];
  decisions: DecisionRecord[];
}

/**
 * Searches note titles, content, tags and linked project names, plus
 * decision titles, descriptions and context. `projectNames` maps
 * projectId -> display name and is joined by the caller.
 */
export function searchKnowledge(
  notes: KnowledgeNote[],
  decisions: DecisionRecord[],
  query: string,
  projectNames?: Record<string, string>,
): KnowledgeSearchResult {
  const q = query.trim().toLowerCase();
  const activeNotes = notes.filter((note) => !note.archived);

  if (!q) {
    return { notes: activeNotes, decisions };
  }

  const matchedNotes = activeNotes.filter((note) => {
    const projectName = note.links.projectId ? projectNames?.[note.links.projectId] : undefined;
    const haystack = [note.title, note.content, note.tags.join(" "), projectName ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  const matchedDecisions = decisions.filter((decision) => {
    const projectName = decision.links.projectId ? projectNames?.[decision.links.projectId] : undefined;
    const haystack = [
      decision.title,
      decision.description,
      decision.context,
      decision.rationale ?? "",
      projectName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return { notes: matchedNotes, decisions: matchedDecisions };
}

// ---------- Decision lifecycle ----------

export const DECISION_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  Proposed: ["Accepted", "Rejected", "Superseded"],
  Accepted: ["Superseded"],
  Rejected: [],
  Superseded: [],
};

export function getAllowedNextStatuses(status: DecisionStatus): DecisionStatus[] {
  return DECISION_TRANSITIONS[status] ?? [];
}

export function canTransitionDecision(from: DecisionStatus, to: DecisionStatus): boolean {
  return getAllowedNextStatuses(from).includes(to);
}

/**
 * Returns a NEW record marked Superseded with a permanent link to its
 * replacement. The original context is never erased (spec §4):
 * callers keep the previous record in the log and only patch these fields.
 */
export function supersedeDecision(
  previous: DecisionRecord,
  replacementId: string,
): DecisionRecord {
  return {
    ...previous,
    status: "Superseded",
    supersededById: replacementId,
    updatedAt: new Date().toISOString(),
  };
}

/** Full historical timeline — accepted, rejected and superseded all remain. */
export function getDecisionTimeline(decisions: DecisionRecord[]): DecisionRecord[] {
  return [...decisions].sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
}

export interface SupersedeChain {
  previous?: DecisionRecord;
  replacement?: DecisionRecord;
}

export function getSupersedeChain(
  decisions: DecisionRecord[],
  decisionId: string,
): SupersedeChain {
  const current = decisions.find((decision) => decision.id === decisionId);
  if (!current) return {};
  const previous = decisions.find((decision) => decision.supersededById === current.id);
  const replacement = current.supersededById
    ? decisions.find((decision) => decision.id === current.supersededById)
    : undefined;
  return { previous, replacement };
}

// ---------- Templates ----------

export interface NoteDraft {
  title: string;
  content: string;
  type: NoteType;
  tags: string[];
}

/**
 * Templates prefill STRUCTURE only — no fake content (spec §6).
 * The user edits everything freely afterwards.
 */
export function createDraftFromTemplate(template: NoteTemplate): NoteDraft {
  return {
    title: template.titlePrefix ?? "",
    content: template.contentTemplate,
    type: template.noteType,
    tags: [],
  };
}