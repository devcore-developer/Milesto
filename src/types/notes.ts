// Phase 6 — Notes & Knowledge Center domain types.

export const NOTE_TYPES = [
  "General",
  "Technical",
  "Meeting",
  "Decision",
  "Bug Investigation",
  "Research",
  "Retrospective",
] as const;

export type KnowledgeNoteType = (typeof NOTE_TYPES)[number];

export const DECISION_STATUSES = ["Proposed", "Accepted", "Rejected", "Superseded"] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** Optional links from a note to any existing Milesto entity (string ids). */
export interface NoteLinks {
  projectId?: string;
  phaseId?: string;
  taskId?: string;
  testCaseId?: string;
}

/** Extra metadata carried by notes of type "Decision". */
export interface DecisionMeta {
  status: DecisionStatus;
  decidedBy?: string;
  decidedAt?: string;
  /** Id of the decision note this one replaces (kept for history chains). */
  supersedesId?: string;
}

export interface KnowledgeNote {
  id: string;
  title: string;
  type: KnowledgeNoteType;
  /** Markdown source — always rendered through the sanitized MarkdownView. */
  content: string;
  tags: string[];
  links: NoteLinks;
  decision?: DecisionMeta;
  author: string;
  createdAt: string;
  updatedAt: string;
  /** Soft-archive flag — archived notes are hidden from default views. */
  archived?: boolean;
}

/** Input accepted by createNote — ids and timestamps are derived, never supplied. */
export interface NoteSeed {
  title?: string;
  type?: KnowledgeNoteType;
  content?: string;
  tags?: string[];
  links?: NoteLinks;
  decision?: DecisionMeta;
  author?: string;
}