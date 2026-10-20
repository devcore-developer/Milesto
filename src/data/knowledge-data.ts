import type { DecisionRecord, KnowledgeNote, NoteTemplate } from "@/types";

export const initialNotes: KnowledgeNote[] = [
  {
    id: "NT-01",
    title: "Milestone weighting rules — working agreement",
    content: `# Working agreement

Weights are agreed at planning time and are never changed mid-phase.

## Rules

- [x] Weight range is 1..10
- [x] Blocked tasks keep their weight
- [ ] Review weights at every phase gate

Related: milestone weighting engine task in PRJ-1042.`,
    type: "General",
    tags: ["process", "weighting"],
    links: { projectId: "PRJ-1042" },
    pinned: true,
    favorite: false,
    archived: false,
    isDraft: false,
    attachments: [],
    createdAt: "2024-07-02T09:00:00.000Z",
    updatedAt: "2024-08-01T11:30:00.000Z",
    lastViewedAt: "2024-08-14T08:10:00.000Z",
    author: { name: "Mara Vey", initials: "MV" },
  },
  {
    id: "NT-02",
    title: "Weighting engine — design notes",
    content: `# Weighting engine design

The engine normalizes task weights inside a phase so progress reflects effort, not task count.

## Formula sketch

normalized = task.weight / sum(weights in phase)

## Open questions

- [x] How do blocked tasks affect the denominator?
- [ ] Do cancelled tasks drop out entirely?

See decision DEC-01 in the ledger project for the retry-model counterpart.`,
    type: "Technical",
    tags: ["architecture", "engine"],
    links: { projectId: "PRJ-1042", taskId: "TSK-4821" },
    pinned: false,
    favorite: true,
    archived: false,
    isDraft: false,
    attachments: [],
    createdAt: "2024-07-10T14:20:00.000Z",
    updatedAt: "2024-08-12T16:45:00.000Z",
    lastViewedAt: "2024-08-15T10:05:00.000Z",
    author: { name: "Idris Khan", initials: "IK" },
  },
  {
    id: "NT-03",
    title: "Weekly sync — mobile pipeline",
    content: `# Weekly sync — mobile push pipeline

Date: 2024-08-09
Attendees: Idris Khan, Sam Okafor

## Agenda

- Delivery latency on Android
- Retry policy after the DEC-04 rejection

## Notes

- Android latency improved after batching.
- Vendor SDK contract renewal is due next month.

## Action items

- [ ] Idris: draft vendor renewal summary
- [ ] Sam: capture latency numbers in the dashboard`,
    type: "Meeting",
    tags: ["meeting", "mobile"],
    links: { projectId: "PRJ-1037" },
    pinned: false,
    favorite: false,
    archived: false,
    isDraft: false,
    attachments: [],
    createdAt: "2024-08-09T15:00:00.000Z",
    updatedAt: "2024-08-09T15:42:00.000Z",
    lastViewedAt: "2024-08-13T09:00:00.000Z",
    author: { name: "Idris Khan", initials: "IK" },
  },
  {
    id: "NT-04",
    title: "Ledger reconciliation — investigation summary",
    content: `# Ledger reconciliation investigation

## Symptom

Rounding drift of a few cents appears when retried batches overlap.

## Root cause hypothesis

Retries are not idempotent: the same batch can apply twice under timeout.

## Resolution

Accepted decision DEC-01 introduces an idempotent retry queue.
This note stays open until the fix is verified in staging.`,
    type: "Bug Investigation",
    tags: ["bug", "ledger", "money"],
    links: { projectId: "PRJ-1051", taskId: "TSK-4823" },
    pinned: false,
    favorite: true,
    archived: false,
    isDraft: false,
    attachments: [],
    createdAt: "2024-07-18T10:00:00.000Z",
    updatedAt: "2024-08-10T13:25:00.000Z",
    lastViewedAt: "2024-08-15T09:30:00.000Z",
    author: { name: "Lena Park", initials: "LP" },
  },
  {
    id: "NT-05",
    title: "Edge-case catalogue — reconciliation",
    content: `# Reconciliation edge cases (draft)

Collected cases to cover with tests before Phase 5 sign-off.

- [ ] Overlapping retries within the same minute
- [ ] Currency rounding at half-cent boundaries
- [ ] Ledger replay after manual correction
- [ ] Partial batch failure recovery`,
    type: "Research",
    tags: ["testing", "ledger"],
    links: { projectId: "PRJ-1051" },
    pinned: false,
    favorite: false,
    archived: false,
    isDraft: true,
    attachments: [],
    createdAt: "2024-08-06T12:00:00.000Z",
    updatedAt: "2024-08-07T08:15:00.000Z",
    author: { name: "Lena Park", initials: "LP" },
  },
  {
    id: "NT-06",
    title: "Sprint 14 retrospective — v2 platform",
    content: `# Sprint 14 retrospective

## What went well

- CI pipeline for v2 landed early.
- Quality gates caught two regressions pre-release.

## What to improve

- Task weight estimates drift during the sprint.
- Demo prep starts too late.

## Experiments for next sprint

- [ ] Weight re-check at mid-sprint
- [ ] Demo checklist template`,
    type: "Retrospective",
    tags: ["retro", "process"],
    links: { projectId: "PRJ-1029" },
    pinned: false,
    favorite: false,
    archived: false,
    isDraft: false,
    attachments: [],
    createdAt: "2024-07-28T17:00:00.000Z",
    updatedAt: "2024-07-30T09:10:00.000Z",
    lastViewedAt: "2024-08-11T14:00:00.000Z",
    author: { name: "Sam Okafor", initials: "SO" },
  },
  {
    id: "NT-07",
    title: "Old charting spike notes",
    content: `# Charting spike (superseded)

Early spike notes for the chart legend. Kept for reference only —
the accessibility audit task covers the final behaviour now.`,
    type: "Technical",
    tags: ["charts", "spike"],
    links: { projectId: "PRJ-1056" },
    pinned: false,
    favorite: false,
    archived: true,
    isDraft: false,
    attachments: [],
    createdAt: "2024-06-14T11:00:00.000Z",
    updatedAt: "2024-06-20T15:30:00.000Z",
    author: { name: "Riya Anand", initials: "RA" },
  },
  {
    id: "NT-08",
    title: "Rate-limit middleware — operational runbook",
    content: `# Rate-limit middleware runbook

## Thresholds

- Standard tier: 600 requests / minute
- Burst allowance: 60 requests / 10 seconds

## When limits trip

1. Confirm the tenant id in the log line.
2. Check the burst counter in the metrics dashboard.
3. Escalate to infrastructure if trips repeat within an hour.`,
    type: "Technical",
    tags: ["runbook", "api", "ops"],
    links: { projectId: "PRJ-1029", taskId: "TSK-4824" },
    pinned: true,
    favorite: true,
    archived: false,
    isDraft: false,
    attachments: [],
    createdAt: "2024-07-05T08:30:00.000Z",
    updatedAt: "2024-08-14T10:20:00.000Z",
    lastViewedAt: "2024-08-15T11:45:00.000Z",
    author: { name: "Sam Okafor", initials: "SO" },
  },
];

