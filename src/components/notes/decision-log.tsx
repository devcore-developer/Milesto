"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotes } from "@/lib/notes-context";
import { MarkdownView } from "./note-markdown";
import { DecisionStatusBadge, NoteTypeBadge } from "./note-badges";
import { formatDate } from "@/lib/utils";
import { DECISION_STATUSES } from "@/types/notes";
import type { DecisionStatus, KnowledgeNote } from "@/types/notes";
import { getDecisionNotes, isArchived } from "@/lib/notes-logic";

interface DecisionLogProps {
  /** Scope the log to one project; omit for the global log. */
  projectId?: string;
}

export function DecisionLog({ projectId }: DecisionLogProps) {
  const { notes, setDecisionStatus, supersedeDecision, updateNote } = useNotes();

  const [statusFilter, setStatusFilter] = useState<"All" | DecisionStatus>("All");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [supersedingId, setSupersedingId] = useState<string | null>(null);
  const [supersedeTitle, setSupersedeTitle] = useState("");
  const [supersedeContent, setSupersedeContent] = useState("");

  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);

  const decisions = useMemo(() => {
    let list = notes.filter((note) => note.type === "Decision");
    if (!includeArchived) list = list.filter((note) => !isArchived(note));
    if (projectId) list = list.filter((note) => note.links.projectId === projectId);
    if (statusFilter !== "All") list = list.filter((note) => note.decision?.status === statusFilter);
    return getDecisionNotes(list);
  }, [notes, includeArchived, projectId, statusFilter]);

  const startSupersede = (note: KnowledgeNote) => {
    setSupersedingId(note.id);
    setSupersedeTitle(`Replaces: ${note.title}`);
    setSupersedeContent("");
  };

  const resetSupersede = () => {
    setSupersedingId(null);
    setSupersedeTitle("");
    setSupersedeContent("");
  };

  const submitSupersede = () => {
    if (!supersedingId) return;
    const created = supersedeDecision(supersedingId, {
      title: supersedeTitle,
      content: supersedeContent,
      ...(projectId ? { links: { projectId } } : {}),
    });
    if (created) resetSupersede();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "All" | DecisionStatus)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              {DECISION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Include archived
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {decisions.length} decision{decisions.length === 1 ? "" : "s"}
        </p>
      </div>

      {decisions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No decisions match the current filters. Capture a note with the Decision type and it will appear here.
          </CardContent>
        </Card>
      ) : (
        <ol className="relative space-y-6 border-l border-border pl-6">
          {decisions.map((note) => {
            const supersededBy = note.decision?.supersedesId
              ? noteById.get(note.decision.supersedesId)
              : undefined;
            return (
              <li key={note.id} className="relative">
                <span className="absolute -left-[1.72rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <NoteTypeBadge type={note.type} />
                      {note.decision && <DecisionStatusBadge status={note.decision.status} />}
                      {isArchived(note) && <Badge variant="neutral">Archived</Badge>}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{note.title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {note.author}
                        {note.decision?.decidedAt
                          ? ` · decided ${formatDate(note.decision.decidedAt)}`
                          : ` · updated ${formatDate(note.updatedAt)}`}
                      </p>
                    </div>

                    {supersededBy && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowUpRight className="h-3.5 w-3.5" /> Supersedes: {supersededBy.title} (
                        {note.decision?.supersedesId})
                      </p>
                    )}

                    <MarkdownView source={note.content} />

                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {note.decision?.status === "Proposed" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setDecisionStatus(note.id, "Accepted")}>
                            <Check className="mr-1 h-3.5 w-3.5" /> Accept
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setDecisionStatus(note.id, "Rejected")}>
                            <X className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => startSupersede(note)}>
                        Supersede
                      </Button>
                      {isArchived(note) && (
                        <Button variant="ghost" size="sm" onClick={() => updateNote(note.id, { archived: false })}>
                          Unarchive
                        </Button>
                      )}
                    </div>

                    {supersedingId === note.id && (
                      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`supersede-title-${note.id}`}>New decision title</Label>
                          <Input
                            id={`supersede-title-${note.id}`}
                            value={supersedeTitle}
                            onChange={(e) => setSupersedeTitle(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`supersede-content-${note.id}`}>New decision content</Label>
                          <Textarea
                            id={`supersede-content-${note.id}`}
                            rows={4}
                            value={supersedeContent}
                            onChange={(e) => setSupersedeContent(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={submitSupersede}>
                            Create replacement
                          </Button>
                          <Button variant="ghost" size="sm" onClick={resetSupersede}>
                            Cancel
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          The previous decision is kept in history and marked as Superseded.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}