import type { KnowledgeNoteType } from "@/types/notes";

export interface NoteTemplate {
  id: string;
  name: string;
  type: KnowledgeNoteType;
  description: string;
  /** Markdown body applied to the editor when the template is picked. */
  content: string;
}

// Six reusable templates. "General" intentionally has no template —
// it is the blank-note option.
export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "TPL-001",
    name: "Technical Design Note",
    type: "Technical",
    description: "Context, options, chosen approach and trade-offs for an implementation.",
    content: `## Context

Describe the problem, the constraints and the component or system affected.

## Options considered

1. **Option A** —
2. **Option B** —

## Chosen approach

What we will do and why it wins.

## Trade-offs and risks

- `,
  },
  {
    id: "TPL-002",
    name: "Meeting Notes",
    type: "Meeting",
    description: "Attendees, agenda, discussion notes and action items.",
    content: `## Attendees

- 

## Agenda

1. 

## Notes

- 

## Action items

- Owner — action`,
  },
  {
    id: "TPL-003",
    name: "Decision Record",
    type: "Decision",
    description: "What was decided, why, and what it commits us to.",
    content: `## Decision

One or two sentences stating what was decided.

## Context and drivers

Why this decision is needed now.

## Consequences

What this commits us to, and what we give up.`,
  },
  {
    id: "TPL-004",
    name: "Bug Investigation",
    type: "Bug Investigation",
    description: "Symptom, reproduction steps, root cause and follow-up.",
    content: `## Symptom

What was observed, where and when.

## Reproduction steps

1. 

## Root cause

What actually went wrong.

## Fix and follow-up

- `,
  },
  {
    id: "TPL-005",
    name: "Research Summary",
    type: "Research",
    description: "Question, findings, sources and a recommendation.",
    content: `## Question

What are we trying to answer?

## Findings

- 

## Sources

- Source name — https://example.com

## Recommendation

What we should do based on this research.`,
  },
  {
    id: "TPL-006",
    name: "Retrospective",
    type: "Retrospective",
    description: "What went well, what did not, lessons and next actions.",
    content: `## What went well

- 

## What did not

- 

## Lessons learned

- 

## Actions for next phase

- Owner — action`,
  },
];