export const initialDecisions: DecisionRecord[] = [
  {
    id: "DEC-02",
    title: "Use cron-based retries for ledger jobs",
    description: "Retry failed reconciliation batches with a nightly cron window.",
    context:
      "Retries were originally manual. A nightly cron was proposed as the cheapest automated path.",
    options: [
      { title: "Nightly cron window", description: "Retry all failed batches at 02:00." },
      { title: "Keep manual retries", description: "Operator triggers retries from a script." },
    ],
    selectedOption: "Nightly cron window",
    rationale: "Cheapest to implement and no new infrastructure required.",
    consequences:
      "Up to 24h delay before a failed batch is retried; overlapping retries still possible.",
    links: { projectId: "PRJ-1051" },
    status: "Superseded",
    decidedAt: "2024-06-20",
    author: { name: "Lena Park", initials: "LP" },
    supersededById: "DEC-01",
    createdAt: "2024-06-20T09:00:00.000Z",
    updatedAt: "2024-07-15T10:00:00.000Z",
  },
  {
    id: "DEC-01",
    title: "Adopt idempotent retry queue for ledger reconciliation",
    description:
      "Replace cron-based retries with an idempotent, keyed retry queue for reconciliation batches.",
    context:
      "Overlapping retries caused rounding drift in the ledger (see note NT-04). Cron retries could apply the same batch twice after a timeout.",
    options: [
      { title: "In-process retry loop", description: "Retry inside the worker process." },
      { title: "Idempotent retry queue", description: "Keyed queue that skips already-applied batches." },
      { title: "Manual re-run scripts", description: "Keep retries manual with a safer script." },
    ],
    selectedOption: "Idempotent retry queue",
    rationale:
      "Only the keyed queue removes double-application entirely, and it keeps retry latency low.",
    consequences:
      "New queue infrastructure to operate; batch keys must be stable; migration from cron retries needed.",
    links: { projectId: "PRJ-1051", taskId: "TSK-4829" },
    status: "Accepted",
    decidedAt: "2024-07-15",
    author: { name: "Lena Park", initials: "LP" },
    createdAt: "2024-07-15T10:00:00.000Z",
    updatedAt: "2024-07-15T10:00:00.000Z",
  },
  {
    id: "DEC-03",
    title: "Introduce weighted milestone completion for reporting",
    description: "Report milestone progress weighted by task effort instead of task count.",
    context:
      "Executive reporting currently averages task completion, which hides heavy tasks behind many small ones.",
    options: [
      { title: "Weighted completion", description: "Weight by task weight inside each phase." },
      { title: "Keep simple average", description: "No change to reporting maths." },
    ],
    links: { projectId: "PRJ-1042", taskId: "TSK-4821" },
    status: "Proposed",
    decidedAt: "2024-08-05",
    author: { name: "Mara Vey", initials: "MV" },
    createdAt: "2024-08-05T12:00:00.000Z",
    updatedAt: "2024-08-05T12:00:00.000Z",
  },
  {
    id: "DEC-04",
    title: "Build an in-house push notification service",
    description: "Replace the vendor SDK with an in-house push delivery service.",
    context: "Vendor pricing grows with volume; the team evaluated owning delivery end to end.",
    options: [
      { title: "In-house service", description: "Own delivery, retries and device management." },
      { title: "Stay with vendor", description: "Renew the vendor contract." },
    ],
    selectedOption: "Stay with vendor",
    rationale:
      "Delivery SLAs and device-fragmentation cost outweigh the licence savings for the current scale.",
    consequences: "Revisit if vendor pricing changes at next renewal; contract due next month.",
    links: { projectId: "PRJ-1037" },
    status: "Rejected",
    decidedAt: "2024-07-22",
    author: { name: "Idris Khan", initials: "IK" },
    createdAt: "2024-07-22T09:30:00.000Z",
    updatedAt: "2024-07-22T09:30:00.000Z",
  },
];

