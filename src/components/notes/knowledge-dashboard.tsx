"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Layers, LayoutGrid, Link2, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotes } from "@/lib/notes-context";
import { useProjects } from "@/lib/project-context";
import {
  decisionStatusCounts,
  filterNotes,
  isArchived,
  linkedNotesCount,
  recentlyUpdatedCount,
} from "@/lib/notes-logic";
import { DECISION_STATUSES, NOTE_TYPES } from "@/types/notes";
import type { DecisionStatus, KnowledgeNote, KnowledgeNoteType } from "@/types/notes";
import { DecisionStatusBadge, NoteTypeBadge } from "./note-badges";
import { NoteDetailDialog } from "./note-detail-dialog";
import { formatDate } from "@/lib/utils";

interface KnowledgeDashboardProps {
  /** Scope the dashboard to one project; omit for the global dashboard. */
  projectId?: string;
}

export function KnowledgeDashboard({ projectId }: KnowledgeDashboardProps) {
  const { notes } = useNotes();
  const { projects } = useProjects();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | KnowledgeNoteType>("All");
  const [view, setView] = useState<"list" | "card">("card");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailNote, setDetailNote] = useState<KnowledgeNote | null>(null);

  const scopedNotes = useMemo(
    () => (projectId ? notes.filter((note) => note.links.projectId === projectId) : notes),
    [notes, projectId]
  );

  const metrics = useMemo(
    () => ({
      total: scopedNotes.length,
      archived: scopedNotes.filter((note) => isArchived(note)).length,
      linked: linkedNotesCount(scopedNotes),
      recent: recentlyUpdatedCount(scopedNotes),
      decisions: decisionStatusCounts(scopedNotes),
    }),
    [scopedNotes]
  );

  const projectsWithNotes = useMemo(() => {
    if (projectId) return null;
    return projects.filter((project) =>
      scopedNotes.some((note) => note.links.projectId === project.id)
    ).length;
  }, [projects, scopedNotes, projectId]);

  const visibleNotes = useMemo(
    () => filterNotes(scopedNotes, { query, type: typeFilter }),
    [scopedNotes, query, typeFilter]
  );

  const openDetail = (note: KnowledgeNote) => {
    setDetailNote(note);
    setDetailOpen(true);
  };

  const unlinked = metrics.total - metrics.linked;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total notes</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metrics.archived} archived</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Linked to work</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.linked}</p>
            <p className="mt-1 text-xs text-muted-foreground">{unlinked} unlinked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Accepted decisions</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.decisions.Accepted}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {metrics.decisions.Proposed} awaiting review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Updated this week</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.recent}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {projectsWithNotes === null
                ? "across this project"
                : `${projectsWithNotes} of ${projects.length} projects covered`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Decision summary
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {DECISION_STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-1.5">
              <DecisionStatusBadge status={status} />
              <span className="text-sm font-medium text-foreground">{metrics.decisions[status]}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search knowledge…"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as "All" | KnowledgeNoteType)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All types</SelectItem>
                {NOTE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 rounded-md border border-border p-1">
              <Button
                variant={view === "list" ? "subtle" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "card" ? "subtle" : "ghost"}
                size="sm"
                onClick={() => setView("card")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {visibleNotes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No knowledge matches your search or filters.
            </CardContent>
          </Card>
        ) : view === "list" ? (
          <div className="space-y-2">
            {visibleNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => openDetail(note)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <NoteTypeBadge type={note.type} />
                    {isArchived(note) && <Badge variant="neutral">Archived</Badge>}
                    <span className="text-sm font-medium text-foreground">{note.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {note.author} · updated {formatDate(note.updatedAt)}
                  </p>
                </div>
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => openDetail(note)}
                className="flex h-full flex-col gap-2 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <NoteTypeBadge type={note.type} />
                  {isArchived(note) && <Badge variant="neutral">Archived</Badge>}
                </div>
                <p className="text-sm font-semibold text-foreground">{note.title}</p>
                <p className="text-xs text-muted-foreground">
                  {note.author} · updated {formatDate(note.updatedAt)}
                </p>
                <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                  {note.tags.length} tag{note.tags.length === 1 ? "" : "s"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <NoteDetailDialog open={detailOpen} onOpenChange={setDetailOpen} note={detailNote} />
    </div>
  );
}