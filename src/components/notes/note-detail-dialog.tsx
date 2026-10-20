"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotes } from "@/lib/notes-context";
import { MarkdownView } from "./note-markdown";
import { DecisionStatusBadge, NoteTypeBadge } from "./note-badges";
import { NoteLinks } from "./note-links";
import { formatDate } from "@/lib/utils";
import { DECISION_STATUSES } from "@/types/notes";
import type { DecisionStatus, KnowledgeNote } from "@/types/notes";

interface NoteDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: KnowledgeNote | null;
  /** Optional hook so parents can route "Edit" to their own editor. */
  onEdit?: (note: KnowledgeNote) => void;
}

export function NoteDetailDialog({ open, onOpenChange, note, onEdit }: NoteDetailDialogProps) {
  const { updateNote, deleteNote, setDecisionStatus } = useNotes();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (!note) return;
    if (confirmDelete) {
      if (deleteNote(note.id)) onOpenChange(false);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleArchiveToggle = () => {
    if (!note) return;
    updateNote(note.id, { archived: !note.archived });
  };

  const handleStatusChange = (nextStatus: DecisionStatus) => {
    if (!note) return;
    setDecisionStatus(note.id, nextStatus);
  };

  return (
    <Dialog
      open={open && Boolean(note)}
      onOpenChange={(next) => {
        if (!next) setConfirmDelete(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        {note ? (
          <>
            <DialogHeader>
              <DialogTitle>{note.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <NoteTypeBadge type={note.type} />
                {note.type === "Decision" && note.decision && (
                  <DecisionStatusBadge status={note.decision.status} />
                )}
                {note.archived && <Badge variant="neutral">Archived</Badge>}
                {note.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    #{tag}
                  </Badge>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {note.author} · created {formatDate(note.createdAt)} · updated {formatDate(note.updatedAt)}
              </p>

              <NoteLinks note={note} />

              {note.type === "Decision" && note.decision?.supersedesId && (
                <p className="text-xs text-muted-foreground">
                  Supersedes decision {note.decision.supersedesId}.
                </p>
              )}

              <div className="max-h-[45vh] overflow-y-auto rounded-md border border-border p-3">
                <MarkdownView source={note.content} />
              </div>

              {note.type === "Decision" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Decision status</Label>
                  <Select
                    value={note.decision?.status ?? "Proposed"}
                    onValueChange={(value) => handleStatusChange(value as DecisionStatus)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DECISION_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleArchiveToggle}>
                  {note.archived ? (
                    <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <Archive className="mr-1 h-3.5 w-3.5" />
                  )}
                  {note.archived ? "Unarchive" : "Archive"}
                </Button>
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onEdit(note);
                      onOpenChange(false);
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-600"
                    onClick={handleDelete}
                  >
                    Confirm delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-red-600"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}