export const builtinNoteTemplates: NoteTemplate[] = [
  {
    id: "TPL-01",
    name: "Meeting Notes",
    noteType: "Meeting",
    description: "Agenda, discussion, decisions and action items.",
    titlePrefix: "Meeting — ",
    contentTemplate: `# Meeting: (title)

Date:
Attendees:

## Agenda

- 

## Notes

- 

## Decisions

- 

## Action items

- [ ] `,
    isBuiltin: true,
  },
  {
    id: "TPL-02",
    name: "Technical Investigation",
    noteType: "Technical",
    description: "Structured investigation with findings and next steps.",
    titlePrefix: "Investigation — ",
    contentTemplate: `# Investigation: (topic)

## Question

What exactly are we trying to answer?

## Evidence

- 

## Findings

- 

## Next steps

- [ ] `,
    isBuiltin: true,
  },
  {
    id: "TPL-03",
    name: "Bug Investigation",
    noteType: "Bug Investigation",
    description: "Symptom, root cause, fix and verification.",
    titlePrefix: "Bug — ",
    contentTemplate: `# Bug investigation: (title)

## Symptom

## Reproduction steps

1. 
2. 

## Root cause

## Fix

## Verification

- [ ] Verified locally
- [ ] Regression test added`,
    isBuiltin: true,
  },
  {
    id: "TPL-04",
    name: "Project Retrospective",
    noteType: "Retrospective",
    description: "Went well / to improve / experiments.",
    titlePrefix: "Retrospective — ",
    contentTemplate: `# Retrospective: (project or sprint)

## What went well

- 

## What to improve

- 

## Experiments for next cycle

- [ ] `,
    isBuiltin: true,
  },
  {
    id: "TPL-05",
    name: "Architecture Decision Record",
    noteType: "Decision",
    description: "Mirror of the decision log fields in note form.",
    titlePrefix: "ADR — ",
    contentTemplate: `# ADR: (decision title)

## Context

## Options considered

1. 
2. 

## Selected option

## Rationale

## Consequences and trade-offs`,
    isBuiltin: true,
  },
  {
    id: "TPL-06",
    name: "General Note",
    noteType: "General",
    description: "Blank structured note.",
    titlePrefix: "",
    contentTemplate: `# (title)

- [ ] 
- [ ] `,
    isBuiltin: true,
  },
];