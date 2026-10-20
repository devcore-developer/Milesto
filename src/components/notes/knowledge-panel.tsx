"use client";

import { useMemo, useState } from "react";
import {
  Bug,
  FileText,
  FlaskConical,
  History,
  Pencil,
  Plus,
  Scale,
  Search,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/common/empty-state";
import { useNotes } from "@/lib/notes-context";
import { MarkdownView } from "./note-markdown";
import { formatDate } from "@/lib/utils";
import { NOTE_TYPES } from "@/types/notes";
import type { DecisionStatus, KnowledgeNote, KnowledgeNoteType } from "@/types/notes";
import { NoteEditorDialog } from "@/components/notes/note-editor-dialog";

const TYPE_ICONS: Record<KnowledgeNoteType, LucideIcon> = {
  General: FileText,
  Technical: Wrench,
  Meeting: Users,
  Decision: Scale,
  "Bug Investigation": Bug,
  Research: FlaskConical,
  Retrospective: History,
};

const TYPE_VARIANTS: Record<KnowledgeNoteType, "outline" | "info" | "neutral" | "warning" | "danger" | "success"> = {
  General: "outline",
  Technical: "info",
  Meeting: "neutral",
  Decision: "warning",
  "Bug Investigation": "danger",
  Research: "success",
  Retrospective: "info",
};

const DECISION_VARIANTS: Record<DecisionStatus, "warning" | "success" | "danger" | "neutral"> = {
  Proposed: "warning",
  Accepted: "success",
  Rejected: "danger",
  Superseded: "neutral",
};

function toPreview(markdown: string, max = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " [code block] ")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

interface KnowledgePanelProps {
  projectId: string;
}

export function KnowledgePanel({ projectId }: KnowledgePanelProps) {
  const { getNotesByProject, searchNotes, deleteNote } = useNotes();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | KnowledgeNoteType>("All");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<KnowledgeNote | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const projectNotes = useMemo(
    () => getNotesByProject(projectId),
    [getNotesByProject, projectId]
  );

  const visibleNotes = useMemo(() => {
    const searched = query.trim() ? searchNotes(query, projectNotes) : projectNotes;
    return typeFilter === "All" ? searched : searched.filter((note) => note.type === typeFilter);
  }, [projectNotes, query, searchNotes, typeFilter]);

  const decisionCount = projectNotes.filter((note) => note.type === "Decision").length;

  const openCreate = () => {
    setEditingNote(null);
    setEditorOpen(true);
  };

  const openEdit = (note: KnowledgeNote) => {
    setEditingNote(note);
    setEditorOpen(true);
  };

  const handleDelete = (id: string) => {
    if (pendingDeleteId === id) {
      deleteNote(id);
      setPendingDeleteId(null);
      if (expandedId === id) setExpandedId(null);
    } else {
      setPendingDeleteId(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes by title, content or tag…"
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as "All" | KnowledgeNoteType)}
        >
          <SelectTrigger className="w-full sm:w-48">
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
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Note
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {projectNotes.length} note{projectNotes.length === 1 ? "" : "s"} · {decisionCount} decision
        {decisionCount === 1 ? "" : "s"} · autosaved in memory for this session
      </p>

      {projectNotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No knowledge yet"
          description="Capture meetings, decisions, research and retrospectives for this project."
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
          {visibleNotes.map((note) => {
            const Icon = TYPE_ICONS[note.type];
            const expanded = expandedId === note.id;
            return (
              <Card key={note.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={TYPE_VARIANTS[note.type]}>
                      <Icon className="mr-1 h-3 w-3" />
                      {note.type}
                    </Badge>
                    {note.type === "Decision" && note.decision && (
                      <Badge variant={DECISION_VARIANTS[note.decision.status]}>
                        {note.decision.status}
                      </Badge>
                    )}
                    {note.decision?.supersedesId && (
                      <Badge variant="outline" title={`Supersedes ${note.decision.supersedesId}`}>
                        supersedes {note.decision.supersedesId}
                      </Badge>
                    )}
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

                  {expanded ? (
                    <MarkdownView source={note.content} />
                  ) : (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{toPreview(note.content)}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(expanded ? null : note.id)}>
                      {expanded ? "Hide" : "View"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(note)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    {pendingDeleteId === note.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-600"
                          onClick={() => handleDelete(note.id)}
                        >
                          Confirm delete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(note.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        projectId={projectId}
        note={editingNote}
      />
    </div>
  );
}