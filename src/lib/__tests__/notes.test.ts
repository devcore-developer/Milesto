import { describe, expect, it } from "vitest";
import {
  countByType,
  decisionStatusCounts,
  filterNotes,
  findRelatedNotes,
  getDecisionNotes,
  notePreview,
  recentlyUpdatedCount,
} from "../notes-logic";
import type { KnowledgeNote } from "../../types/notes";

let counter = 0;

function makeNote(overrides: Partial<KnowledgeNote> = {}): KnowledgeNote {
  counter += 1;
  const base: KnowledgeNote = {
    id: `NT-${String(counter).padStart(3, "0")}`,
    title: `Note ${counter}`,
    type: "General",
    content: "Some content",
    tags: [],
    links: {},
    author: "Mara Vey",
    createdAt: "2025-09-01T09:00:00.000Z",
    updatedAt: "2025-09-01T09:00:00.000Z",
  };
  return { ...base, ...overrides };
}

describe("filterNotes", () => {
  const notes = [
    makeNote({
      id: "NT-001",
      type: "Decision",
      tags: ["architecture"],
      links: { projectId: "PRJ-1" },
      updatedAt: "2025-10-01T09:00:00.000Z",
      decision: { status: "Accepted" },
    }),
    makeNote({ id: "NT-002", type: "Meeting", links: { projectId: "PRJ-1" }, updatedAt: "2025-10-02T09:00:00.000Z" }),
    makeNote({ id: "NT-003", type: "Research", links: { projectId: "PRJ-2" }, updatedAt: "2025-10-03T09:00:00.000Z" }),
    makeNote({ id: "NT-004", archived: true, updatedAt: "2025-10-04T09:00:00.000Z" }),
  ];

  it("excludes archived notes by default and sorts by recency", () => {
    expect(filterNotes(notes, {}).map((note) => note.id)).toEqual(["NT-003", "NT-002", "NT-001"]);
  });

  it("includes archived notes when requested", () => {
    expect(filterNotes(notes, { includeArchived: true }).map((note) => note.id)).toEqual([
      "NT-004",
      "NT-003",
      "NT-002",
      "NT-001",
    ]);
  });

  it("filters by type", () => {
    expect(filterNotes(notes, { type: "Decision" }).map((note) => note.id)).toEqual(["NT-001"]);
  });

  it("filters by project link", () => {
    expect(filterNotes(notes, { projectId: "PRJ-1" }).map((note) => note.id)).toEqual(["NT-002", "NT-001"]);
  });

  it("filters by tag case-insensitively", () => {
    expect(filterNotes(notes, { tag: "ARCHITECTURE" }).map((note) => note.id)).toEqual(["NT-001"]);
  });

  it("requires every query token to match title, content or tags", () => {
    const searchable = [
      makeNote({ id: "NT-010", title: "Gate criteria", content: "Discusses pass rate", tags: ["testing"] }),
      makeNote({ id: "NT-011", title: "Sprint plan", content: "Delivery scope", tags: ["planning"] }),
    ];
    expect(filterNotes(searchable, { query: "gate pass" }).map((note) => note.id)).toEqual(["NT-010"]);
    expect(filterNotes(searchable, { query: "gate planning" })).toHaveLength(0);
  });
});

describe("countByType", () => {
  it("counts notes per type and keeps zero entries", () => {
    const counts = countByType([
      makeNote({ type: "General" }),
      makeNote({ type: "General" }),
      makeNote({ type: "Decision" }),
    ]);
    expect(counts.General).toBe(2);
    expect(counts.Decision).toBe(1);
    expect(counts.Research).toBe(0);
  });
});

describe("decisionStatusCounts", () => {
  it("counts decision metadata and ignores plain notes", () => {
    expect(
      decisionStatusCounts([
        makeNote({ decision: { status: "Accepted" } }),
        makeNote({ decision: { status: "Accepted" } }),
        makeNote({ decision: { status: "Proposed" } }),
        makeNote({ type: "Meeting" }),
      ])
    ).toEqual({ Proposed: 1, Accepted: 2, Rejected: 0, Superseded: 0 });
  });
});

describe("getDecisionNotes", () => {
  it("returns only decisions sorted by decided date", () => {
    const decisions = getDecisionNotes([
      makeNote({
        id: "NT-001",
        type: "Decision",
        decision: { status: "Accepted", decidedAt: "2025-09-05T09:00:00.000Z" },
      }),
      makeNote({ id: "NT-002", type: "Meeting" }),
      makeNote({
        id: "NT-003",
        type: "Decision",
        decision: { status: "Proposed", decidedAt: "2025-09-10T09:00:00.000Z" },
      }),
    ]);
    expect(decisions.map((note) => note.id)).toEqual(["NT-003", "NT-001"]);
  });
});

describe("findRelatedNotes", () => {
  const notes = [
    makeNote({ id: "NT-001", links: { projectId: "PRJ-1", taskId: "TSK-1" } }),
    makeNote({ id: "NT-002", links: { projectId: "PRJ-2" } }),
    makeNote({ id: "NT-003", links: {} }),
  ];

  it("matches any provided reference (OR semantics)", () => {
    expect(findRelatedNotes(notes, { projectId: "PRJ-1" }).map((note) => note.id)).toEqual(["NT-001"]);
    expect(findRelatedNotes(notes, { taskId: "TSK-1" }).map((note) => note.id)).toEqual(["NT-001"]);
  });

  it("returns nothing when no references are provided", () => {
    expect(findRelatedNotes(notes, {})).toHaveLength(0);
  });
});

describe("notePreview", () => {
  it("strips markdown syntax", () => {
    expect(notePreview("## Title\n\nSome **bold** text")).toBe("Title Some bold text");
  });

  it("truncates long content with an ellipsis", () => {
    const preview = notePreview("a".repeat(200), 50);
    expect(preview).toHaveLength(51);
    expect(preview.endsWith("…")).toBe(true);
  });
});

describe("recentlyUpdatedCount", () => {
  it("counts only notes updated inside the window", () => {
    expect(
      recentlyUpdatedCount(
        [makeNote({ updatedAt: new Date().toISOString() }), makeNote({ updatedAt: "2020-01-01T00:00:00.000Z" })],
        7
      )
    ).toBe(1);
  });
});