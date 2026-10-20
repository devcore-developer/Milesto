"use client";

import { useMemo, useState } from "react";
import { FileText, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/common/empty-state";
import { useNotes } from "@/lib/notes-context";
import { useProjects } from "@/lib/project-context";
import { filterNotes, notePreview } from "@/lib/notes-logic";
import { NoteTypeBadge } from "./note-badges";
import { NoteDetailDialog } from "./note-detail-dialog";
import { NoteEditorDialog } from "./note-editor-dialog";
import { formatDate } from "@/lib/utils";
import { NOTE_TYPES } from "@/types/notes";
import type { KnowledgeNote, KnowledgeNoteType } from "@/types/notes";

interface NotesBrowserProps {
  /** Scope the browser to one project; omit for the global browser. */
  projectId?: string;
}

export function NotesBrowser({ projectId }: NotesBrowserProps) {
  const { notes } = useNotes();
  const { projects } = useProjects();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | KnowledgeNoteType>("All");
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailNote, setDetailNote] = useState<KnowledgeNote | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<KnowledgeNote | null>(null);

  const effectiveProjectId = projectId ?? (projectFilter !== "All" ? projectFilter : undefined);

  const visibleNotes = useMemo(
    () => filterNotes(notes, { query, type: typeFilter, projectId: effectiveProjectId, includeArchived }),
    [notes, query, typeFilter, effectiveProjectId, includeArchived]
  );

  const decisionTotal = useMemo(
    () => visibleNotes.filter((note) => note.type === "Decision").length,
    [visibleNotes]
  );

  const openDetail = (note: KnowledgeNote) => {
    setDetailNote(note);
    setDetailOpen(true);
  };

  const openCreate = () => {
    setEditingNote(null);
    setEditorOpen(true);
  };

  const openEdit = (note: KnowledgeNote) => {
    setEditingNote(note);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          {!projectId && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Include archived
          </label>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Note
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {visibleNotes.length} note{visibleNotes.length === 1 ? "" : "s"} · {decisionTotal} decision
        {decisionTotal === 1 ? "" : "s"}
      </p>

      {notes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No notes yet"
          description="Capture meetings, decisions, research and retrospectives."
          actionLabel="Create the first note"
          onAction={openCreate}
        />
      ) : visibleNotes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No notes match your search or filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleNotes.map((note) => (
            <Card key={note.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <NoteTypeBadge type={note.type} />
                  {note.archived && <Badge variant="neutral">Archived</Badge>}
                  {note.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      #{tag}
                    </Badge>
                  ))}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{note.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {note.author} · updated {formatDate(note.updatedAt)}
                  </p>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{notePreview(note.content)}</p>
                <div className="flex items-center gap-2 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" onClick={() => openDetail(note)}>
                    View
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(note)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NoteDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        note={detailNote}
        onEdit={(note) => {
          setDetailOpen(false);
          openEdit(note);
        }}
      />
      <NoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        projectId={projectId}
        note={editingNote}
      />
    </div>
  );
}