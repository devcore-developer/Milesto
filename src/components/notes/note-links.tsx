"use client";

import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/lib/project-context";
import type { KnowledgeNote } from "@/types/notes";

// Milesto entities expose either `title` or `name` depending on the type —
// resolve the display label defensively so this stays compile-safe.
interface LabeledEntity {
  title?: string;
  name?: string;
}

function entityLabel(entity: unknown, fallback: string): string {
  const candidate = entity as LabeledEntity | undefined;
  return candidate?.title ?? candidate?.name ?? fallback;
}

interface NoteLinkEntry {
  label: string;
  value: string;
}

export function NoteLinks({ note }: { note: KnowledgeNote }) {
  const { projects, phases, tasks, testCases } = useProjects();
  const links = note.links;

  const entries: NoteLinkEntry[] = [];
  if (links.projectId) {
    const project = projects.find((item) => item.id === links.projectId);
    entries.push({ label: "Project", value: entityLabel(project, links.projectId) });
  }
  if (links.phaseId) {
    const phase = phases.find((item) => item.id === links.phaseId);
    entries.push({ label: "Phase", value: entityLabel(phase, links.phaseId) });
  }
  if (links.taskId) {
    const task = tasks.find((item) => item.id === links.taskId);
    entries.push({ label: "Task", value: entityLabel(task, links.taskId) });
  }
  if (links.testCaseId) {
    const testCase = testCases.find((item) => item.id === links.testCaseId);
    entries.push({ label: "Test case", value: entityLabel(testCase, links.testCaseId) });
  }

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
      {entries.map((entry) => (
        <Badge key={entry.label} variant="outline">
          <span className="mr-1 text-muted-foreground">{entry.label}:</span>
          {entry.value}
        </Badge>
      ))}
    </div>
  );
}