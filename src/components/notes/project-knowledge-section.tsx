"use client";

import { KnowledgePanel } from "@/components/notes/knowledge-panel";

// Kept as the project-page entry point for the Knowledge tab.
// The implementation lives in knowledge-panel.tsx (search, filters, templates,
// autosave editor) so both entry points share one code path.
export function ProjectKnowledgeSection({ projectId }: { projectId: string }) {
  return <KnowledgePanel projectId={projectId} />;
}