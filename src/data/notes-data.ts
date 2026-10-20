import type { KnowledgeNote } from "@/types/notes";

// In-memory seed notes — same persistence model as the rest of Milesto
// (resets on refresh, documented limitation for this phase).
//
// NOTE: notes are linked to "PRJ-1042". If your seeded project ids differ,
// adjust the links below (or send me the first lines of src/data/projects.ts
// and I will align them for you).
export const initialNotes: KnowledgeNote[] = [
  {
    id: "NT-001",
    title: "Kickoff scope alignment",
    type: "Meeting",
    content: `## Attendees

- Mara Vey (PM)
- Delivery team

## Agenda

1. Confirm delivery phases and milestones
2. Testing expectations per phase
3. Reporting cadence

## Notes

- Quality gates will be evaluated at the end of every phase.
- Progress is weighted by phase weight, not by task count.

## Action items

- Mara — draft quality gate criteria per phase`,
    tags: ["kickoff", "scope"],
    links: { projectId: "PRJ-1042" },
    author: "Mara Vey",
    createdAt: "2025-09-02T09:00:00.000Z",
    updatedAt: "2025-09-02T10:30:00.000Z",
  },
  {
    id: "NT-002",
    title: "Pass-rate calculation contract",
    type: "Technical",
    content: `## Context

The quality gate needs one honest pass-rate number.

## Chosen approach

Pass rate = Pass / (Pass + Fail).

Runs with status Not Run, Skipped or Blocked are excluded from the
denominator so they never inflate or deflate the result.

## Trade-offs and risks

- A case that was never executed is invisible in the rate — that is why
  the gate also reports executed/notRun counts separately.`,
    tags: ["testing", "quality"],
    links: { projectId: "PRJ-1042" },
    author: "Mara Vey",
    createdAt: "2025-09-20T08:00:00.000Z",
    updatedAt: "2025-09-20T09:10:00.000Z",
  },
  {
    id: "NT-003",
    title: "Track bugs directly on test executions",
    type: "Decision",
    content: `## Decision

Store bug information as fields on each test execution record.

## Context and drivers

Fewer entities to manage in the first iteration.

## Consequences

- Bugs cannot be tracked independently of a single run.
- Reopen workflows are not representable.`,
    tags: ["bugs", "workflow"],
    links: { projectId: "PRJ-1042" },
    decision: {
      status: "Superseded",
      decidedBy: "Mara Vey",
      decidedAt: "2025-09-05T14:00:00.000Z",
    },
    author: "Mara Vey",
    createdAt: "2025-09-05T13:40:00.000Z",
    updatedAt: "2025-10-01T11:00:00.000Z",
  },
  {
    id: "NT-004",
    title: "Weighted phase progress model",
    type: "Technical",
    content: `## Context

Project progress must reflect phase importance, not raw task counts.

## Chosen approach

Each phase carries a weight; the project progress is the weighted sum of
phase progress values. Task progress stays independent and is never
modified by the knowledge features.

## Trade-offs and risks

- Weights must be kept meaningful when phases are added late.`,
    tags: ["planning", "progress"],
    links: { projectId: "PRJ-1042" },
    author: "Mara Vey",
    createdAt: "2025-09-15T10:00:00.000Z",
    updatedAt: "2025-09-15T10:45:00.000Z",
  },
  {
    id: "NT-005",
    title: "Gate shows Not Ready despite green runs",
    type: "Bug Investigation",
    content: `## Symptom

A phase gate reported Not Ready while all executed cases passed.

## Reproduction steps

1. Execute the only existing case with status Pass.
2. Create the gate for the phase and evaluate readiness.

## Root cause

The remaining cases were still Not Run, so executed coverage was below
the gate criteria — the engine was correct, expectations were not.

## Fix and follow-up

- Clarified in the dashboard that pass rate excludes Not Run runs.
- Added explicit executed/notRun metrics to the gate report.`,
    tags: ["gates", "testing"],
    links: { projectId: "PRJ-1042" },
    author: "Mara Vey",
    createdAt: "2025-09-28T09:30:00.000Z",
    updatedAt: "2025-09-28T12:00:00.000Z",
  },
  {
    id: "NT-006",
    title: "Use a dedicated bug register",
    type: "Decision",
    content: `## Decision

Bugs live in their own register with a status workflow (Open,
In Progress, Retest, Closed) and are referenced from executions.

## Context and drivers

Supersedes tracking bugs on execution records: reopen workflows and
independent triage were not representable.

## Consequences

- Executions keep an optional bugId reference.
- Gate metrics can count open critical/high bugs per phase.`,
    tags: ["bugs", "workflow"],
    links: { projectId: "PRJ-1042" },
    decision: {
      status: "Accepted",
      decidedBy: "Mara Vey",
      decidedAt: "2025-10-01T11:00:00.000Z",
      supersedesId: "NT-003",
    },
    author: "Mara Vey",
    createdAt: "2025-10-01T10:50:00.000Z",
    updatedAt: "2025-10-01T11:00:00.000Z",
  },
  {
    id: "NT-007",
    title: "Testing phase retrospective",
    type: "Retrospective",
    content: `## What went well

- Append-only execution history made audits trivial.
- Honest pass rate avoided inflated reporting.

## What did not

- Archiving test cases with history needs clearer messaging in the UI.

## Lessons learned

- Guard rails belong in the UI layer where the user acts.

## Actions for next phase

- Mara — surface related notes on tasks and phases.`,
    tags: ["retrospective", "testing"],
    links: { projectId: "PRJ-1042" },
    author: "Mara Vey",
    createdAt: "2025-09-26T16:00:00.000Z",
    updatedAt: "2025-09-26T16:40:00.000Z",
  },
  {
    id: "NT-008",
    title: "Lightweight Markdown rendering options",
    type: "Research",
    content: `## Question

How do we render note Markdown without pulling a heavy editor or
renderer dependency into the bundle?

## Findings

- Full editors are overkill for read-mostly knowledge notes.
- A small custom renderer covers headings, lists, quotes, code fences,
  bold, italic, code and links.
- Rendering to React elements keeps React auto-escaping as the XSS
  boundary — no HTML injection path at all.

## Recommendation

Use a small sanitized renderer in @/lib/markdown with an http(s)-only
link whitelist. Revisit only if tables or images become requirements.`,
    tags: ["research", "frontend"],
    links: {},
    author: "Mara Vey",
    createdAt: "2025-09-22T11:00:00.000Z",
    updatedAt: "2025-09-22T11:30:00.000Z",
  },
];